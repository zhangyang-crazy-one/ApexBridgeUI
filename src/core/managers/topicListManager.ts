/**
 * TopicListManager (CORE-053)
 *
 * Topic List Management with Search and Filtering
 *
 * Responsibilities:
 * - Create, read, update, delete conversation topics
 * - Manage topic list in memory for specific owners (agent/group)
 * - Persist topics to AppData/conversations/ via Tauri backend
 * - Validate topic data before operations (using validateTopic)
 * - Track active topic
 * - Provide advanced search and filtering capabilities
 * - Auto-generate titles from first message
 * - localStorage fallback for web debug mode
 *
 * Features:
 * - Complete CRUD operations
 * - In-memory caching for fast access
 * - Automatic validation using validateTopic()
 * - Tauri backend persistence with localStorage fallback
 * - Search by title and message content
 * - Filter by owner (agent/group)
 * - Filter by date range
 * - Sort by update time / creation time
 * - Active topic tracking
 * - Event notifications for topic changes
 * - Singleton pattern for centralized management
 *
 * Usage:
 * ```typescript
 * import { TopicListManager } from './core/managers/topicListManager';
 *
 * const manager = TopicListManager.getInstance();
 *
 * // Create new topic
 * const topic = await manager.createTopic({
 *   owner_id: 'agent-1',
 *   owner_type: 'agent',
 *   title: 'AI Discussion',
 *   messages: []
 * });
 *
 * // Get topic by ID
 * const topic = await manager.getTopic(topicId);
 *
 * // Update topic
 * await manager.updateTopic(topicId, { title: 'New Title' });
 *
 * // Delete topic
 * await manager.deleteTopic(topicId);
 *
 * // List topics for an owner
 * const topics = await manager.listTopicsByOwner('agent-1', 'agent');
 *
 * // Search topics
 * const results = await manager.searchTopics('agent-1', 'agent', 'query');
 * ```
 */

import { readConversation, writeConversation, deleteConversation, listTopics as listTopicsIPC } from '../ipc/commands';
import { Topic, validateTopic, OwnerType } from '../models/topic';
import { Message } from '../models/message';

export interface CreateTopicOptions {
  owner_id: string;
  owner_type: OwnerType;
  title?: string;
  messages?: Message[];
}

export interface UpdateTopicOptions {
  title?: string;
  messages?: Message[];
}

export interface TopicMetadata {
  id: string;
  title: string;
  owner_id: string;
  owner_type: OwnerType;
  message_count: number;
  last_message_preview?: string;
  created_at: string;
  updated_at: string;
}

export interface TopicSearchResult extends TopicMetadata {
  matchReason: 'title' | 'content';
  matchSnippet?: string;
}

export class TopicListManager {
  private static instance: TopicListManager;
  private topics: Map<string, Topic> = new Map();
  private ownerTopicsLoaded: Map<string, boolean> = new Map(); // Track which owners have been loaded
  private activeTopicId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TopicListManager {
    if (!TopicListManager.instance) {
      TopicListManager.instance = new TopicListManager();
    }
    return TopicListManager.instance;
  }

