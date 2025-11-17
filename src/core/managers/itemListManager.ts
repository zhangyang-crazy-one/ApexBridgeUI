/**
 * ItemListManager (CORE-054)
 *
 * Unified Agent/Group List Display Manager
 *
 * Responsibilities:
 * - Provide unified view of agents and groups for sidebar display
 * - Handle mixed agent/group lists with sorting and filtering
 * - Track active item (agent or group) selection
 * - Manage recent items history for quick access
 * - Provide search across both agents and groups
 * - Handle item selection and activation
 * - Persist UI state (sort order, filters, recent items)
 * - Event notifications for selection changes
 *
 * Features:
 * - Unified ItemMetadata interface for both agents and groups
 * - Flexible sorting (by name, creation date, recent usage)
 * - Filtering by type (all, agents only, groups only)
 * - Recent items tracking (MRU - Most Recently Used)
 * - Active item tracking with persistence
 * - Search across both agents and groups
 * - Singleton pattern for centralized state
 * - Event dispatching for UI updates
 *
 * Usage:
 * ```typescript
 * import { ItemListManager } from './core/managers/itemListManager';
 *
 * const manager = ItemListManager.getInstance();
 *
 * // Get combined list for sidebar
 * const items = await manager.getAllItems();
 *
 * // Get filtered list
 * const agentsOnly = await manager.getItems({ type: 'agent' });
 *
 * // Search across all items
 * const results = await manager.searchItems('AI');
 *
 * // Track active item
 * await manager.setActiveItem('agent-1', 'agent');
 * const active = await manager.getActiveItem();
 *
 * // Get recent items
 * const recent = await manager.getRecentItems(5);
 * ```
 */

import { AgentManager, AgentMetadata } from './agentManager';
import { GroupManager, GroupMetadata } from './groupManager';

/**
 * Unified item type discriminator
 */
export type ItemType = 'agent' | 'group';

/**
 * Unified metadata interface for sidebar display
 */
export interface ItemMetadata {
  id: string;
  type: ItemType;
  name: string;
  avatar: string;
  subtitle: string;           // Model name for agents, member count for groups
  created_at: string;
  last_used?: string;         // ISO timestamp of last usage
  is_active: boolean;         // Current active item
}

/**
 * Filter options for item list
 */
export interface ItemFilterOptions {
  type?: ItemType | 'all';    // Filter by type
  search?: string;            // Search query
  sort?: 'name' | 'created' | 'recent';  // Sort method
  limit?: number;             // Limit results
}

/**
 * Active item reference
 */
export interface ActiveItemRef {
  id: string;
  type: ItemType;
}

export class ItemListManager {
  private static instance: ItemListManager;
  private agentManager: AgentManager;
  private groupManager: GroupManager;
  private activeItem: ActiveItemRef | null = null;
  private recentItems: ActiveItemRef[] = [];  // MRU list
  private maxRecentItems: number = 10;

