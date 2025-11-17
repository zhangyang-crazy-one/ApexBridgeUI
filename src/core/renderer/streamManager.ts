/**
 * Stream Manager Module (CORE-018D)
 *
 * Responsibilities:
 * - Manage streaming message chunks from SSE
 * - Pre-buffer chunks to prevent flicker (default: 3 chunks)
 * - Handle chunk merging and batching
 * - Backpressure management for fast streams
 * - Stream state management (active/paused/complete/error)
 * - Throttled DOM updates for smooth rendering
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────┐
 * │ SSE Stream → Chunk Queue → Pre-buffer → Render │
 * └─────────────────────────────────────────────────┘
 *
 * Chunk Flow:
 * 1. SSE chunk arrives → enqueue
 * 2. Pre-buffer fills (3 chunks default)
 * 3. Throttled render (100ms default)
 * 4. Merge chunks if queue grows too large (backpressure)
 * 5. Final flush on stream complete
 *
 * Benefits:
 * - Prevents flicker from single-character chunks
 * - Smooth 60fps rendering via throttling
 * - Handles fast streams without blocking UI
 * - Memory efficient with chunk merging
 */

/**
 * Stream state
 */
export type StreamState = 'idle' | 'active' | 'paused' | 'complete' | 'error';

/**
 * Stream chunk data
 */
export interface StreamChunk {
  /**
   * Chunk content (text or object)
   */
  content: string;

  /**
   * Chunk sequence number
   */
  sequence: number;

  /**
   * Timestamp when chunk arrived
   */
  timestamp: number;

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Stream manager options
 */
export interface StreamManagerOptions {
  /**
   * Number of chunks to pre-buffer before rendering
   * Higher = smoother but more delay
   * Default: 3
   */
  preBufferSize?: number;

  /**
   * Throttle interval for render updates (ms)
   * Default: 100
   */
  throttleInterval?: number;

  /**
   * Maximum queue size before merging chunks
   * Prevents memory issues with fast streams
   * Default: 20
   */
  maxQueueSize?: number;

  /**
   * Merge threshold - when to start merging chunks
   * Default: 10
   */
  mergeThreshold?: number;

  /**
   * Callback when chunk is ready for rendering
   */
  onChunk?: (chunk: StreamChunk, fullContent: string) => void;

  /**
   * Callback when stream completes
   */
  onComplete?: (fullContent: string) => void;

  /**
   * Callback when stream errors
   */
  onError?: (error: Error) => void;

  /**
   * Callback when stream state changes
   */
  onStateChange?: (state: StreamState) => void;
}

/**
 * Stream Manager
 * Manages streaming chunks with pre-buffering and throttling
 */
export class StreamManager {
  private state: StreamState = 'idle';
  private chunkQueue: StreamChunk[] = [];
  private fullContent: string = '';
  private sequenceNumber: number = 0;

  // Pre-buffer for smooth rendering
  private preBuffer: StreamChunk[] = [];
  private isPreBufferFilled: boolean = false;

  // Throttling
  private lastRenderTime: number = 0;
  private throttleTimer: number | null = null;
  private pendingRender: boolean = false;

  // Options
  private readonly options: Required<StreamManagerOptions>;

  // Default configuration
  private readonly DEFAULT_PRE_BUFFER_SIZE = 3;
  private readonly DEFAULT_THROTTLE_INTERVAL = 100;
  private readonly DEFAULT_MAX_QUEUE_SIZE = 20;
  private readonly DEFAULT_MERGE_THRESHOLD = 10;

  constructor(options: StreamManagerOptions = {}) {
    this.options = {
      preBufferSize: options.preBufferSize ?? this.DEFAULT_PRE_BUFFER_SIZE,
      throttleInterval: options.throttleInterval ?? this.DEFAULT_THROTTLE_INTERVAL,
      maxQueueSize: options.maxQueueSize ?? this.DEFAULT_MAX_QUEUE_SIZE,
      mergeThreshold: options.mergeThreshold ?? this.DEFAULT_MERGE_THRESHOLD,
      onChunk: options.onChunk ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onStateChange: options.onStateChange ?? (() => {})
    };
  }

