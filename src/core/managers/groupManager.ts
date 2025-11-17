/**
 * GroupManager (CORE-052)
 *
 * Group CRUD Operations with Collaboration Modes
 *
 * Responsibilities:
 * - Create, read, update, delete AI agent groups
 * - Manage group list in memory
 * - Persist groups to AppData/groups/ via Tauri backend
 * - Validate group data before operations (using validateGroup)
 * - Track active group
 * - Provide search and filtering capabilities
 * - Support 'sequential' and 'free' collaboration modes
 * - localStorage fallback for web debug mode
 *
 * Features:
 * - Complete CRUD operations
 * - In-memory caching for fast access
 * - Automatic validation using validateGroup()
 * - Tauri backend persistence with localStorage fallback
 * - Search by name
 * - Filter by collaboration mode
 * - Filter by agent membership
 * - Active group tracking
 * - Event notifications for group changes
 * - Singleton pattern for centralized management
 *
 * Usage:
 * ```typescript
 * import { GroupManager } from './core/managers/groupManager';
 *
 * const manager = GroupManager.getInstance();
 *
 * // Create new group
 * const group = await manager.createGroup({
 *   name: 'AI Research Team',
 *   agent_ids: ['agent-1', 'agent-2', 'agent-3'],
 *   collaboration_mode: 'sequential',
 *   turn_count: 5,
 *   speaking_rules: 'Each agent responds in order'
 * });
 *
 * // Get group by ID
 * const group = await manager.getGroup(groupId);
 *
 * // Update group
 * await manager.updateGroup(groupId, { turn_count: 3 });
 *
 * // Delete group
 * await manager.deleteGroup(groupId);
 *
 * // List all groups
 * const groups = await manager.listGroups();
 * ```
 */

import { readGroup, writeGroup, deleteGroup, listGroups } from '../ipc/commands';
import { Group, validateGroup } from '../models/group';

export interface CreateGroupOptions {
  name: string;
  agent_ids: string[];
  collaboration_mode: 'sequential' | 'free';
  avatar?: string;
  turn_count?: number;
  speaking_rules?: string;
}

export interface UpdateGroupOptions {
  name?: string;
  agent_ids?: string[];
  collaboration_mode?: 'sequential' | 'free';
  avatar?: string;
  turn_count?: number;
  speaking_rules?: string;
}

export interface GroupMetadata {
  id: string;
  name: string;
  avatar: string;
  agent_count: number;
  collaboration_mode: 'sequential' | 'free';
  created_at: string;
}

export class GroupManager {
  private static instance: GroupManager;
  private groups: Map<string, Group> = new Map();
  private loaded: boolean = false;
  private activeGroupId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GroupManager {
    if (!GroupManager.instance) {
      GroupManager.instance = new GroupManager();
    }
    return GroupManager.instance;
  }

  /**
   * Ensure groups are loaded from persistence
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    console.log('[GroupManager] Loading groups from persistence...');

    // ALWAYS load from localStorage first (contains demo data)
    this.loadFromLocalStorage();

    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        // Sync localStorage groups to Tauri filesystem
        const localStorageGroups = Array.from(this.groups.values());
        if (localStorageGroups.length > 0) {
          console.log(`[GroupManager] Syncing ${localStorageGroups.length} localStorage groups to Tauri backend...`);
          for (const group of localStorageGroups) {
            try {
              await writeGroup(group);
            } catch (error) {
              console.warn(`[GroupManager] Failed to sync group ${group.id} to Tauri:`, error);
            }
          }
        }

        // Load any additional groups from Tauri backend
        const tauri_groups = await listGroups();
        console.log(`[GroupManager] Loaded ${tauri_groups.length} groups from Tauri backend`);

        // Merge Tauri groups (in case there are server-side groups not in localStorage)
        for (const group of tauri_groups) {
          if (!this.groups.has(group.id)) {
            this.groups.set(group.id, group);
            console.log(`[GroupManager] Added new group from Tauri: ${group.name}`);
          }
        }
      } catch (error) {
        console.warn('[GroupManager] Tauri backend sync failed, continuing with localStorage only:', error);
      }
    }

    this.loaded = true;
  }

  /**
   * Load groups from localStorage
   */
  private loadFromLocalStorage(): void {
    const groupsJson = localStorage.getItem('vcpchat-groups');
    if (groupsJson) {
      try {
        const groupList: Group[] = JSON.parse(groupsJson);
        for (const group of groupList) {
          this.groups.set(group.id, group);
        }
        console.log(`[GroupManager] Loaded ${groupList.length} groups from localStorage`);
      } catch (error) {
        console.error('[GroupManager] Failed to parse localStorage groups:', error);
      }
    }
  }