  private constructor() {
    this.agentManager = AgentManager.getInstance();
    this.groupManager = GroupManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ItemListManager {
    if (!ItemListManager.instance) {
      ItemListManager.instance = new ItemListManager();
    }
    return ItemListManager.instance;
  }

  /**
   * Get all items (agents + groups) as unified metadata
   *
   * @param options - Filter and sort options
   * @returns Array of unified item metadata
   */
  public async getAllItems(options: ItemFilterOptions = {}): Promise<ItemMetadata[]> {
    const items: ItemMetadata[] = [];

    // Get agents if not filtered out
    if (!options.type || options.type === 'all' || options.type === 'agent') {
      const agents = await this.agentManager.getAgentMetadataList();
      for (const agent of agents) {
        items.push(this.agentToItemMetadata(agent));
      }
    }

    // Get groups if not filtered out
    if (!options.type || options.type === 'all' || options.type === 'group') {
      const groups = await this.groupManager.getGroupMetadataList();
      for (const group of groups) {
        items.push(this.groupToItemMetadata(group));
      }
    }

    // Apply search filter
    let filtered = items;
    if (options.search) {
      filtered = this.filterItemsBySearch(items, options.search);
    }

    // Apply sorting
    const sorted = this.sortItems(filtered, options.sort || 'created');

    // Apply limit
    if (options.limit && options.limit > 0) {
      return sorted.slice(0, options.limit);
    }

    return sorted;
  }

  /**
   * Get items with specific filter
   *
   * @param options - Filter options
   * @returns Filtered items
   */
  public async getItems(options: ItemFilterOptions): Promise<ItemMetadata[]> {
    return await this.getAllItems(options);
  }

  /**
   * Search items across agents and groups
   *
   * @param query - Search query (case-insensitive)
   * @returns Matching items
   */
  public async searchItems(query: string): Promise<ItemMetadata[]> {
    return await this.getAllItems({ search: query });
  }

  /**
   * Get active item
   *
   * @returns Active item metadata or null
   */
  public async getActiveItem(): Promise<ItemMetadata | null> {
    if (!this.activeItem) {
      return null;
    }

    if (this.activeItem.type === 'agent') {
      const agent = await this.agentManager.getAgent(this.activeItem.id);
      if (!agent) return null;
      const metadata = this.agentMetadataFromAgent(agent);
      return this.agentToItemMetadata(metadata);
    } else {
      const group = await this.groupManager.getGroup(this.activeItem.id);
      if (!group) return null;
      const metadata = this.groupMetadataFromGroup(group);
      return this.groupToItemMetadata(metadata);
    }
  }

  /**
   * Set active item
   *
   * @param id - Item ID
   * @param type - Item type
   * @throws Error if item not found
   */
  public async setActiveItem(id: string, type: ItemType): Promise<void> {
    // Verify item exists
    if (type === 'agent') {
      const exists = await this.agentManager.hasAgent(id);
      if (!exists) {
        throw new Error(`Agent not found: ${id}`);
      }
      await this.agentManager.setActiveAgent(id);
    } else {
      const exists = await this.groupManager.hasGroup(id);
      if (!exists) {
        throw new Error(`Group not found: ${id}`);
      }
      await this.groupManager.setActiveGroup(id);
    }

    this.activeItem = { id, type };

    // Add to recent items
    this.addToRecentItems(id, type);

    // Save to localStorage
    this.saveActiveItem();

    // Dispatch event
    this.dispatchActiveItemEvent(id, type);

    console.log(`[ItemListManager] Set active item: ${type}:${id}`);
  }

  /**
   * Clear active item
   */
  public clearActiveItem(): void {
    if (this.activeItem) {
      const { type } = this.activeItem;
      if (type === 'agent') {
        this.agentManager.clearActiveAgent();
      } else {
        this.groupManager.clearActiveGroup();
      }
    }

    this.activeItem = null;
    localStorage.removeItem('vcpchat-active-item');

    console.log('[ItemListManager] Cleared active item');
  }

  /**
   * Get recent items (MRU list)
   *
   * @param limit - Maximum number of items to return
   * @returns Recent items in MRU order
   */
  public async getRecentItems(limit: number = 10): Promise<ItemMetadata[]> {
    const items: ItemMetadata[] = [];

    for (const ref of this.recentItems.slice(0, limit)) {
      if (ref.type === 'agent') {
        const agent = await this.agentManager.getAgent(ref.id);
        if (agent) {
          const metadata = this.agentMetadataFromAgent(agent);
          items.push(this.agentToItemMetadata(metadata));
        }
      } else {
        const group = await this.groupManager.getGroup(ref.id);
        if (group) {
          const metadata = this.groupMetadataFromGroup(group);
          items.push(this.groupToItemMetadata(metadata));
        }
      }
    }

    return items;
  }

  /**
   * Add item to recent items list
   *
   * @param id - Item ID
   * @param type - Item type
   */
  private addToRecentItems(id: string, type: ItemType): void {
    // Remove if already exists
    this.recentItems = this.recentItems.filter(
      item => !(item.id === id && item.type === type)
    );

    // Add to front
    this.recentItems.unshift({ id, type });

    // Trim to max size
    if (this.recentItems.length > this.maxRecentItems) {
      this.recentItems = this.recentItems.slice(0, this.maxRecentItems);
    }

    // Save to localStorage
    this.saveRecentItems();
  }

  /**
   * Get item count by type
   *
   * @param type - Item type or 'all'
   * @returns Count of items
   */
  public async getItemCount(type: ItemType | 'all' = 'all'): Promise<number> {
    if (type === 'agent') {
      return await this.agentManager.getAgentCount();
    } else if (type === 'group') {
      return await this.groupManager.getGroupCount();
    } else {
      const agentCount = await this.agentManager.getAgentCount();
      const groupCount = await this.groupManager.getGroupCount();
      return agentCount + groupCount;
    }
  }

  /**
   * Check if item exists
   *
   * @param id - Item ID
   * @param type - Item type
   * @returns True if item exists
   */
  public async hasItem(id: string, type: ItemType): Promise<boolean> {
    if (type === 'agent') {
      return await this.agentManager.hasAgent(id);
    } else {
      return await this.groupManager.hasGroup(id);
    }
  }

  /**
   * Convert AgentMetadata to ItemMetadata
   */
  private agentToItemMetadata(agent: AgentMetadata): ItemMetadata {
    const isActive = this.activeItem?.type === 'agent' && this.activeItem.id === agent.id;
    const lastUsed = this.getLastUsedTime(agent.id, 'agent');

    return {
      id: agent.id,
      type: 'agent',
      name: agent.name,
      avatar: agent.avatar,
      subtitle: agent.model,  // Model name as subtitle
      created_at: agent.created_at,
      last_used: lastUsed,
      is_active: isActive
    };
  }

  /**
   * Convert GroupMetadata to ItemMetadata
   */
  private groupToItemMetadata(group: GroupMetadata): ItemMetadata {
    const isActive = this.activeItem?.type === 'group' && this.activeItem.id === group.id;
    const lastUsed = this.getLastUsedTime(group.id, 'group');

    return {
      id: group.id,
      type: 'group',
      name: group.name,
      avatar: group.avatar,
      subtitle: `${group.agent_count} members · ${group.collaboration_mode}`,  // Member count + mode
      created_at: group.created_at,
      last_used: lastUsed,
      is_active: isActive
    };
  }

  /**
   * Get Agent metadata from Agent
   */
  private agentMetadataFromAgent(agent: any): AgentMetadata {
    return {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      model: agent.model,
      created_at: agent.created_at
    };
  }

  /**
   * Get Group metadata from Group
   */
  private groupMetadataFromGroup(group: any): GroupMetadata {
    return {
      id: group.id,
      name: group.name,
      avatar: group.avatar,
      agent_count: group.agent_ids.length,
      collaboration_mode: group.collaboration_mode,
      created_at: group.created_at
    };
  }

  /**
   * Get last used time for item
   */
  private getLastUsedTime(id: string, type: ItemType): string | undefined {
    const index = this.recentItems.findIndex(item => item.id === id && item.type === type);
    if (index === -1) return undefined;

    // Use current time minus index as proxy for last used
    // (More recent items have lower index)
    const now = new Date();
    const offset = index * 60000; // 1 minute per position
    return new Date(now.getTime() - offset).toISOString();
  }

  /**
   * Filter items by search query
   */
  private filterItemsBySearch(items: ItemMetadata[], query: string): ItemMetadata[] {
    const lowerQuery = query.toLowerCase();
    return items.filter(item => {
      return item.name.toLowerCase().includes(lowerQuery) ||
             item.subtitle.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Sort items by specified method
   */
  private sortItems(items: ItemMetadata[], method: 'name' | 'created' | 'recent'): ItemMetadata[] {
    const sorted = [...items];

    if (method === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (method === 'created') {
      sorted.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (method === 'recent') {
      sorted.sort((a, b) => {
        const aUsed = a.last_used ? new Date(a.last_used).getTime() : 0;
        const bUsed = b.last_used ? new Date(b.last_used).getTime() : 0;
        if (aUsed !== bUsed) {
          return bUsed - aUsed;  // More recent first
        }
        // Fall back to created date
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return sorted;
  }

  /**
   * Save active item to localStorage
   */
  private saveActiveItem(): void {
    if (this.activeItem) {
      localStorage.setItem('vcpchat-active-item', JSON.stringify(this.activeItem));
    }
  }

  /**
   * Save recent items to localStorage
   */
  private saveRecentItems(): void {
    localStorage.setItem('vcpchat-recent-items', JSON.stringify(this.recentItems));
  }

  /**
   * Load persisted state from localStorage
   */
  public loadPersistedState(): void {
    // Load active item
    const activeItemJson = localStorage.getItem('vcpchat-active-item');
    if (activeItemJson) {
      try {
        this.activeItem = JSON.parse(activeItemJson);
        console.log(`[ItemListManager] Restored active item: ${this.activeItem?.type}:${this.activeItem?.id}`);
      } catch (error) {
        console.error('[ItemListManager] Failed to parse active item:', error);
      }
    }

    // Load recent items
    const recentItemsJson = localStorage.getItem('vcpchat-recent-items');
    if (recentItemsJson) {
      try {
        this.recentItems = JSON.parse(recentItemsJson);
        console.log(`[ItemListManager] Restored ${this.recentItems.length} recent items`);
      } catch (error) {
        console.error('[ItemListManager] Failed to parse recent items:', error);
      }
    }
  }

  /**
   * Dispatch active item change event
   */
  private dispatchActiveItemEvent(id: string, type: ItemType): void {
    const event = new CustomEvent('active-item-changed', {
      detail: { id, type }
    });
    window.dispatchEvent(event);
  }

  /**
   * Clear all state (for testing/reset)
   */
  public clearState(): void {
    this.activeItem = null;
    this.recentItems = [];

    localStorage.removeItem('vcpchat-active-item');
    localStorage.removeItem('vcpchat-recent-items');

    console.log('[ItemListManager] Cleared all state');
  }

  /**
   * Preload items into cache
   */
  public async preloadCache(): Promise<void> {
    await this.agentManager.preloadCache();
    await this.groupManager.preloadCache();
  }

  /**
   * Refresh item list (force reload)
   */
  public async refreshItems(): Promise<void> {
    this.agentManager.clearCache();
    this.groupManager.clearCache();
    await this.preloadCache();
  }
}

/**
 * Initialize ItemListManager and export singleton instance
 */
export function initItemListManager(): ItemListManager {
  const manager = ItemListManager.getInstance();
  manager.loadPersistedState();
  return manager;
}

/**
 * Helper function to format item subtitle for display
 */
export function formatItemSubtitle(item: ItemMetadata): string {
  return item.subtitle;
}

/**
 * Helper function to get item type icon name
 */
export function getItemTypeIcon(type: ItemType): string {
  return type === 'agent' ? 'user' : 'users';
}

/**
 * Helper function to get item type label
 */
export function getItemTypeLabel(type: ItemType): string {
  return type === 'agent' ? 'Agent' : 'Group';
}
