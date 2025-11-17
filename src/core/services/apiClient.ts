/**
 * API Client (CORE-060)
 *
 * VCPToolBox API Client with Retry Logic and Connection Management
 *
 * Enhancements for CORE-060:
 * - Automatic retry with exponential backoff (CORE-063)
 * - Connection status management (CORE-062)
 * - Integration with SettingsManager for dynamic configuration
 * - Bearer token authentication
 * - Retry logic: 5 attempts with exponential backoff (1s, 2s, 4s, 8s, 16s)
 * - Connection status tracking and events
 */

import type { Message } from '@core/models/message';
import type { Agent } from '@core/models/agent';
import { SettingsManager } from '../managers/settingsManager';

/**
 * Message content type - supports text and multimodal content
 */
export type MessageContent = string | Array<{
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}>;

/**
 * API Request Options
 */
export interface ChatCompletionRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: MessageContent;  // Supports string or multimodal array
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * API Response Types
 */
export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Stream Chunk Response
 */
export interface StreamChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
      reasoning_content?: string;  // GLM-4.6 CoT support
    };
    finish_reason: string | null;
  }>;
}

/**
 * Model information from API
 */
export interface ModelInfo {
  id: string;           // Model ID (e.g., "gpt-4", "glm-4.6")
  object: string;       // "model"
  owned_by: string;     // Provider (e.g., "openai", "zhipuai", "anthropic")
  description?: string; // Optional description
}

/**
 * Models list response
 */
export interface ModelsListResponse {
  data: ModelInfo[];
}

/**
 * VCP Tool Call Format
 */
export interface VCPToolCall {
  maid: string;           // Agent name
  tool_name: string;      // Plugin name
  parameters: Record<string, string>;
}

/**
 * API Client Configuration (legacy, kept for backward compatibility)
 */
export interface APIClientConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
}

/**
 * HTTP Error with response status
 */
class HTTPError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HTTPError';
    this.status = status;
  }
}

/**
 * Connection status enum
 */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * VCPToolBox API Client
 * Handles ChatCompletion requests with SSE streaming support
 */
