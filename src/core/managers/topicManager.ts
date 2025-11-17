/**
 * TopicManager - Manages conversation topics (CRUD operations)
 * Responsibilities:
 * - Create new topics
 * - List topics for an agent/group
 * - Rename topics
 * - Delete topics
 * - Auto-generate titles from first message
 */

import { readConversation, writeConversation, deleteConversation, listTopics as listTopicsIPC } from '../ipc/commands';
import type { Topic, Message, Agent, Group } from '../models';

export interface CreateTopicOptions {
  owner: Agent | Group;
  title?: string;
  firstMessage?: Message;
}

export class TopicManager {
  private activeTopic: Topic | null = null;

  /**
   * Create a new topic
   */
  async createTopic(options: CreateTopicOptions): Promise<Topic> {
    const { owner, title, firstMessage } = options;

    const topic: Topic = {
      id: this.generateUUID(),
      owner_id: owner.id,
      owner_type: 'agent' in owner && owner.system_prompt !== undefined ? 'agent' : 'group',
      title: title || 'New Conversation',
      messages: firstMessage ? [firstMessage] : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-generate title from first message if provided
    if (firstMessage && !title) {
      topic.title = this.generateTitle(firstMessage.content);
    }

    // Save topic (dual persistence: Tauri + localStorage)
    try {
      await writeConversation(topic);
      console.log('[TopicManager] Topic saved to Tauri backend:', topic.id);
    } catch (error) {
      console.warn('[TopicManager] Tauri save failed (expected in browser mode):', error);
    }

    // Always save to localStorage as fallback/primary storage in browser mode
    try {
      const storageKey = `vcpchat-topic-${topic.id}`;
      localStorage.setItem(storageKey, JSON.stringify(topic));
      console.log('[TopicManager] Topic saved to localStorage:', topic.id);
    } catch (error) {
      console.error('[TopicManager] localStorage save failed:', error);
      throw error;
    }

    console.log('[TopicManager] Topic created:', topic.id, topic.title);
    return topic;
  }

  /**
   * List all topics for an agent or group
   */
  async listTopics(ownerId: string): Promise<Topic[]> {
    try {
      const topics = await listTopicsIPC(ownerId);

      // Sort by updated_at (newest first)
      topics.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return dateB - dateA;
      });

      console.log('[TopicManager] Listed', topics.length, 'topics for', ownerId);
      return topics;
    } catch (error) {
      console.error('[TopicManager] Failed to list topics:', error);
      return [];
    }
  }

  /**
   * Load a single topic
   */
  async loadTopic(topicId: string): Promise<Topic> {
    try {
      const topic = await readConversation(topicId);
      console.log('[TopicManager] Topic loaded:', topic.id, topic.title);
      return topic;
    } catch (error) {
      console.error('[TopicManager] Failed to load topic:', error);
      throw error;
    }
  }

  /**
   * Rename a topic
   */
  async renameTopic(topicId: string, newTitle: string): Promise<void> {
    if (!newTitle || newTitle.trim().length === 0) {
      throw new Error('Topic title cannot be empty');
    }

    if (newTitle.length > 100) {
      throw new Error('Topic title cannot exceed 100 characters');
    }

    try {
      // Load topic
      const topic = await readConversation(topicId);

      // Update title
      topic.title = newTitle.trim();
      topic.updated_at = new Date().toISOString();

      // Save (dual persistence: Tauri + localStorage)
      try {
        await writeConversation(topic);
        console.log('[TopicManager] Topic renamed in Tauri backend:', topicId);
      } catch (error) {
        console.warn('[TopicManager] Tauri save failed (expected in browser mode):', error);
      }

      // Always save to localStorage as fallback/primary storage in browser mode
      try {
        const storageKey = `vcpchat-topic-${topic.id}`;
        localStorage.setItem(storageKey, JSON.stringify(topic));
        console.log('[TopicManager] Topic renamed in localStorage:', topicId);
      } catch (error) {
        console.error('[TopicManager] localStorage save failed:', error);
        throw error;
      }

      console.log('[TopicManager] Topic renamed:', topicId, newTitle);
    } catch (error) {
      console.error('[TopicManager] Failed to rename topic:', error);
      throw error;
    }
  }

  /**
   * Delete a topic
   */
  async deleteTopic(topicId: string): Promise<void> {
    try {
      await deleteConversation(topicId);

      // Clear active topic if it's the one being deleted
      if (this.activeTopic?.id === topicId) {
        this.activeTopic = null;
      }

      console.log('[TopicManager] Topic deleted:', topicId);
    } catch (error) {
      console.error('[TopicManager] Failed to delete topic:', error);
      throw error;
    }
  }

  /**
   * Set the currently active topic
   */
  setActiveTopic(topic: Topic | null): void {
    this.activeTopic = topic;
    console.log('[TopicManager] Active topic set:', topic?.id || 'none');
  }

  /**
   * Get the currently active topic
   */
  getActiveTopic(): Topic | null {
    return this.activeTopic;
  }

  /**
   * Update topic title from first user message (if still "New Conversation")
   */
  async updateTitleFromFirstMessage(topic: Topic): Promise<void> {
    if (topic.title !== 'New Conversation') {
      return; // Already has custom title
    }

    const firstUserMessage = topic.messages.find(m => m.sender === 'user');
    if (!firstUserMessage) {
      return; // No user messages yet
    }

    const newTitle = this.generateTitle(firstUserMessage.content);
    if (newTitle === topic.title) {
      return; // Title unchanged
    }

    topic.title = newTitle;
    topic.updated_at = new Date().toISOString();

    // Save (dual persistence: Tauri + localStorage)
    try {
      await writeConversation(topic);
      console.log('[TopicManager] Title auto-updated in Tauri backend:', topic.id);
    } catch (error) {
      console.warn('[TopicManager] Tauri save failed (expected in browser mode):', error);
    }

    // Always save to localStorage as fallback/primary storage in browser mode
    try {
      const storageKey = `vcpchat-topic-${topic.id}`;
      localStorage.setItem(storageKey, JSON.stringify(topic));
      console.log('[TopicManager] Title auto-updated in localStorage:', topic.id);
      console.log('[TopicManager] Title auto-updated:', topic.id, newTitle);
    } catch (error) {
      console.error('[TopicManager] Failed to auto-update title:', error);
    }
  }

  /**
   * Generate a topic title from message content
   * Algorithm: Take first 50 characters, truncate at word boundary
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
   * Get topic count for an owner
   */
  async getTopicCount(ownerId: string): Promise<number> {
    try {
      const topics = await listTopicsIPC(ownerId);
      return topics.length;
    } catch (error) {
      console.error('[TopicManager] Failed to get topic count:', error);
      return 0;
    }
  }

  /**
   * Search topics by title or content
   */
  async searchTopics(ownerId: string, query: string): Promise<Topic[]> {
    if (!query || query.trim().length === 0) {
      return this.listTopics(ownerId);
    }

    try {
      const allTopics = await listTopicsIPC(ownerId);
      const lowerQuery = query.toLowerCase();

      const matchingTopics = allTopics.filter(topic => {
        // Check title
        if (topic.title.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Check message content
        return topic.messages.some(msg =>
          msg.content.toLowerCase().includes(lowerQuery)
        );
      });

      // Sort by updated_at (newest first)
      matchingTopics.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return dateB - dateA;
      });

      console.log('[TopicManager] Search found', matchingTopics.length, 'topics for query:', query);
      return matchingTopics;
    } catch (error) {
      console.error('[TopicManager] Search failed:', error);
      return [];
    }
  }
}