  /**
   * Start streaming
   */
  public start(): void {
    if (this.state !== 'idle') {
      console.warn('[StreamManager] Stream already started');
      return;
    }

    this.setState('active');
    this.reset();
  }

  /**
   * Push new chunk to stream
   *
   * @param content - Chunk content
   * @param metadata - Optional metadata
   */
  public push(content: string, metadata?: Record<string, any>): void {
    if (this.state !== 'active') {
      console.warn('[StreamManager] Cannot push chunk, stream not active');
      return;
    }

    // Create chunk
    const chunk: StreamChunk = {
      content,
      sequence: this.sequenceNumber++,
      timestamp: Date.now(),
      metadata
    };

    // Add to queue
    this.chunkQueue.push(chunk);

    // Update full content
    this.fullContent += content;

    // Handle pre-buffering
    if (!this.isPreBufferFilled) {
      this.preBuffer.push(chunk);

      // Check if pre-buffer is filled
      if (this.preBuffer.length >= this.options.preBufferSize) {
        this.isPreBufferFilled = true;
        this.flushPreBuffer();
      }
    } else {
      // Pre-buffer already filled, process immediately
      this.scheduleRender(chunk);
    }

    // Handle backpressure (queue too large)
    if (this.chunkQueue.length > this.options.mergeThreshold) {
      this.handleBackpressure();
    }
  }

  /**
   * Complete streaming
   */
  public complete(): void {
    if (this.state !== 'active') {
      return;
    }

    // Flush any remaining chunks
    this.flushRemaining();

    // Clear throttle timer
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    // Set state
    this.setState('complete');

    // Call complete callback
    this.options.onComplete(this.fullContent);
  }

  /**
   * Error occurred in stream
   */
  public error(err: Error): void {
    if (this.state === 'complete' || this.state === 'error') {
      return;
    }

    // Clear throttle timer
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    // Set state
    this.setState('error');

    // Call error callback
    this.options.onError(err);
  }