  /**
   * Save groups to localStorage (fallback persistence)
   */
  private saveToLocalStorage(): void {
    const groupList = Array.from(this.groups.values());
    localStorage.setItem('vcpchat-groups', JSON.stringify(groupList));
    console.log(`[GroupManager] Saved ${groupList.length} groups to localStorage`);
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
   * Create a new group
   *
   * @param options - Group creation options
   * @returns Created group
   * @throws Error if validation fails or creation fails
   */
  public async createGroup(options: CreateGroupOptions): Promise<Group> {
    await this.ensureLoaded();

    const now = new Date().toISOString();

    const group: Group = {
      id: this.generateUUID(),
      name: options.name,
      agent_ids: options.agent_ids,
      collaboration_mode: options.collaboration_mode,
      avatar: options.avatar || 'assets/avatars/default-group.png',
      turn_count: options.turn_count ?? 3,
      speaking_rules: options.speaking_rules || '',
      created_at: now
    };

    // Validate group data
    const validationError = validateGroup(group);
    if (validationError) {
      throw new Error(`Group validation failed: ${validationError}`);
    }

    // Add to in-memory cache
    this.groups.set(group.id, group);

    // Persist to backend
    await this.persistGroup(group);

    // Dispatch event
    this.dispatchGroupEvent('group-created', group);

    console.log(`[GroupManager] Created group: ${group.id} (${group.name})`);
    return { ...group };
  }

  /**
   * Get a group by ID
   *
   * @param groupId - Group ID
   * @returns Group or null if not found
   */
  public async getGroup(groupId: string): Promise<Group | null> {
    await this.ensureLoaded();

    // Try in-memory cache first
    let group = this.groups.get(groupId);
    if (group) {
      return { ...group }; // Return copy to prevent external modification
    }

    // Try loading from persistence
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        group = await readGroup(groupId);
        this.groups.set(groupId, group);
        console.log(`[GroupManager] Loaded group from Tauri backend: ${groupId}`);
        return { ...group };
      } catch (error) {
        console.warn(`[GroupManager] Failed to load group ${groupId} from Tauri:`, error);
      }
    }

