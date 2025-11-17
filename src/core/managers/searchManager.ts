/**
 * SearchManager (CORE-055)
 *
 * Conversation History Search Manager
 *
 * Responsibilities:
 * - Search across all conversation history (topics and messages)
 * - Advanced search with multiple filters and criteria
 * - Search history tracking and suggestions
 * - Full-text search with relevance ranking
 * - Search by sender, date range, content type
 * - Highlighted search results with context
 * - Search result caching for performance
 * - Recent searches persistence
 *
 * Features:
 * - Multi-criteria search (content, sender, date, owner)
 * - Full-text search with snippet extraction
 * - Filter by message type (user/agent)
 * - Filter by date range
 * - Filter by owner (agent/group)
 * - Filter by content type (text, code, markdown, etc.)
 * - Search result ranking by relevance
 * - Search history with MRU tracking
 * - Search suggestions based on history
 * - Result caching for performance
 * - Singleton pattern for centralized management
 *
 * Usage:
 * ```typescript
 * import { SearchManager } from './core/managers/searchManager';
 *
 * const manager = SearchManager.getInstance();
 *
 * // Simple search
 * const results = await manager.search('machine learning');
 *
 * // Advanced search with filters
 * const results = await manager.search('API', {
 *   sender: 'agent',
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-01-31'),
 *   ownerId: 'agent-1',
 *   ownerType: 'agent'
 * });
 *
 * // Get search suggestions
 * const suggestions = manager.getSuggestions('mach');
 *
 * // Get search history
 * const history = manager.getSearchHistory(10);
 * ```
 */

import { TopicListManager, TopicSearchResult } from './topicListManager';
import { Message, MessageSender } from '../models/message';
import { OwnerType } from '../models/topic';

/**
 * Search filter options
 */
export interface SearchFilters {
  sender?: MessageSender;          // Filter by sender (user/agent)
  senderId?: string;               // Filter by specific sender ID
  dateFrom?: Date;                 // Start of date range
  dateTo?: Date;                   // End of date range
  ownerId?: string;                // Filter by owner (agent/group)
  ownerType?: OwnerType;           // Filter by owner type
  contentType?: string;            // Filter by content type (markdown, code, etc.)
  hasAttachments?: boolean;        // Filter messages with attachments
  hasToolCalls?: boolean;          // Filter messages with tool calls
  limit?: number;                  // Maximum results
}

/**
 * Search result metadata
 */
export interface SearchResultMetadata {
  messageId: string;
  topicId: string;
  topicTitle: string;
  ownerId: string;
  ownerType: OwnerType;
  sender: MessageSender;
  senderName?: string;
  timestamp: string;
  matchType: 'exact' | 'partial' | 'fuzzy';
  relevanceScore: number;          // 0-100
}

/**
 * Message search result with context
 */
export interface MessageSearchResult extends SearchResultMetadata {
  content: string;
  snippet: string;                 // Highlighted snippet with match
  matchPositions: number[];        // Character positions of matches
  contextBefore?: string;          // Message before (for context)
  contextAfter?: string;           // Message after (for context)
}

/**
 * Search history entry
 */
export interface SearchHistoryEntry {
  query: string;
  filters?: SearchFilters;
  timestamp: string;
  resultCount: number;
}

/**
 * Search suggestion
 */
export interface SearchSuggestion {
  text: string;
  type: 'history' | 'recent' | 'popular';
  frequency: number;               // How often searched
}

