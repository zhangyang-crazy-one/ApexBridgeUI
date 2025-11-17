/**
 * ChatManager - Manages active conversations and handles message streaming
 * Responsibilities:
 * - Send messages to VCPToolBox backend
 * - Handle streaming responses (SSE)
 * - Manage message state (pending, streaming, complete, error)
 * - CORE-012F: Message initialization state tracking (pending/ready/finalized)
 * - Auto-save conversations
 * - Parse VCP tool calls
 */

import { APIClient, getAPIClient } from '../services/apiClient';
import { writeConversation } from '../ipc/commands';
import { createStreamManager, StreamManager } from '../renderer/streamManager';
import type { Topic, Message, Agent, GlobalSettings } from '../models';
import {
  MessageState,
  transitionMessageState,
  markMessageReady,
  finalizeMessage,
  canRenderMessage,
  isMessageComplete
} from '../models/message';

export interface SendMessageOptions {
  agent: Agent;
  topic: Topic;
  userMessage: Message;
  groupContext?: { groupName: string; agentNames: string[] };  // Optional Group collaboration context
  streaming?: boolean;  // Optional streaming flag (defaults to agent.streaming or true)
  onStreamStart?: () => void;
  onStreamChunk?: (chunk: string, fullContent: string) => void;
  onStreamEnd?: (finalMessage: Message) => void;
  onError?: (error: Error) => void;
}

export class ChatManager {
  private static instance: ChatManager | null = null;
  private apiClient: APIClient;
  private settings: GlobalSettings;
  private activeStreams: Map<string, AbortController> = new Map();

  private constructor(settings: GlobalSettings) {
    this.settings = settings;
    // Use getAPIClient() instead of creating new instance
    this.apiClient = getAPIClient();
  }