  /**
   * Pause streaming
   */
  public pause(): void {
    if (this.state !== 'active') {
      return;
    }

    this.setState('paused');

    // Clear throttle timer
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  /**
   * Resume streaming
   */
  public resume(): void {
    if (this.state !== 'paused') {
      return;
    }

    this.setState('active');

    // Resume rendering
    if (this.pendingRender) {
      this.render();
    }
  }

  /**
   * Reset stream manager
   */
  public reset(): void {
    this.chunkQueue = [];
    this.preBuffer = [];
    this.fullContent = '';
    this.sequenceNumber = 0;
    this.isPreBufferFilled = false;
    this.lastRenderTime = 0;
    this.pendingRender = false;

    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  /**
   * Flush pre-buffer when filled
   */
  private flushPreBuffer(): void {
    if (this.preBuffer.length === 0) {
      return;
    }

    // If preBufferSize is 1, render individual chunks (no merging)
    if (this.options.preBufferSize === 1 && this.preBuffer.length === 1) {
      this.renderChunk(this.preBuffer[0]);
      this.preBuffer = [];
      return;
    }

    // Render each individual chunk first (for onChunk callback)
    for (const chunk of this.preBuffer) {
      this.renderChunk(chunk);
    }

    // Clear pre-buffer
    this.preBuffer = [];
  }

  /**
   * Flush remaining chunks on complete
   */
  private flushRemaining(): void {
    // Flush pre-buffer if not yet filled
    if (!this.isPreBufferFilled && this.preBuffer.length > 0) {
      this.flushPreBuffer();
    }

    // Render any pending chunks
    if (this.chunkQueue.length > 0) {
      // Get all remaining chunks
      const remainingChunks = this.chunkQueue.splice(0);

      // Render each individual chunk (for onChunk callback)
      for (const chunk of remainingChunks) {
        this.renderChunk(chunk);
      }
    }
  }

  /**
   * Schedule throttled render
   */
  private scheduleRender(chunk: StreamChunk): void {
    this.pendingRender = true;

    const now = Date.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    // If enough time has passed, render immediately
    if (timeSinceLastRender >= this.options.throttleInterval) {
      this.render();
      return;
    }

    // Otherwise, schedule render
    if (this.throttleTimer === null) {
      const delay = this.options.throttleInterval - timeSinceLastRender;

      this.throttleTimer = window.setTimeout(() => {
        this.throttleTimer = null;
        this.render();
      }, delay);
    }
  }

  /**
   * Render chunk
   */
  private render(): void {
    if (this.state !== 'active') {
      return;
    }

    this.pendingRender = false;
    this.lastRenderTime = Date.now();

    // Get next chunk from queue
    const chunk = this.chunkQueue.shift();
    if (!chunk) {
      return;
    }

    this.renderChunk(chunk);
  }

  /**
   * Render chunk to output
   */
  private renderChunk(chunk: StreamChunk): void {
    this.options.onChunk(chunk, this.fullContent);
  }

  /**
   * Handle backpressure when queue grows too large
   * Merge chunks to reduce queue size
   */
  private handleBackpressure(): void {
    if (this.chunkQueue.length < this.options.maxQueueSize) {
      return;
    }

    console.warn(
      `[StreamManager] Queue size exceeded ${this.options.maxQueueSize}, merging chunks`
    );

    // Merge oldest chunks
    const chunksToMerge = Math.floor(this.chunkQueue.length / 2);
    const merged = this.chunkQueue.splice(0, chunksToMerge);

    if (merged.length > 0) {
      // Create merged chunk
      const mergedChunk: StreamChunk = {
        content: merged.map(c => c.content).join(''),
        sequence: merged[0].sequence,
        timestamp: merged[0].timestamp,
        metadata: { merged: true, count: merged.length, backpressure: true }
      };

      // Re-insert at front of queue
      this.chunkQueue.unshift(mergedChunk);
    }
  }

  /**
   * Set stream state
   */
  private setState(newState: StreamState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    console.log(`[StreamManager] State: ${oldState} → ${newState}`);

    this.options.onStateChange(newState);
  }

  /**
   * Get current state
   */
  public getState(): StreamState {
    return this.state;
  }

  /**
   * Get full content accumulated so far
   */
  public getFullContent(): string {
    return this.fullContent;
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.chunkQueue.length;
  }

  /**
   * Get pre-buffer status
   */
  public isPreBufferReady(): boolean {
    return this.isPreBufferFilled;
  }

  /**
   * Get statistics
   */
  public getStats(): {
    state: StreamState;
    queueSize: number;
    preBufferSize: number;
    isPreBufferFilled: boolean;
    totalChunks: number;
    contentLength: number;
  } {
    return {
      state: this.state,
      queueSize: this.chunkQueue.length,
      preBufferSize: this.preBuffer.length,
      isPreBufferFilled: this.isPreBufferFilled,
      totalChunks: this.sequenceNumber,
      contentLength: this.fullContent.length
    };
  }
}

/**
 * Factory function to create stream manager
 */
export function createStreamManager(options?: StreamManagerOptions): StreamManager {
  return new StreamManager(options);
}

/**
 * Convenience function to create stream manager with callbacks
 */
export function createManagedStream(
  onChunk: (chunk: string, fullContent: string) => void,
  onComplete?: (fullContent: string) => void,
  onError?: (error: Error) => void
): StreamManager {
  return new StreamManager({
    onChunk: (chunk, full) => onChunk(chunk.content, full),
    onComplete,
    onError
  });
}
