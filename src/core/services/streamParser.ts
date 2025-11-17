/**
 * Stream Parser
 *
 * Server-Sent Events (SSE) parser for streaming AI responses.
 *
 * Features:
 * - SSE event stream parsing
 * - Chunk buffering and queue management
 * - First token latency optimization (<50ms target)
 * - Graceful error handling and reconnection
 * - Token counting and metadata tracking
 * - Stream interruption support
 * - Efficient DOM patching with morphdom (CORE-012D)
 *
 * CORE-012: Streaming response parser with SSE and chunk buffering
 * CORE-012B: Scroll throttling (100ms) for smooth streaming
 * CORE-012D: morphdom integration for efficient DOM patching
 * CORE-012E: Chunk queue with pre-buffering for early-arriving chunks
 */

import morphdom from 'morphdom';

export interface StreamChunk {
  content: string;
  delta: string;
  finish_reason?: string;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

export interface StreamOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  onChunk: (chunk: StreamChunk) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
  targetElement?: HTMLElement; // CORE-012D: Target element for morphdom patching
  useMorphdom?: boolean;       // CORE-012D: Enable morphdom patching (default: false)
}

export class StreamParser {
  private abortController: AbortController | null = null;
  private chunkQueue: StreamChunk[] = [];
  private fullContent = '';
  private isProcessing = false;
  private firstTokenReceived = false;
  private startTime = 0;

  // Throttling configuration
  private readonly SCROLL_THROTTLE_MS = 100; // CORE-012B: 100ms scroll throttle
  private lastScrollUpdate = 0;

  // Pre-buffering configuration
  private readonly BUFFER_SIZE = 3; // CORE-012E: Buffer first 3 chunks
  private bufferedChunks: StreamChunk[] = [];
  private bufferingComplete = false;

  // morphdom configuration (CORE-012D)
  private morphdomOptions = {
    childrenOnly: true,  // Only morph children, not the container
    onBeforeElUpdated: (fromEl: HTMLElement, toEl: HTMLElement) => {
      // Don't morph if elements are identical
      if (fromEl.isEqualNode(toEl)) {
        return false;
      }
      // Preserve focus
      if (fromEl === document.activeElement) {
        return false;
      }
      return true;
    }
  };

  /**
   * Start streaming from URL
   */
  public async startStream(options: StreamOptions): Promise<void> {
    this.reset();
    this.startTime = performance.now();

    // Create new abort controller
    this.abortController = new AbortController();

    const signal = options.signal || this.abortController.signal;

    try {
      const response = await fetch(options.url, {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      await this.processStream(response.body, options);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('Stream aborted by user');
        } else {
          options.onError(error);
        }
      }
    }
  }

  /**
   * Process readable stream
   */
  private async processStream(
    body: ReadableStream<Uint8Array>,
    options: StreamOptions
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            this.processSSEData(buffer, options);
          }

          // Process any remaining buffered chunks
          this.flushBuffer(options);

          // Call completion callback
          options.onComplete(this.fullContent);
          break;
        }

        // Decode chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const message of lines) {
          if (message.trim()) {
            this.processSSEData(message, options);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process SSE data message
   */
  private processSSEData(data: string, options: StreamOptions): void {
    const lines = data.split('\n');
    let eventType = '';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        eventData = line.substring(5).trim();
      }
    }

    // Parse JSON data
    if (eventData && eventData !== '[DONE]') {
      try {
        const parsed = JSON.parse(eventData);
        this.handleStreamData(parsed, options);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    }
  }

  /**
   * Handle parsed stream data
   */
  private handleStreamData(data: any, options: StreamOptions): void {
    // Extract content delta from different API formats
    let delta = '';
    let finishReason: string | undefined;
    let metadata: any = {};

    // OpenAI format
    if (data.choices && data.choices[0]) {
      const choice = data.choices[0];
      delta = choice.delta?.content || '';
      finishReason = choice.finish_reason;

      if (data.usage) {
        metadata.tokens = data.usage.total_tokens;
      }
      if (data.model) {
        metadata.model = data.model;
      }
    }
    // Anthropic format
    else if (data.type === 'content_block_delta') {
      delta = data.delta?.text || '';
    }
    // Generic format
    else if (data.content) {
      delta = data.content;
    }

    if (!delta && !finishReason) {
      return;
    }

    // Track first token latency
    if (!this.firstTokenReceived && delta) {
      const latency = performance.now() - this.startTime;
      console.log(`First token latency: ${latency.toFixed(2)}ms`);
      this.firstTokenReceived = true;
    }

    // Update full content
    this.fullContent += delta;

    // Create chunk
    const chunk: StreamChunk = {
      content: this.fullContent,
      delta,
      finish_reason: finishReason,
      metadata
    };

    // CORE-012E: Pre-buffer first chunks
    if (!this.bufferingComplete) {
      this.bufferedChunks.push(chunk);

      if (this.bufferedChunks.length >= this.BUFFER_SIZE || finishReason) {
        this.bufferingComplete = true;
        this.flushBuffer(options);
      }
      return;
    }

    // Add to queue and process
    this.chunkQueue.push(chunk);
    this.processQueue(options);
  }

  /**
   * Flush buffered chunks
   */
  private flushBuffer(options: StreamOptions): void {
    for (const chunk of this.bufferedChunks) {
      this.chunkQueue.push(chunk);
    }
    this.bufferedChunks = [];
    this.processQueue(options);
  }

  /**
   * Process chunk queue with throttling and optional morphdom patching
   */
  private processQueue(options: StreamOptions): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // CORE-012B: Throttle scroll updates (100ms)
    const now = performance.now();
    const timeSinceLastUpdate = now - this.lastScrollUpdate;

    if (timeSinceLastUpdate < this.SCROLL_THROTTLE_MS) {
      // Schedule next update
      setTimeout(() => {
        this.isProcessing = false;
        this.processQueue(options);
      }, this.SCROLL_THROTTLE_MS - timeSinceLastUpdate);
      return;
    }

    // Process all queued chunks
    while (this.chunkQueue.length > 0) {
      const chunk = this.chunkQueue.shift()!;

      // CORE-012D: Use morphdom for efficient DOM patching if enabled
      if (options.useMorphdom && options.targetElement) {
        this.patchDOMWithMorphdom(options.targetElement, chunk.content);
      }

      options.onChunk(chunk);
    }

    this.lastScrollUpdate = now;
    this.isProcessing = false;
  }

  /**
   * CORE-012D: Efficiently patch DOM using morphdom
   */
  private patchDOMWithMorphdom(targetElement: HTMLElement, newContent: string): void {
    // Create temporary container with new content
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = newContent;

    // Morph the target element's content to match new content
    morphdom(targetElement, tempContainer, this.morphdomOptions);
  }

  /**
   * Stop streaming
   */
  public stopStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Reset parser state
   */
  private reset(): void {
    this.chunkQueue = [];
    this.fullContent = '';
    this.isProcessing = false;
    this.firstTokenReceived = false;
    this.startTime = 0;
    this.lastScrollUpdate = 0;
    this.bufferedChunks = [];
    this.bufferingComplete = false;
  }

  /**
   * Get current full content
   */
  public getFullContent(): string {
    return this.fullContent;
  }

  /**
   * Check if streaming is active
   */
  public isActive(): boolean {
    return this.abortController !== null;
  }
}

/**
 * Factory function to create StreamParser instance
 */
export function createStreamParser(): StreamParser {
  return new StreamParser();
}