export class APIClient {
  private config: APIClientConfig;
  private controller: AbortController | null = null;
  private settingsManager: SettingsManager;
  private connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;

  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 5,
    initialDelay: 1000,     // 1 second
    maxDelay: 16000,        // 16 seconds
    backoffMultiplier: 2    // Exponential: 1s, 2s, 4s, 8s, 16s
  };

  constructor(config: APIClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 120000, // Default 2 minutes
    };
    this.settingsManager = SettingsManager.getInstance();
  }

  /**
   * Update API configuration
   */
  updateConfig(config: Partial<APIClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Set connection status and dispatch event
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      window.dispatchEvent(new CustomEvent('connection-status-changed', {
        detail: { status }
      }));
      console.log('[ApiClient] Connection status:', status);
    }
  }

  /**
   * Get backend URL from settings (with fallback to config)
   */
  private getBackendUrl(): string {
    const settings = this.settingsManager.getSettings();
    return settings.backend_url || this.config.baseURL;
  }

  /**
   * Get API key from settings (with fallback to config)
   */
  private getApiKey(): string {
    const settings = this.settingsManager.getSettings();
    return settings.api_key || this.config.apiKey;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Wait for specified delay
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any, response?: Response): boolean {
    // Network errors are retryable
    if (error.name === 'TypeError' || error.name === 'NetworkError' || error.name === 'AbortError') {
      return true;
    }

    // Check error message for network-related errors
    if (error instanceof Error && error.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes('network error') ||
          msg.includes('failed to fetch') ||
          msg.includes('unable to connect') ||
          msg.includes('request timeout') ||
          msg.includes('connection') ||
          msg.includes('fetch')) {
        return true;
      }
    }

    // Check HTTPError status
    if (error instanceof HTTPError) {
      const status = error.status;
      return status >= 500 || status === 408 || status === 429;
    }

    // HTTP status codes that are retryable (from response)
    if (response) {
      const status = response.status;
      return status >= 500 || status === 408 || status === 429;
    }

    return false;
  }

  /**
   * Execute request with retry logic (CORE-063)
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryConfig: RetryConfig = this.DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        this.setConnectionStatus(ConnectionStatus.Connecting);
        const result = await fn();
        this.setConnectionStatus(ConnectionStatus.Connected);
        return result;
      } catch (error: any) {
        lastError = error;
        console.error(`[ApiClient] Attempt ${attempt}/${retryConfig.maxAttempts} failed:`, error);

        if (!this.isRetryableError(error)) {
          console.log('[ApiClient] Error is not retryable, failing immediately');
          this.setConnectionStatus(ConnectionStatus.Error);
          throw error;
        }

        if (attempt < retryConfig.maxAttempts) {
          const delay = this.calculateRetryDelay(attempt, retryConfig);
          console.log(`[ApiClient] Retrying in ${delay}ms...`);
          await this.wait(delay);
        }
      }
    }

    // All retries exhausted
    this.setConnectionStatus(ConnectionStatus.Error);
    throw new Error(`Request failed after ${retryConfig.maxAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Send chat completion request (non-streaming)
   * Now with automatic retry (CORE-063)
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return await this.executeWithRetry(async () => {
      const url = this.getBackendUrl();
      const apiKey = this.getApiKey();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        // Throw error and let executeWithRetry determine if retryable
        throw error;
      }

      return await response.json();
    });
  }

  /**
   * Send chat completion request with SSE streaming
   * Now with automatic retry (CORE-063)
   *
   * @param request Chat completion request
   * @param callbacks Streaming callbacks object
   */
  async chatCompletionStream(
    request: ChatCompletionRequest,
    callbacks: {
      onChunk: (chunk: string) => void;
      onComplete: (fullResponse: string) => void;
      onError: (error: Error) => void;
      signal?: AbortSignal;
    }
  ): Promise<void> {
    const { onChunk, onComplete, onError, signal } = callbacks;

    try {
      await this.executeWithRetry(async () => {
        const url = this.getBackendUrl();
        const apiKey = this.getApiKey();

        this.controller = new AbortController();

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            ...request,
            stream: true,
          }),
          signal: signal || this.controller.signal,
        });

        if (!response.ok) {
          const error = await this.handleErrorResponse(response);
          // Throw error and let executeWithRetry determine if retryable
          throw error;
        }

        await this.parseSSEStream(response, onChunk, onComplete, onError);
      });
    } catch (error) {
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error('Unknown streaming error'));
      }
    }
  }

  /**
   * Parse SSE stream from response
   */
  private async parseSSEStream(
    response: Response,
    onChunk: (delta: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete(fullResponse);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              onComplete(fullResponse);
              return;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);
              // Extract both content and reasoning_content (GLM-4.6 CoT support)
              const contentDelta = chunk.choices[0]?.delta?.content || '';
              const reasoningDelta = chunk.choices[0]?.delta?.reasoning_content || '';
              // Prioritize content, fallback to reasoning_content
              const delta = contentDelta || reasoningDelta;

              if (delta) {
                fullResponse += delta;
                onChunk(delta);  // Pass only delta, not (fullResponse, delta)
              }

              if (chunk.choices[0]?.finish_reason) {
                onComplete(fullResponse);
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE chunk:', parseError);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        onError(error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse VCP protocol tool calls from message content
   * Format: <<<[TOOL_REQUEST]>>> ... <<<[END_TOOL_REQUEST]>>>
   */
  parseVCPToolCalls(content: string): VCPToolCall[] {
    const toolCalls: VCPToolCall[] = [];
    const regex = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const toolBlock = match[1];
      const toolCall = this.parseToolBlock(toolBlock);
      if (toolCall) {
        toolCalls.push(toolCall);
      }
    }

    return toolCalls;
  }

  /**
   * Parse individual tool call block
   */
  private parseToolBlock(block: string): VCPToolCall | null {
    const lines = block.trim().split('\n');
    const toolCall: Partial<VCPToolCall> = { parameters: {} };

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Extract value from 「始」...「末」markers
      const valueMatch = value.match(/「始」(.*?)「末」/);
      const extractedValue = valueMatch ? valueMatch[1] : value;

      if (key === 'maid') {
        toolCall.maid = extractedValue;
      } else if (key === 'tool_name') {
        toolCall.tool_name = extractedValue;
      } else {
        toolCall.parameters![key] = extractedValue;
      }
    }

    if (toolCall.maid && toolCall.tool_name) {
      return toolCall as VCPToolCall;
    }

    return null;
  }

  /**
   * Cancel ongoing streaming request
   */
  cancelStream(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * Handle HTTP error responses
   */
  private async handleErrorResponse(response: Response): Promise<HTTPError> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Use default error message if parsing fails
    }

    switch (response.status) {
      case 400:
        return new HTTPError(`Bad Request: ${errorMessage}`, 400);
      case 401:
        return new HTTPError(`Unauthorized: Invalid API key`, 401);
      case 429:
        return new HTTPError(`Rate Limited: Too many requests`, 429);
      case 500:
        return new HTTPError(`Server Error: ${errorMessage}`, 500);
      default:
        return new HTTPError(errorMessage, response.status);
    }
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new Error('Request timeout');
      }
      if (error.message.includes('Failed to fetch')) {
        return new Error('Network error: Unable to connect to VCPToolBox');
      }
      return error;
    }
    return new Error('Unknown network error');
  }

  /**
   * Test connection to VCPToolBox (CORE-062)
   * Tests connection and updates status
   */
  async testConnection(): Promise<boolean> {
    try {
      this.setConnectionStatus(ConnectionStatus.Connecting);

      // Single attempt test with 10s timeout
      const response = await this.executeWithRetry(async () => {
        const url = this.getBackendUrl();
        const apiKey = this.getApiKey();

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }

        return await response.json();
      }, {
        maxAttempts: 1,  // Only one attempt for test
        initialDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1
      });

      this.setConnectionStatus(ConnectionStatus.Connected);
      console.log('[ApiClient] Connection test successful');
      return true;
    } catch (error: any) {
      this.setConnectionStatus(ConnectionStatus.Error);
      console.error('[ApiClient] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get available models list from backend
   * Now with automatic retry (CORE-063)
   */
  async listModels(): Promise<ModelInfo[]> {
    return await this.executeWithRetry(async () => {
      // Replace /v1/chat/completions with /v1/models
      const baseUrl = this.getBackendUrl();
      const modelsUrl = baseUrl.replace('/v1/chat/completions', '/v1/models');
      const apiKey = this.getApiKey();

      console.log('[ApiClient] Fetching models from:', modelsUrl);

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        throw error;
      }

      const data: ModelsListResponse = await response.json();
      console.log('[ApiClient] Received models:', data.data?.length || 0);
      return data.data || [];
    });
  }
}

/**
 * Singleton API client instance
 */
let apiClientInstance: APIClient | null = null;

/**
 * Initialize API client with configuration
 */
export function initAPIClient(config: APIClientConfig): APIClient {
  apiClientInstance = new APIClient(config);
  return apiClientInstance;
}

/**
 * Get the singleton API client instance
 */
export function getAPIClient(): APIClient {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Call initAPIClient() first.');
  }
  return apiClientInstance;
}