  /**
   * Get singleton instance of ChatManager
   * @throws Error if not initialized via initChatManager()
   */
  public static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      throw new Error('ChatManager not initialized. Call initChatManager(settings) first.');
    }
    return ChatManager.instance;
  }

  /**
   * Update settings (e.g., when user changes API key or backend URL)
   * Note: APIClient is managed separately, this only updates local settings reference
   */
  updateSettings(settings: GlobalSettings) {
    this.settings = settings;
    // APIClient is already initialized and managed via initAPIClient/getAPIClient
    this.apiClient = getAPIClient();
  }

  /**
   * Send a message and handle streaming response
   */
  async sendMessage(options: SendMessageOptions): Promise<Message> {
    const { agent, topic, userMessage, groupContext, streaming, onStreamStart, onStreamChunk, onStreamEnd, onError } = options;

    // Determine if streaming is enabled (priority: options.streaming > agent.streaming > default true)
    const enableStreaming = streaming !== undefined ? streaming : (agent.streaming !== undefined ? agent.streaming : true);
    console.log('[ChatManager] Streaming enabled:', enableStreaming, '(from:', streaming !== undefined ? 'options' : agent.streaming !== undefined ? 'agent' : 'default', ')');

    // CORE-012F: User messages are immediately finalized
    if (!userMessage.state || userMessage.state === 'pending') {
      if (!userMessage.state) {
        userMessage.state = 'pending';
      }
      transitionMessageState(userMessage, 'ready');
      transitionMessageState(userMessage, 'finalized');
    }

    // Add user message to topic
    topic.messages.push(userMessage);

    // Create agent message placeholder (CORE-012F: starts in pending state)
    const agentMessage: Message = {
      id: this.generateUUID(),
      sender: 'agent',
      sender_id: agent.id,
      sender_name: agent.name,
      content: '',
      attachments: [],
      timestamp: new Date().toISOString(),
      is_streaming: enableStreaming,  // Use enableStreaming flag
      state: 'pending' // CORE-012F: Start in pending state
    };

    topic.messages.push(agentMessage);

    // Build conversation history for API
    const messages = this.buildConversationHistory(topic, agent, groupContext);
    console.log('[ChatManager] Built conversation history:', messages.length, 'messages');
    console.log('[ChatManager] User message attachments:', userMessage.attachments.length);
    if (groupContext) {
      console.log('[ChatManager] Group context:', groupContext.groupName, 'with agents:', groupContext.agentNames.join(', '));
    }

    // Create abort controller for this stream
    const abortController = new AbortController();
    this.activeStreams.set(agentMessage.id, abortController);

    try {
      // Call streaming API with StreamManager for pre-buffering and throttling
      onStreamStart?.();

      const startTime = Date.now();

      // Create StreamManager for this message
      const streamManager = createStreamManager({
        preBufferSize: 3,           // Buffer 3 chunks to prevent flicker
        throttleInterval: 100,       // Update UI at most every 100ms (10fps)
        maxQueueSize: 20,            // Merge chunks if queue grows beyond 20
        onChunk: (chunk, fullContent) => {
          // Update message content with StreamManager's fullContent (already merged)
          agentMessage.content = fullContent;

          // CORE-012F: Transition to ready state when first content arrives
          if (agentMessage.state === 'pending' && fullContent.length > 0) {
            markMessageReady(agentMessage);
          }

          // Pass individual chunk content and full content to UI
          onStreamChunk?.(chunk.content, fullContent);
        },
        onComplete: (fullContent) => {
          const endTime = Date.now();

          // Update final content
          agentMessage.content = fullContent;
          agentMessage.is_streaming = false;
          agentMessage.metadata = {
            tokens: this.estimateTokens(fullContent),
            model_used: agent.model,
            latency_ms: endTime - startTime,
          };

          // Parse VCP tool calls if any
          const toolCalls = this.apiClient.parseVCPToolCalls(fullContent);
          if (toolCalls.length > 0) {
            agentMessage.metadata.tool_calls = toolCalls.map(tc => ({
              tool_name: tc.tool_name,
              parameters: tc.parameters,
              result: undefined, // TODO: Execute tool calls
            }));
          }

          // CORE-012F: Finalize message when streaming completes
          finalizeMessage(agentMessage);

          onStreamEnd?.(agentMessage);
        },
        onError: (error) => {
          agentMessage.is_streaming = false;
          agentMessage.content = agentMessage.content || `Error: ${error.message}`;

          // CORE-012F: Finalize message even on error
          finalizeMessage(agentMessage);

          onError?.(error);
        },
      });

      // Start stream manager
      streamManager.start();

      // Call API client with StreamManager integration
      await this.apiClient.chatCompletionStream({
        messages,
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_output_tokens,
        stream: enableStreaming,  // 🔑 APPLY streaming setting from Agent/Group config
      }, {
        onChunk: (chunk) => {
          // Push raw chunk to StreamManager for buffering and throttling
          streamManager.push(chunk);
        },
        onComplete: () => {
          // Complete StreamManager (will flush remaining chunks)
          streamManager.complete();
        },
        onError: (error) => {
          // Propagate error to StreamManager
          streamManager.error(error);
        },
        signal: abortController.signal,
      });

      // Update topic timestamp
      topic.updated_at = new Date().toISOString();

      // Auto-save conversation
      await this.saveConversation(topic);

      return agentMessage;

    } catch (error) {
      console.error('[ChatManager] Send message error:', error);
      agentMessage.is_streaming = false;
      agentMessage.content = agentMessage.content || `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;

      // CORE-012F: Finalize message on exception
      finalizeMessage(agentMessage);

      onError?.(error instanceof Error ? error : new Error('Unknown error'));

      // Still save even on error
      await this.saveConversation(topic);

      return agentMessage;
    } finally {
      this.activeStreams.delete(agentMessage.id);
    }
  }

  /**
   * Stop a streaming message
   */
  stopStreaming(messageId: string): boolean {
    const controller = this.activeStreams.get(messageId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(messageId);
      return true;
    }
    return false;
  }

  /**
   * Load conversation from disk
   */
  async loadConversation(topicId: string): Promise<Topic> {
    const { readConversation } = await import('../ipc/commands');
    return await readConversation(topicId);
  }

  /**
   * CORE-017: Load conversation with pagination
   * Loads only a subset of messages for efficient initial loading
   *
   * @param topicId - Topic identifier
   * @param options - Pagination options
   * @returns Topic with paginated messages
   */
  async loadConversationPage(
    topicId: string,
    options: {
      limit?: number;      // Max messages to load (default: 50)
      offset?: number;     // Skip first N messages (default: 0)
      loadLatest?: boolean; // Load latest messages first (default: true)
    } = {}
  ): Promise<{ topic: Topic; hasMore: boolean; totalMessages: number }> {
    const { limit = 50, offset = 0, loadLatest = true } = options;

    // Load full conversation from disk
    const fullTopic = await this.loadConversation(topicId);

    const totalMessages = fullTopic.messages.length;

    // Calculate pagination
    let paginatedMessages: Message[];
    let hasMore: boolean;

    if (loadLatest) {
      // Load latest messages (from end of array)
      const startIndex = Math.max(0, totalMessages - offset - limit);
      const endIndex = totalMessages - offset;
      paginatedMessages = fullTopic.messages.slice(startIndex, endIndex);
      hasMore = startIndex > 0;
    } else {
      // Load oldest messages (from start of array)
      const startIndex = offset;
      const endIndex = Math.min(totalMessages, offset + limit);
      paginatedMessages = fullTopic.messages.slice(startIndex, endIndex);
      hasMore = endIndex < totalMessages;
    }

    return {
      topic: {
        ...fullTopic,
        messages: paginatedMessages
      },
      hasMore,
      totalMessages
    };
  }

  /**
   * CORE-017: Load older messages for infinite scroll
   * Appends older messages to existing conversation
   *
   * @param topicId - Topic identifier
   * @param currentOldestMessageIndex - Index of currently oldest loaded message
   * @param limit - Number of messages to load (default: 20)
   * @returns Older messages array
   */
  async getOlderMessages(
    topicId: string,
    currentOldestMessageIndex: number,
    limit: number = 20
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    // Load full conversation
    const fullTopic = await this.loadConversation(topicId);

    const totalMessages = fullTopic.messages.length;

    // Calculate range for older messages
    const endIndex = currentOldestMessageIndex;
    const startIndex = Math.max(0, endIndex - limit);

    if (startIndex >= endIndex) {
      return { messages: [], hasMore: false };
    }

    const olderMessages = fullTopic.messages.slice(startIndex, endIndex);
    const hasMore = startIndex > 0;

    return {
      messages: olderMessages,
      hasMore
    };
  }

  /**
   * CORE-017: Get message count without loading full conversation
   * Useful for displaying "X messages" before loading
   *
   * @param topicId - Topic identifier
   * @returns Total message count
   */
  async getMessageCount(topicId: string): Promise<number> {
    try {
      const topic = await this.loadConversation(topicId);
      return topic.messages.length;
    } catch (error) {
      console.error('[ChatManager] Failed to get message count:', error);
      return 0;
    }
  }

  /**
   * Save conversation to disk
   * Dual persistence: Try Tauri backend first, fallback to localStorage
   */
  async saveConversation(topic: Topic): Promise<void> {
    // Try Tauri backend first (will fail in browser mode)
    try {
      await writeConversation(topic);
      console.log('[ChatManager] Conversation saved to Tauri backend:', topic.id);
    } catch (error) {
      console.warn('[ChatManager] Tauri save failed (expected in browser mode):', error);
    }

    // Always save to localStorage as fallback/primary storage in browser mode
    try {
      const storageKey = `vcpchat-topic-${topic.id}`;
      localStorage.setItem(storageKey, JSON.stringify(topic));
      console.log('[ChatManager] Conversation saved to localStorage:', topic.id);
    } catch (error) {
      console.error('[ChatManager] localStorage save failed:', error);
      throw error;
    }
  }

  /**
   * Build conversation history for API request
   * Includes system prompt and recent messages within context limit
   * Supports multimodal content (text + images)
   */
  private buildConversationHistory(topic: Topic, agent: Agent, groupContext?: { groupName: string; agentNames: string[] }): Array<{
    role: string;
    content: string | Array<{type: string; text?: string; image_url?: {url: string}}>
  }> {
    const messages: Array<{
      role: string;
      content: string | Array<{type: string; text?: string; image_url?: {url: string}}>
    }> = [];

    // Add system prompt (with Group context if applicable)
    if (agent.system_prompt) {
      let systemPrompt = agent.system_prompt;

      // Add Group collaboration context for multi-agent scenarios
      if (groupContext) {
        systemPrompt += `\n\n[GROUP COLLABORATION CONTEXT]\nYou are currently in a group chat named "${groupContext.groupName}" with multiple AI agents: ${groupContext.agentNames.join(', ')}.\nEach agent will respond in sequence. Pay attention to what other agents say and build upon their responses.\nYour name is ${agent.name}. Make sure to acknowledge other agents' contributions when relevant.`;
      }

      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add conversation messages (respect context token limit)
    const contextLimit = agent.context_token_limit;
    let totalTokens = this.estimateTokens(agent.system_prompt);

    // Start from most recent and work backwards
    for (let i = topic.messages.length - 1; i >= 0; i--) {
      const msg = topic.messages[i];
      const msgTokens = this.estimateTokens(msg.content);

      // Stop if we exceed context limit
      if (totalTokens + msgTokens > contextLimit * 0.9) {
        console.log(`[ChatManager] Context limit reached, truncating history at message ${i + 1}/${topic.messages.length}`);
        break;
      }

      // Build message content (support attachments)
      let messageContent: string | Array<{type: string; text?: string; image_url?: {url: string}}>;

      if (msg.attachments && msg.attachments.length > 0) {
        // Has attachments: use multimodal format
        const contentParts: Array<{type: string; text?: string; image_url?: {url: string}}> = [];

        // Add text content
        if (msg.content) {
          contentParts.push({
            type: 'text',
            text: msg.content
          });
        }

        // Add image attachments
        for (const attachment of msg.attachments) {
          if (attachment.file_type === 'image') {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: attachment.file_path_or_base64
              }
            });
          }
          // Note: Video, audio, PDF attachments not supported yet (requires backend API support)
        }

        messageContent = contentParts;
        console.log(`[ChatManager] Message with ${msg.attachments.length} attachments (${contentParts.length - 1} images)`);
      } else {
        // No attachments: use plain text format
        messageContent = msg.content;
      }

      messages.unshift({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: messageContent,
      });

      totalTokens += msgTokens;
    }

    return messages;
  }

  /**
   * Estimate token count (rough approximation)
   * Real tokenization requires model-specific tokenizer
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * CORE-012F: Get messages by state from a topic
   */
  getMessagesByState(topic: Topic, state: MessageState): Message[] {
    return topic.messages.filter(m => m.state === state);
  }

  /**
   * CORE-012F: Get pending messages count
   */
  getPendingMessagesCount(topic: Topic): number {
    return topic.messages.filter(m => m.state === 'pending').length;
  }

  /**
   * CORE-012F: Check if topic has any pending messages
   */
  hasPendingMessages(topic: Topic): boolean {
    return topic.messages.some(m => m.state === 'pending');
  }

  /**
   * CORE-012F: Get all renderable messages (ready or finalized)
   */
  getRenderableMessages(topic: Topic): Message[] {
    return topic.messages.filter(m => canRenderMessage(m));
  }

  /**
   * CORE-012F: Check if all messages are complete
   */
  areAllMessagesComplete(topic: Topic): boolean {
    return topic.messages.every(m => isMessageComplete(m));
  }
}

/**
 * Initialize ChatManager singleton
 * @param settings - Global settings for API configuration
 * @returns ChatManager instance
 */
export function initChatManager(settings: GlobalSettings): ChatManager {
  if (!ChatManager.instance) {
    ChatManager.instance = new ChatManager(settings);
  }
  return ChatManager.instance;
}