    // Not found
    console.warn(`[GroupManager] Group not found: ${groupId}`);
    return null;
  }

  /**
   * Update group
   *
   * @param groupId - Group ID
   * @param updates - Partial group updates
   * @returns Updated group
   * @throws Error if group not found or validation fails
   */
  public async updateGroup(groupId: string, updates: UpdateGroupOptions): Promise<Group> {
    await this.ensureLoaded();

    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    // Apply updates
    const updatedGroup: Group = {
      ...group,
      ...updates
    };

    // Validate updated group
    const validationError = validateGroup(updatedGroup);
    if (validationError) {
      throw new Error(`Group validation failed: ${validationError}`);
    }

    // Update in-memory cache
    this.groups.set(groupId, updatedGroup);

    // Persist to backend
    await this.persistGroup(updatedGroup);

    // Dispatch event
    this.dispatchGroupEvent('group-updated', updatedGroup);

    console.log(`[GroupManager] Updated group: ${groupId}`);
    return { ...updatedGroup };
  }

  /**
   * Delete group
   *
   * @param groupId - Group ID
   * @throws Error if group not found
   */
  public async deleteGroup(groupId: string): Promise<void> {
    await this.ensureLoaded();

    if (!this.groups.has(groupId)) {
      throw new Error(`Group not found: ${groupId}`);
    }

    // Remove from in-memory cache
    const group = this.groups.get(groupId);
    this.groups.delete(groupId);

    // Clear active group if it's the deleted one
    if (this.activeGroupId === groupId) {
      this.activeGroupId = null;
    }

    // Delete from persistence
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        await deleteGroup(groupId);
        console.log(`[GroupManager] Deleted group from Tauri backend: ${groupId}`);
      } catch (error) {
        console.warn(`[GroupManager] Failed to delete group ${groupId} from Tauri:`, error);
      }
    }

    // Always update localStorage
    this.saveToLocalStorage();

    // Dispatch event
    if (group) {
      this.dispatchGroupEvent('group-deleted', group);
    }

    console.log(`[GroupManager] Deleted group: ${groupId}`);
  }

  /**
   * List all groups
   *
   * @returns Array of all groups
   */
  public async listGroups(): Promise<Group[]> {
    await this.ensureLoaded();

    const groupList = Array.from(this.groups.values());

    // Sort by creation date (newest first)
    groupList.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return groupList.map(group => ({ ...group }));
  }

  /**
   * Get group metadata for list display
   *
   * @returns Array of group metadata
   */
  public async getGroupMetadataList(): Promise<GroupMetadata[]> {
    await this.ensureLoaded();

    const metadata: GroupMetadata[] = [];
    for (const group of this.groups.values()) {
      metadata.push({
        id: group.id,
        name: group.name,
        avatar: group.avatar,
        agent_count: group.agent_ids.length,
        collaboration_mode: group.collaboration_mode,
        created_at: group.created_at
      });
    }

    // Sort by creation date (newest first)
    metadata.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return metadata;
  }

  /**
   * Search groups by name
   *
   * @param query - Search query (case-insensitive)
   * @returns Array of matching groups
   */
  public async searchGroups(query: string): Promise<Group[]> {
    await this.ensureLoaded();

    const lowerQuery = query.toLowerCase();
    const results: Group[] = [];

    for (const group of this.groups.values()) {
      if (group.name.toLowerCase().includes(lowerQuery)) {
        results.push({ ...group });
      }
    }

    return results;
  }

  /**
   * Filter groups by collaboration mode
   *
   * @param mode - Collaboration mode ('sequential' or 'free')
   * @returns Array of groups with the specified collaboration mode
   */
  public async filterByMode(mode: 'sequential' | 'free'): Promise<Group[]> {
    await this.ensureLoaded();

    const results: Group[] = [];

    for (const group of this.groups.values()) {
      if (group.collaboration_mode === mode) {
        results.push({ ...group });
      }
    }

    return results;
  }

  /**
   * Get groups containing a specific agent
   *
   * @param agentId - Agent ID
   * @returns Array of groups containing the agent
   */
  public async getGroupsByAgent(agentId: string): Promise<Group[]> {
    await this.ensureLoaded();

    const results: Group[] = [];

    for (const group of this.groups.values()) {
      if (group.agent_ids.includes(agentId)) {
        results.push({ ...group });
      }
    }

    return results;
  }

  /**
   * Get active group
   *
   * @returns Active group or null
   */
  public async getActiveGroup(): Promise<Group | null> {
    if (!this.activeGroupId) {
      return null;
    }
    return await this.getGroup(this.activeGroupId);
  }

  /**
   * Set active group
   *
   * @param groupId - Group ID
   * @throws Error if group not found
   */
  public async setActiveGroup(groupId: string): Promise<void> {
    await this.ensureLoaded();

    if (!this.groups.has(groupId)) {
      throw new Error(`Group not found: ${groupId}`);
    }

    this.activeGroupId = groupId;

    // Save to localStorage
    localStorage.setItem('vcpchat-active-group', groupId);

    console.log(`[GroupManager] Set active group: ${groupId}`);
  }

  /**
   * Clear active group
   */
  public clearActiveGroup(): void {
    this.activeGroupId = null;
    localStorage.removeItem('vcpchat-active-group');
    console.log('[GroupManager] Cleared active group');
  }

  /**
   * Get total group count
   *
   * @returns Number of groups
   */
  public async getGroupCount(): Promise<number> {
    await this.ensureLoaded();
    return this.groups.size;
  }

  /**
   * Check if group exists
   *
   * @param groupId - Group ID
   * @returns True if group exists
   */
  public async hasGroup(groupId: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.groups.has(groupId);
  }

  /**
   * Persist group to backend
   */
  private async persistGroup(group: Group): Promise<void> {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        await writeGroup(group);
        console.log(`[GroupManager] Saved group to Tauri backend: ${group.id}`);
      } catch (error) {
        console.warn('[GroupManager] Tauri save failed, falling back to localStorage:', error);
        this.saveToLocalStorage();
      }
    } else {
      // Web debug mirror mode - use localStorage only
      this.saveToLocalStorage();
    }
  }

  /**
   * Dispatch group event
   */
  private dispatchGroupEvent(eventName: string, group: Group): void {
    const event = new CustomEvent(eventName, {
      detail: {
        groupId: group.id,
        groupName: group.name,
        group: { ...group }
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Load active group ID from localStorage
   */
  public loadPersistedState(): void {
    const activeId = localStorage.getItem('vcpchat-active-group');
    if (activeId) {
      this.activeGroupId = activeId;
      console.log(`[GroupManager] Restored active group: ${activeId}`);
    }
  }

  /**
   * Clear all groups (for testing/reset)
   */
  public async clearAllGroups(): Promise<void> {
    this.groups.clear();
    this.activeGroupId = null;
    this.loaded = false;

    localStorage.removeItem('vcpchat-groups');
    localStorage.removeItem('vcpchat-active-group');

    console.log('[GroupManager] Cleared all groups');
  }

  /**
   * Preload groups into cache
   */
  public async preloadCache(): Promise<void> {
    await this.listGroups();
  }

  /**
   * Clear group cache
   */
  public clearCache(): void {
    this.groups.clear();
    this.loaded = false;
    console.log('[GroupManager] Cache cleared');
  }
}

/**
 * Initialize GroupManager and export singleton instance
 */
export function initGroupManager(): GroupManager {
  const manager = GroupManager.getInstance();
  manager.loadPersistedState();
  return manager;
}

/**
 * Get list of unique collaboration modes from all groups
 */
export async function getCollaborationModes(): Promise<('sequential' | 'free')[]> {
  // Both modes are always available
  return ['sequential', 'free'];
}
