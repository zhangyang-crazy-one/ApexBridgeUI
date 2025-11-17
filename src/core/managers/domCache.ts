/**
 * DOM Cache Manager
 *
 * Provides efficient DOM element caching with automatic garbage collection
 * using WeakMap for memory management.
 *
 * Features:
 * - WeakMap-based caching for automatic GC
 * - Message-to-DOM element mapping
 * - Cache invalidation for streaming updates
 * - Memory-efficient cleanup
 *
 * CORE-012A: DOM caching with WeakMap for automatic GC
 */

import { Message } from '../models/message';

/**
 * Cache entry containing DOM element and metadata
 */
interface CacheEntry {
  element: HTMLElement;
  version: number;          // Track content version for invalidation
  timestamp: number;        // Creation timestamp
  height?: number;          // Cached height for virtual scrolling
}

/**
 * DOM Cache Manager using WeakMap for automatic garbage collection
 */
export class DOMCacheManager {
  private static instance: DOMCacheManager;

  // WeakMap: When Message object is garbage collected, entry is auto-removed
  private domCache: WeakMap<Message, CacheEntry> = new WeakMap();

  // String ID to Message object mapping (for lookup by ID)
  private messageIndex: Map<string, Message> = new Map();

  // Statistics for monitoring
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    creations: 0
  };

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DOMCacheManager {
    if (!DOMCacheManager.instance) {
      DOMCacheManager.instance = new DOMCacheManager();
    }
    return DOMCacheManager.instance;
  }

  /**
   * Register a message in the index
   */
  public registerMessage(message: Message): void {
    this.messageIndex.set(message.id, message);
  }

  /**
   * Unregister a message from the index
   */
  public unregisterMessage(messageId: string): void {
    this.messageIndex.delete(messageId);
  }

  /**
   * Get cached DOM element by message object
   */
  public get(message: Message): HTMLElement | null {
    const entry = this.domCache.get(message);

    if (entry) {
      this.stats.hits++;
      return entry.element;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Get cached DOM element by message ID
   */
  public getById(messageId: string): HTMLElement | null {
    const message = this.messageIndex.get(messageId);
    if (!message) {
      return null;
    }

    return this.get(message);
  }

  /**
   * Set cached DOM element for message
   */
  public set(message: Message, element: HTMLElement, version = 0): void {
    const entry: CacheEntry = {
      element,
      version,
      timestamp: Date.now()
    };

    this.domCache.set(message, entry);
    this.registerMessage(message);
    this.stats.creations++;
  }

  /**
   * Update cached element with new version (for streaming)
   */
  public update(message: Message, element: HTMLElement, version: number): void {
    const existingEntry = this.domCache.get(message);

    if (existingEntry && version <= existingEntry.version) {
      // Don't update with older version
      return;
    }

    const entry: CacheEntry = {
      element,
      version,
      timestamp: Date.now(),
      height: existingEntry?.height // Preserve height cache
    };

    this.domCache.set(message, entry);
  }

  /**
   * Invalidate cached element for message (force re-render)
   */
  public invalidate(message: Message): void {
    this.domCache.delete(message);
    this.stats.invalidations++;
  }

  /**
   * Invalidate by message ID
   */
  public invalidateById(messageId: string): void {
    const message = this.messageIndex.get(messageId);
    if (message) {
      this.invalidate(message);
    }
  }

  /**
   * Check if message has cached element
   */
  public has(message: Message): boolean {
    return this.domCache.has(message);
  }

  /**
   * Check by message ID
   */
  public hasById(messageId: string): boolean {
    const message = this.messageIndex.get(messageId);
    return message ? this.has(message) : false;
  }

  /**
   * Get cache entry version (for change detection)
   */
  public getVersion(message: Message): number {
    const entry = this.domCache.get(message);
    return entry ? entry.version : -1;
  }

  /**
   * Cache height for virtual scrolling optimization
   */
  public cacheHeight(message: Message, height: number): void {
    const entry = this.domCache.get(message);

    if (entry) {
      entry.height = height;
    }
  }

  /**
   * Get cached height
   */
  public getHeight(message: Message): number | undefined {
    const entry = this.domCache.get(message);
    return entry?.height;
  }

  /**
   * Get cached height by ID
   */
  public getHeightById(messageId: string): number | undefined {
    const message = this.messageIndex.get(messageId);
    return message ? this.getHeight(message) : undefined;
  }

  /**
   * Clear all message index entries (WeakMap auto-clears when Messages are GC'd)
   */
  public clearIndex(): void {
    this.messageIndex.clear();
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    hits: number;
    misses: number;
    invalidations: number;
    creations: number;
    hitRate: number;
    indexSize: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate,
      indexSize: this.messageIndex.size
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      creations: 0
    };
  }

  /**
   * Clone element for reuse (prevents reference issues)
   */
  public cloneElement(element: HTMLElement): HTMLElement {
    return element.cloneNode(true) as HTMLElement;
  }

  /**
   * Batch invalidate multiple messages
   */
  public invalidateMany(messages: Message[]): void {
    for (const message of messages) {
      this.invalidate(message);
    }
  }

  /**
   * Batch invalidate by IDs
   */
  public invalidateManyById(messageIds: string[]): void {
    for (const id of messageIds) {
      this.invalidateById(id);
    }
  }
}

/**
 * Factory function to get DOMCacheManager instance
 */
export function getDOMCache(): DOMCacheManager {
  return DOMCacheManager.getInstance();
}

/**
 * Convenience function to cache element
 */
export function cacheElement(message: Message, element: HTMLElement, version = 0): void {
  getDOMCache().set(message, element, version);
}

/**
 * Convenience function to get cached element
 */
export function getCachedElement(message: Message): HTMLElement | null {
  return getDOMCache().get(message);
}

/**
 * Convenience function to invalidate cache
 */
export function invalidateCache(message: Message): void {
  getDOMCache().invalidate(message);
}