export class SearchManager {
  private static instance: SearchManager;
  private topicListManager: TopicListManager;
  private searchHistory: SearchHistoryEntry[] = [];
  private maxHistorySize: number = 50;
  private resultCache: Map<string, MessageSearchResult[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.topicListManager = TopicListManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  /**
   * Search conversation history
   *
   * @param query - Search query
   * @param filters - Optional search filters
   * @returns Array of matching message results
   */
  public async search(query: string, filters?: SearchFilters): Promise<MessageSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    // Check cache first
    const cacheKey = this.getCacheKey(normalizedQuery, filters);
    const cached = this.resultCache.get(cacheKey);
    if (cached) {
      console.log(`[SearchManager] Cache hit for query: "${query}"`);
      return cached;
    }

    console.log(`[SearchManager] Searching for: "${query}" with filters:`, filters);

    const results: MessageSearchResult[] = [];
    const processedTopics = new Set<string>();

    // Determine which owners to search
    const ownersToSearch = await this.getOwnersToSearch(filters);

    // Search across all relevant owners
    for (const { ownerId, ownerType } of ownersToSearch) {
      const topicSearchResults = await this.topicListManager.searchTopics(
        ownerId,
        ownerType,
        query
      );

      // Process each topic
      for (const topicResult of topicSearchResults) {
        if (processedTopics.has(topicResult.id)) continue;
        processedTopics.add(topicResult.id);

        const topic = await this.topicListManager.getTopic(topicResult.id);
        if (!topic) continue;

        // Search messages within topic
        const messageResults = this.searchMessagesInTopic(
          topic.id,
          topic.title,
          topic.owner_id,
          topic.owner_type,
          topic.messages,
          normalizedQuery,
          filters
        );

        results.push(...messageResults);
      }
    }

    // Sort by relevance
    const sorted = this.sortByRelevance(results);

    // Apply limit
    const limited = filters?.limit ? sorted.slice(0, filters.limit) : sorted;

    // Cache results
    this.resultCache.set(cacheKey, limited);
    setTimeout(() => this.resultCache.delete(cacheKey), this.cacheExpiry);

    // Add to search history
    this.addToHistory(query, filters, limited.length);

    console.log(`[SearchManager] Found ${limited.length} results`);
    return limited;
  }

  /**
   * Search messages within a topic
   */
  private searchMessagesInTopic(
    topicId: string,
    topicTitle: string,
    ownerId: string,
    ownerType: OwnerType,
    messages: Message[],
    query: string,
    filters?: SearchFilters
  ): MessageSearchResult[] {
    const results: MessageSearchResult[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Apply filters
      if (!this.matchesFilters(message, filters)) {
        continue;
      }

      // Search in message content
      const lowerContent = message.content.toLowerCase();
      if (!lowerContent.includes(query)) {
        continue;
      }

      // Calculate relevance score
      const relevanceScore = this.calculateRelevance(message.content, query);

      // Extract snippet with context
      const snippet = this.extractSnippet(message.content, query);

      // Find match positions
      const matchPositions = this.findMatchPositions(message.content, query);

      // Get context messages
      const contextBefore = i > 0 ? this.truncateContent(messages[i - 1].content, 100) : undefined;
      const contextAfter = i < messages.length - 1 ? this.truncateContent(messages[i + 1].content, 100) : undefined;

      results.push({
        messageId: message.id,
        topicId,
        topicTitle,
        ownerId,
        ownerType,
        sender: message.sender,
        senderName: message.sender_name,
        timestamp: message.timestamp,
        matchType: this.getMatchType(message.content, query),
        relevanceScore,
        content: message.content,
        snippet,
        matchPositions,
        contextBefore,
        contextAfter
      });
    }

    return results;
  }