  /**
   * Ensure topics for a specific owner are loaded from persistence
   */
  private async ensureOwnerLoaded(ownerId: string, ownerType: OwnerType): Promise<void> {
    const ownerKey = `${ownerType}:${ownerId}`;

    if (this.ownerTopicsLoaded.get(ownerKey)) {
      return;
    }

    console.log(`[TopicListManager] Loading topics for ${ownerKey}...`);

    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        const topicList = await listTopicsIPC(ownerId, ownerType);
        console.log(`[TopicListManager] Loaded ${topicList.length} topics from Tauri backend for ${ownerKey}`);

        for (const topic of topicList) {
          this.topics.set(topic.id, topic);
        }

        this.ownerTopicsLoaded.set(ownerKey, true);
        return;
      } catch (error) {
        console.warn(`[TopicListManager] Tauri backend load failed for ${ownerKey}, falling back to localStorage:`, error);
      }
    }

    // Fallback to localStorage (web mode or Tauri error)
    this.loadOwnerFromLocalStorage(ownerId, ownerType);
    this.ownerTopicsLoaded.set(ownerKey, true);
  }

  /**
   * Load topics for an owner from localStorage
   */
  private loadOwnerFromLocalStorage(ownerId: string, ownerType: OwnerType): void {
    const storageKey = `vcpchat-topics-${ownerType}-${ownerId}`;
    const topicsJson = localStorage.getItem(storageKey);

    if (topicsJson) {
      try {
        const topicList: Topic[] = JSON.parse(topicsJson);
        for (const topic of topicList) {
          this.topics.set(topic.id, topic);
        }
        console.log(`[TopicListManager] Loaded ${topicList.length} topics from localStorage for ${ownerType}:${ownerId}`);
      } catch (error) {
        console.error('[TopicListManager] Failed to parse localStorage topics:', error);
      }
    }
  }

  /**
   * Save topics for an owner to localStorage (fallback persistence)
   */
  private saveOwnerToLocalStorage(ownerId: string, ownerType: OwnerType): void {
    const ownerTopics = Array.from(this.topics.values()).filter(
      topic => topic.owner_id === ownerId && topic.owner_type === ownerType
    );

    const storageKey = `vcpchat-topics-${ownerType}-${ownerId}`;
    localStorage.setItem(storageKey, JSON.stringify(ownerTopics));
    console.log(`[TopicListManager] Saved ${ownerTopics.length} topics to localStorage for ${ownerType}:${ownerId}`);
  }

  /**
   * Generate UUID (RFC 4122 v4)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate topic title from first message content
   */
  private generateTitle(content: string): string {
    if (!content || content.trim().length === 0) {
      return 'New Conversation';
    }

    let title = content.trim();

    // Remove markdown formatting
    title = title.replace(/[#*_`~]/g, '');

    // Truncate to 50 characters
    if (title.length > 50) {
      title = title.substring(0, 50);

      // Truncate at word boundary
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 30) {
        title = title.substring(0, lastSpace);
      }

      title += '...';
    }

    // Remove newlines
    title = title.replace(/\n/g, ' ');

    // Collapse multiple spaces
    title = title.replace(/\s+/g, ' ');

    return title.trim() || 'New Conversation';
  }

  /**
   * Create new topic
   *
   * @param options - Topic creation options
   * @returns Created topic
   * @throws Error if validation fails or creation fails
   */
  public async createTopic(options: CreateTopicOptions): Promise<Topic> {
    const now = new Date().toISOString();

    const topic: Topic = {
      id: this.generateUUID(),
      owner_id: options.owner_id,
      owner_type: options.owner_type,
      title: options.title || 'New Conversation',
      messages: options.messages || [],
      created_at: now,
      updated_at: now
    };

    // Auto-generate title from first message if not provided
    if (!options.title && topic.messages.length > 0) {
      const firstMessage = topic.messages[0];
      topic.title = this.generateTitle(firstMessage.content);
    }

    // Validate topic data
    const validationError = validateTopic(topic);
    if (validationError) {
      throw new Error(`Topic validation failed: ${validationError}`);
    }

    // Add to in-memory cache
    this.topics.set(topic.id, topic);

    // Mark owner as loaded
    const ownerKey = `${topic.owner_type}:${topic.owner_id}`;
    this.ownerTopicsLoaded.set(ownerKey, true);

    // Persist to backend
    await this.persistTopic(topic);

    // Dispatch event
    this.dispatchTopicEvent('topic-created', topic);

    console.log(`[TopicListManager] Created topic: ${topic.id} (${topic.title})`);
    return { ...topic, messages: [...topic.messages] };
  }

  /**
   * Get topic by ID
   *
   * @param topicId - Topic ID
   * @returns Topic or null if not found
   */
  public async getTopic(topicId: string): Promise<Topic | null> {
    // Try in-memory cache first
    let topic = this.topics.get(topicId);
    if (topic) {
      return { ...topic, messages: [...topic.messages] }; // Return defensive copy
    }

    // Try loading from persistence
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        topic = await readConversation(topicId);
        this.topics.set(topicId, topic);
        console.log(`[TopicListManager] Loaded topic from Tauri backend: ${topicId}`);
        return { ...topic, messages: [...topic.messages] };
      } catch (error) {
        console.warn(`[TopicListManager] Failed to load topic ${topicId} from Tauri:`, error);
      }
    }

    // Not found
    console.warn(`[TopicListManager] Topic not found: ${topicId}`);
    return null;
  }

  /**
   * Update topic
   *
   * @param topicId - Topic ID
   * @param updates - Partial topic updates
   * @returns Updated topic
   * @throws Error if topic not found or validation fails
   */
  public async updateTopic(topicId: string, updates: UpdateTopicOptions): Promise<Topic> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    // Apply updates
    const updatedTopic: Topic = {
      ...topic,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Validate updated topic
    const validationError = validateTopic(updatedTopic);
    if (validationError) {
      throw new Error(`Topic validation failed: ${validationError}`);
    }

    // Update in-memory cache
    this.topics.set(topicId, updatedTopic);

    // Persist to backend
    await this.persistTopic(updatedTopic);

    // Dispatch event
    this.dispatchTopicEvent('topic-updated', updatedTopic);

    console.log(`[TopicListManager] Updated topic: ${topicId}`);
    return { ...updatedTopic, messages: [...updatedTopic.messages] };
  }

  /**
   * Delete topic
   *
   * @param topicId - Topic ID
   * @throws Error if topic not found
   */
  public async deleteTopic(topicId: string): Promise<void> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    // Remove from in-memory cache
    this.topics.delete(topicId);

    // Clear active topic if it's the deleted one
    if (this.activeTopicId === topicId) {
      this.activeTopicId = null;
    }

    // Delete from persistence
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        await deleteConversation(topicId, topic.owner_type);
        console.log(`[TopicListManager] Deleted topic from Tauri backend: ${topicId}`);
      } catch (error) {
        console.warn(`[TopicListManager] Failed to delete topic ${topicId} from Tauri:`, error);
      }
    }

    // Always update localStorage
    this.saveOwnerToLocalStorage(topic.owner_id, topic.owner_type);

    // Dispatch event
    this.dispatchTopicEvent('topic-deleted', topic);

    console.log(`[TopicListManager] Deleted topic: ${topicId}`);
  }

  /**
   * List topics for a specific owner
   *
   * @param ownerId - Owner ID (agent or group)
   * @param ownerType - Owner type ('agent' or 'group')
   * @returns Array of topics sorted by update time (newest first)
   */
  public async listTopicsByOwner(ownerId: string, ownerType: OwnerType): Promise<Topic[]> {
    await this.ensureOwnerLoaded(ownerId, ownerType);

    const ownerTopics = Array.from(this.topics.values()).filter(
      topic => topic.owner_id === ownerId && topic.owner_type === ownerType
    );

    // Sort by updated_at (newest first)
    ownerTopics.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return ownerTopics.map(topic => ({ ...topic, messages: [...topic.messages] }));
  }

  /**
   * Get topic metadata list for UI display
   *
   * @param ownerId - Owner ID
   * @param ownerType - Owner type
   * @returns Array of topic metadata
   */
  public async getTopicMetadataList(ownerId: string, ownerType: OwnerType): Promise<TopicMetadata[]> {
    await this.ensureOwnerLoaded(ownerId, ownerType);

    const metadata: TopicMetadata[] = [];

    for (const topic of this.topics.values()) {
      if (topic.owner_id === ownerId && topic.owner_type === ownerType) {
        const lastMessage = topic.messages.length > 0
          ? topic.messages[topic.messages.length - 1]
          : undefined;

        metadata.push({
          id: topic.id,
          title: topic.title,
          owner_id: topic.owner_id,
          owner_type: topic.owner_type,
          message_count: topic.messages.length,
          last_message_preview: lastMessage?.content.substring(0, 100),
          created_at: topic.created_at,
          updated_at: topic.updated_at
        });
      }
    }

    // Sort by updated_at (newest first)
    metadata.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return metadata;
  }

  /**
   * Search topics by title or message content
   *
   * @param ownerId - Owner ID
   * @param ownerType - Owner type
   * @param query - Search query (case-insensitive)
   * @returns Array of matching topics with search metadata
   */
  public async searchTopics(
    ownerId: string,
    ownerType: OwnerType,
    query: string
  ): Promise<TopicSearchResult[]> {
    await this.ensureOwnerLoaded(ownerId, ownerType);

    const lowerQuery = query.toLowerCase();
    const results: TopicSearchResult[] = [];

    for (const topic of this.topics.values()) {
      if (topic.owner_id !== ownerId || topic.owner_type !== ownerType) {
        continue;
      }

      // Check title match
      if (topic.title.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: topic.id,
          title: topic.title,
          owner_id: topic.owner_id,
          owner_type: topic.owner_type,
          message_count: topic.messages.length,
          created_at: topic.created_at,
          updated_at: topic.updated_at,
          matchReason: 'title',
          matchSnippet: topic.title
        });
        continue;
      }

      // Check message content match
      for (const message of topic.messages) {
        if (message.content.toLowerCase().includes(lowerQuery)) {
          const matchIndex = message.content.toLowerCase().indexOf(lowerQuery);
          const snippetStart = Math.max(0, matchIndex - 50);
          const snippetEnd = Math.min(message.content.length, matchIndex + query.length + 50);
          const snippet = '...' + message.content.substring(snippetStart, snippetEnd) + '...';

          results.push({
            id: topic.id,
            title: topic.title,
            owner_id: topic.owner_id,
            owner_type: topic.owner_type,
            message_count: topic.messages.length,
            created_at: topic.created_at,
            updated_at: topic.updated_at,
            matchReason: 'content',
            matchSnippet: snippet
          });
          break; // Only include topic once even if multiple messages match
        }
      }
    }

    // Sort by relevance (title matches first, then by update time)
    results.sort((a, b) => {
      if (a.matchReason !== b.matchReason) {
        return a.matchReason === 'title' ? -1 : 1;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return results;
  }

  /**
   * Filter topics by date range
   *
   * @param ownerId - Owner ID
   * @param ownerType - Owner type
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Array of topics within date range
   */
  public async filterByDateRange(
    ownerId: string,
    ownerType: OwnerType,
    startDate: Date,
    endDate: Date
  ): Promise<Topic[]> {
    await this.ensureOwnerLoaded(ownerId, ownerType);

    const results: Topic[] = [];

    for (const topic of this.topics.values()) {
      if (topic.owner_id !== ownerId || topic.owner_type !== ownerType) {
        continue;
      }

      const topicDate = new Date(topic.updated_at);
      if (topicDate >= startDate && topicDate <= endDate) {
        results.push({ ...topic, messages: [...topic.messages] });
      }
    }

    // Sort by updated_at (newest first)
    results.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return results;
  }

  /**
   * Get active topic
   *
   * @returns Active topic or null
   */
  public async getActiveTopic(): Promise<Topic | null> {
    if (!this.activeTopicId) {
      return null;
    }
    return await this.getTopic(this.activeTopicId);
  }

  /**
   * Set active topic
   *
   * @param topicId - Topic ID
   * @throws Error if topic not found
   */
  public async setActiveTopic(topicId: string): Promise<void> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      // Try to load it
      const loadedTopic = await this.getTopic(topicId);
      if (!loadedTopic) {
        throw new Error(`Topic not found: ${topicId}`);
      }
    }

    this.activeTopicId = topicId;

    // Save to localStorage
    localStorage.setItem('vcpchat-active-topic', topicId);

    console.log(`[TopicListManager] Set active topic: ${topicId}`);
  }

  /**
   * Clear active topic
   */
  public clearActiveTopic(): void {
    this.activeTopicId = null;
    localStorage.removeItem('vcpchat-active-topic');
    console.log('[TopicListManager] Cleared active topic');
  }

  /**
   * Get topic count for an owner
   *
   * @param ownerId - Owner ID
   * @param ownerType - Owner type
   * @returns Number of topics
   */
  public async getTopicCount(ownerId: string, ownerType: OwnerType): Promise<number> {
    await this.ensureOwnerLoaded(ownerId, ownerType);

    let count = 0;
    for (const topic of this.topics.values()) {
      if (topic.owner_id === ownerId && topic.owner_type === ownerType) {
        count++;
      }
    }

    return count;
  }

  /**
   * Check if topic exists
   *
   * @param topicId - Topic ID
   * @returns True if topic exists
   */
  public hasTopic(topicId: string): boolean {
    return this.topics.has(topicId);
  }

  /**
   * Persist topic to backend
   */
  private async persistTopic(topic: Topic): Promise<void> {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        await writeConversation(topic);
        console.log(`[TopicListManager] Saved topic to Tauri backend: ${topic.id}`);
      } catch (error) {
        console.warn('[TopicListManager] Tauri save failed, falling back to localStorage:', error);
        this.saveOwnerToLocalStorage(topic.owner_id, topic.owner_type);
      }
    } else {
      // Web debug mirror mode - use localStorage only
      this.saveOwnerToLocalStorage(topic.owner_id, topic.owner_type);
    }
  }

  /**
   * Dispatch topic event
   */
  private dispatchTopicEvent(eventName: string, topic: Topic): void {
    const event = new CustomEvent(eventName, {
      detail: {
        topicId: topic.id,
        topicTitle: topic.title,
        ownerId: topic.owner_id,
        ownerType: topic.owner_type,
        topic: { ...topic, messages: [...topic.messages] }
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Load active topic ID from localStorage
   */
  public loadPersistedState(): void {
    const activeId = localStorage.getItem('vcpchat-active-topic');
    if (activeId) {
      this.activeTopicId = activeId;
      console.log(`[TopicListManager] Restored active topic: ${activeId}`);
    }
  }

  /**
   * Clear all topics for an owner (for testing/reset)
   */
  public async clearOwnerTopics(ownerId: string, ownerType: OwnerType): Promise<void> {
    const ownerTopicIds: string[] = [];

    for (const [topicId, topic] of this.topics.entries()) {
      if (topic.owner_id === ownerId && topic.owner_type === ownerType) {
        ownerTopicIds.push(topicId);
      }
    }

    for (const topicId of ownerTopicIds) {
      this.topics.delete(topicId);
    }

    const ownerKey = `${ownerType}:${ownerId}`;
    this.ownerTopicsLoaded.delete(ownerKey);

    const storageKey = `vcpchat-topics-${ownerType}-${ownerId}`;
    localStorage.removeItem(storageKey);

    if (this.activeTopicId && ownerTopicIds.includes(this.activeTopicId)) {
      this.activeTopicId = null;
      localStorage.removeItem('vcpchat-active-topic');
    }

    console.log(`[TopicListManager] Cleared ${ownerTopicIds.length} topics for ${ownerKey}`);
  }

  /**
   * Clear all topics (for testing/reset)
   */
  public clearAllTopics(): void {
    this.topics.clear();
    this.ownerTopicsLoaded.clear();
    this.activeTopicId = null;

    // Clear localStorage (we don't know all possible keys, so this is best effort)
    localStorage.removeItem('vcpchat-active-topic');

    console.log('[TopicListManager] Cleared all topics');
  }

  /**
   * Clear cache for a specific owner
   */
  public clearOwnerCache(ownerId: string, ownerType: OwnerType): void {
    const ownerTopicIds: string[] = [];

    for (const [topicId, topic] of this.topics.entries()) {
      if (topic.owner_id === ownerId && topic.owner_type === ownerType) {
        ownerTopicIds.push(topicId);
      }
    }

    for (const topicId of ownerTopicIds) {
      this.topics.delete(topicId);
    }

    const ownerKey = `${ownerType}:${ownerId}`;
    this.ownerTopicsLoaded.delete(ownerKey);

    console.log(`[TopicListManager] Cache cleared for ${ownerKey}`);
  }
}

/**
 * Initialize TopicListManager and export singleton instance
 */
export function initTopicListManager(): TopicListManager {
  const manager = TopicListManager.getInstance();
  manager.loadPersistedState();
  return manager;
}

/**
 * Helper function to format topic updated time for display
 */
export function formatTopicTime(updatedAt: string): string {
  const date = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