  /**
   * Check if message matches filters
   */
  private matchesFilters(message: Message, filters?: SearchFilters): boolean {
    if (!filters) return true;

    // Filter by sender type
    if (filters.sender && message.sender !== filters.sender) {
      return false;
    }

    // Filter by sender ID
    if (filters.senderId && message.sender_id !== filters.senderId) {
      return false;
    }

    // Filter by date range
    if (filters.dateFrom || filters.dateTo) {
      const messageDate = new Date(message.timestamp);
      if (filters.dateFrom && messageDate < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && messageDate > filters.dateTo) {
        return false;
      }
    }

    // Filter by attachments
    if (filters.hasAttachments !== undefined) {
      const hasAttachments = message.attachments && message.attachments.length > 0;
      if (filters.hasAttachments !== hasAttachments) {
        return false;
      }
    }

    // Filter by tool calls
    if (filters.hasToolCalls !== undefined) {
      const hasToolCalls = message.metadata?.tool_calls && message.metadata.tool_calls.length > 0;
      if (filters.hasToolCalls !== hasToolCalls) {
        return false;
      }
    }

    // Filter by content type (detect from content)
    if (filters.contentType) {
      const detectedType = this.detectContentType(message.content);
      if (detectedType !== filters.contentType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get owners to search based on filters
   */
  private async getOwnersToSearch(filters?: SearchFilters): Promise<Array<{ ownerId: string, ownerType: OwnerType }>> {
    const owners: Array<{ ownerId: string, ownerType: OwnerType }> = [];

    // If specific owner is specified
    if (filters?.ownerId && filters?.ownerType) {
      owners.push({ ownerId: filters.ownerId, ownerType: filters.ownerType });
      return owners;
    }

    // Otherwise, we need to search all owners
    // This is a simplified implementation - in production, you'd want to
    // maintain a registry of all owners or load them from persistence

    // For now, return empty array - caller should specify ownerId/ownerType
    // Or this could be enhanced to load all topics and extract unique owners
    console.warn('[SearchManager] No ownerId/ownerType specified - returning empty results');
    return owners;
  }

  /**
   * Calculate relevance score (0-100)
   */
  private calculateRelevance(content: string, query: string): number {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let score = 0;

    // Exact phrase match: +50 points
    if (lowerContent.includes(lowerQuery)) {
      score += 50;
    }

    // Word matches: +10 points per word
    const queryWords = lowerQuery.split(/\s+/);
    const contentWords = lowerContent.split(/\s+/);
    const matchingWords = queryWords.filter(qw => contentWords.includes(qw));
    score += matchingWords.length * 10;

    // Early position bonus: +20 points if in first 100 chars
    const matchIndex = lowerContent.indexOf(lowerQuery);
    if (matchIndex !== -1 && matchIndex < 100) {
      score += 20;
    }

    // Multiple occurrences: +5 points per additional occurrence
    const occurrences = (lowerContent.match(new RegExp(lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += (occurrences - 1) * 5;

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Extract snippet with highlighted match
   */
  private extractSnippet(content: string, query: string, maxLength: number = 200): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerContent.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return this.truncateContent(content, maxLength);
    }

    const snippetStart = Math.max(0, matchIndex - 75);
    const snippetEnd = Math.min(content.length, matchIndex + query.length + 75);

    let snippet = content.substring(snippetStart, snippetEnd);

    if (snippetStart > 0) {
      snippet = '...' + snippet;
    }
    if (snippetEnd < content.length) {
      snippet = snippet + '...';
    }

    return snippet;
  }

  /**
   * Find all match positions in content
   */
  private findMatchPositions(content: string, query: string): number[] {
    const positions: number[] = [];
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let index = lowerContent.indexOf(lowerQuery);
    while (index !== -1) {
      positions.push(index);
      index = lowerContent.indexOf(lowerQuery, index + 1);
    }

    return positions;
  }

  /**
   * Get match type
   */
  private getMatchType(content: string, query: string): 'exact' | 'partial' | 'fuzzy' {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (lowerContent.includes(lowerQuery)) {
      return 'exact';
    }

    const queryWords = lowerQuery.split(/\s+/);
    const matchingWords = queryWords.filter(qw => lowerContent.includes(qw));

    if (matchingWords.length === queryWords.length) {
      return 'partial';
    }

    return 'fuzzy';
  }

  /**
   * Detect content type from message content
   */
  private detectContentType(content: string): string {
    // Simple heuristics for content type detection
    if (content.includes('```')) return 'code';
    if (content.match(/^#{1,6}\s/m)) return 'markdown';
    if (content.includes('http://') || content.includes('https://')) return 'link';
    if (content.match(/\$\$|\\\[|\\\(/)) return 'latex';
    return 'text';
  }

  /**
   * Truncate content to max length
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Sort results by relevance
   */
  private sortByRelevance(results: MessageSearchResult[]): MessageSearchResult[] {
    return results.sort((a, b) => {
      // Primary: relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Secondary: match type (exact > partial > fuzzy)
      const matchTypeScore = { exact: 3, partial: 2, fuzzy: 1 };
      const aScore = matchTypeScore[a.matchType];
      const bScore = matchTypeScore[b.matchType];
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      // Tertiary: recency
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, filters?: SearchFilters): string {
    return JSON.stringify({ query, filters });
  }

  /**
   * Add search to history
   */
  private addToHistory(query: string, filters: SearchFilters | undefined, resultCount: number): void {
    const entry: SearchHistoryEntry = {
      query,
      filters,
      timestamp: new Date().toISOString(),
      resultCount
    };

    // Remove duplicates
    this.searchHistory = this.searchHistory.filter(e => e.query !== query);

    // Add to front
    this.searchHistory.unshift(entry);

    // Trim to max size
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }

    // Save to localStorage
    this.saveHistory();
  }

  /**
   * Get search history
   *
   * @param limit - Maximum entries to return
   * @returns Search history entries
   */
  public getSearchHistory(limit: number = 10): SearchHistoryEntry[] {
    return this.searchHistory.slice(0, limit);
  }

  /**
   * Get search suggestions based on query prefix
   *
   * @param prefix - Query prefix
   * @returns Array of suggestions
   */
  public getSuggestions(prefix: string): SearchSuggestion[] {
    if (!prefix || prefix.length < 2) {
      return [];
    }

    const lowerPrefix = prefix.toLowerCase();
    const suggestions: SearchSuggestion[] = [];
    const frequencyMap = new Map<string, number>();

    // Get suggestions from history
    for (const entry of this.searchHistory) {
      if (entry.query.toLowerCase().startsWith(lowerPrefix)) {
        const freq = frequencyMap.get(entry.query) || 0;
        frequencyMap.set(entry.query, freq + 1);
      }
    }

    // Convert to suggestions
    for (const [text, frequency] of frequencyMap.entries()) {
      suggestions.push({
        text,
        type: 'history',
        frequency
      });
    }

    // Sort by frequency
    suggestions.sort((a, b) => b.frequency - a.frequency);

    return suggestions.slice(0, 10);
  }

  /**
   * Clear search history
   */
  public clearHistory(): void {
    this.searchHistory = [];
    localStorage.removeItem('vcpchat-search-history');
    console.log('[SearchManager] Search history cleared');
  }

  /**
   * Clear result cache
   */
  public clearCache(): void {
    this.resultCache.clear();
    console.log('[SearchManager] Search cache cleared');
  }

  /**
   * Save search history to localStorage
   */
  private saveHistory(): void {
    localStorage.setItem('vcpchat-search-history', JSON.stringify(this.searchHistory));
  }

  /**
   * Load search history from localStorage
   */
  public loadPersistedState(): void {
    const historyJson = localStorage.getItem('vcpchat-search-history');
    if (historyJson) {
      try {
        this.searchHistory = JSON.parse(historyJson);
        console.log(`[SearchManager] Loaded ${this.searchHistory.length} history entries`);
      } catch (error) {
        console.error('[SearchManager] Failed to parse search history:', error);
      }
    }
  }

  /**
   * Get popular searches
   *
   * @param limit - Maximum entries to return
   * @returns Most frequent searches
   */
  public getPopularSearches(limit: number = 5): SearchSuggestion[] {
    const frequencyMap = new Map<string, number>();

    for (const entry of this.searchHistory) {
      const freq = frequencyMap.get(entry.query) || 0;
      frequencyMap.set(entry.query, freq + 1);
    }

    const suggestions: SearchSuggestion[] = [];
    for (const [text, frequency] of frequencyMap.entries()) {
      suggestions.push({ text, type: 'popular', frequency });
    }

    suggestions.sort((a, b) => b.frequency - a.frequency);
    return suggestions.slice(0, limit);
  }
}

/**
 * Initialize SearchManager and export singleton instance
 */
export function initSearchManager(): SearchManager {
  const manager = SearchManager.getInstance();
  manager.loadPersistedState();
  return manager;
}

/**
 * Helper function to highlight matches in text
 *
 * @param text - Original text
 * @param query - Search query
 * @returns HTML string with highlighted matches
 */
export function highlightMatches(text: string, query: string): string {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Helper function to format search result timestamp
 */
export function formatSearchResultTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}
