/**
 * AgentManager (CORE-051)
 *
 * Agent CRUD Operations and Management
 *
 * Responsibilities:
 * - Create, read, update, delete agents
 * - Manage agent list in memory
 * - Persist agents to AppData/agents/ via Tauri backend
 * - Validate agent data before operations
 * - Track active and default agents
 * - Provide search and filtering capabilities
 * - localStorage fallback for web debug mode
 *
 * Features:
 * - Complete CRUD operations
 * - In-memory caching for fast access
 * - Automatic validation using validateAgent()
 * - Tauri backend persistence with localStorage fallback
 * - Search by name or model
 * - Filter by model type
 * - Active agent tracking
 * - Event notifications for agent changes
 * - Singleton pattern for centralized management
 *
 * Usage:
 * ```typescript
 * import { AgentManager } from './core/managers/agentManager';
 *
 * const manager = AgentManager.getInstance();
 *
 * // Create new agent
 * const agent = await manager.createAgent({
 *   name: 'Nova',
 *   avatar: '/avatars/nova.png',
 *   system_prompt: 'You are a helpful AI assistant.',
 *   model: 'gpt-4',
 *   temperature: 0.7
 * });
 *
 * // Get agent by ID
 * const agent = await manager.getAgent(agentId);
 *
 * // Update agent
 * await manager.updateAgent(agentId, { temperature: 0.8 });
 *
 * // Delete agent
 * await manager.deleteAgent(agentId);
 *
 * // List all agents
 * const agents = await manager.listAgents();
 * ```
 */

import { readAgent, writeAgent, deleteAgent, listAgents } from '../ipc/commands';
import { Agent, validateAgent } from '../models/agent';

export interface CreateAgentOptions {
  name: string;
  avatar: string;
  system_prompt: string;
  model: string;
  temperature?: number;
  context_token_limit?: number;
  max_output_tokens?: number;
}

export interface UpdateAgentOptions {
  name?: string;
  avatar?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  context_token_limit?: number;
  max_output_tokens?: number;
}

export interface AgentMetadata {
  id: string;
  name: string;
  avatar: string;
  model: string;
  created_at: string;
}

export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, Agent> = new Map();
  private loaded: boolean = false;
  private activeAgentId: string | null = null;
  private defaultAgentId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Ensure agents are loaded from persistence
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    console.log('[AgentManager] Loading agents from persistence...');

    // ALWAYS load from localStorage first (contains demo data)
    this.loadFromLocalStorage();

    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        // Sync localStorage agents to Tauri filesystem
        const localStorageAgents = Array.from(this.agents.values());
        if (localStorageAgents.length > 0) {
          console.log(`[AgentManager] Syncing ${localStorageAgents.length} localStorage agents to Tauri backend...`);
          for (const agent of localStorageAgents) {
            try {
              await writeAgent(agent);
            } catch (error) {
              console.warn(`[AgentManager] Failed to sync agent ${agent.id} to Tauri:`, error);
            }
          }
        }

        // Load any additional agents from Tauri backend
        const tauri_agents = await listAgents();
        console.log(`[AgentManager] Loaded ${tauri_agents.length} agents from Tauri backend`);

        // Merge Tauri agents (in case there are server-side agents not in localStorage)
        for (const agent of tauri_agents) {
          if (!this.agents.has(agent.id)) {
            this.agents.set(agent.id, agent);
            console.log(`[AgentManager] Added new agent from Tauri: ${agent.name}`);
          }
        }
      } catch (error) {
        console.warn('[AgentManager] Tauri backend sync failed, continuing with localStorage only:', error);
      }
    }

    this.loaded = true;
  }

  /**
   * Load agents from localStorage
   */
  private loadFromLocalStorage(): void {
    const agentsJson = localStorage.getItem('vcpchat-agents');
    if (agentsJson) {
      try {
        const agentList: Agent[] = JSON.parse(agentsJson);
        for (const agent of agentList) {
          this.agents.set(agent.id, agent);
        }
        console.log(`[AgentManager] Loaded ${agentList.length} agents from localStorage`);
      } catch (error) {
        console.error('[AgentManager] Failed to parse localStorage agents:', error);
      }
    }
  }

  /**
   * Save agents to localStorage (fallback persistence)
   */
  private saveToLocalStorage(): void {
    const agentList = Array.from(this.agents.values());
    localStorage.setItem('vcpchat-agents', JSON.stringify(agentList));
    console.log(`[AgentManager] Saved ${agentList.length} agents to localStorage`);
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
   * Create new agent
   *
   * @param options - Agent creation options
   * @returns Created agent
   * @throws Error if validation fails or creation fails
   */
  public async createAgent(options: CreateAgentOptions): Promise<Agent> {
    await this.ensureLoaded();

    const now = new Date().toISOString();

    const agent: Agent = {
      id: this.generateUUID(),
      name: options.name,
      avatar: options.avatar,
      system_prompt: options.system_prompt,
      model: options.model,
      temperature: options.temperature ?? 0.7,
      context_token_limit: options.context_token_limit ?? 4096,
      max_output_tokens: options.max_output_tokens ?? 2048,
      created_at: now
    };

    // Validate agent data
    const validationError = validateAgent(agent);
    if (validationError) {
      throw new Error(`Agent validation failed: ${validationError}`);
    }

    // Add to in-memory cache
    this.agents.set(agent.id, agent);

    // Persist to backend
    await this.persistAgent(agent);

    // Dispatch event
    this.dispatchAgentEvent('agent-created', agent);

    console.log(`[AgentManager] Created agent: ${agent.id} (${agent.name})`);
    return { ...agent };
  }

  /**
   * Get agent by ID
   *
   * @param agentId - Agent ID
   * @returns Agent or null if not found
   */
  public async getAgent(agentId: string): Promise<Agent | null> {
    await this.ensureLoaded();

    // Try in-memory cache first
    let agent = this.agents.get(agentId);
    if (agent) {
      return { ...agent }; // Return copy to prevent external modification
    }

    // Try loading from persistence
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        agent = await readAgent(agentId);
        this.agents.set(agentId, agent);
        console.log(`[AgentManager] Loaded agent from Tauri backend: ${agentId}`);
        return { ...agent };
      } catch (error) {
        console.warn(`[AgentManager] Failed to load agent ${agentId} from Tauri:`, error);
      }
    }

    // Not found
    console.warn(`[AgentManager] Agent not found: ${agentId}`);
    return null;
  }

  /**
   * Update agent
   *
   * @param agentId - Agent ID
   * @param updates - Partial agent updates
   * @returns Updated agent
   * @throws Error if agent not found or validation fails
   */
  public async updateAgent(agentId: string, updates: UpdateAgentOptions): Promise<Agent> {
    await this.ensureLoaded();

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Apply updates
    const updatedAgent: Agent = {
      ...agent,
      ...updates
    };

    // Validate updated agent
    const validationError = validateAgent(updatedAgent);
    if (validationError) {
      throw new Error(`Agent validation failed: ${validationError}`);
    }

    // Update in-memory cache
    this.agents.set(agentId, updatedAgent);

    // Persist to backend
    await this.persistAgent(updatedAgent);

    // Dispatch event
    this.dispatchAgentEvent('agent-updated', updatedAgent);

    console.log(`[AgentManager] Updated agent: ${agentId}`);
    return { ...updatedAgent };
  }

  /**
   * Delete agent
   *
   * @param agentId - Agent ID
   * @throws Error if agent not found or is default agent
   */
  public async deleteAgent(agentId: string): Promise<void> {
    await this.ensureLoaded();

    if (!this.agents.has(agentId)) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Prevent deleting default agent
    if (agentId === this.defaultAgentId) {
      throw new Error('Cannot delete default agent. Set a different default agent first.');
    }

    // Remove from in-memory cache
    const agent = this.agents.get(agentId);
    this.agents.delete(agentId);

    // Clear active agent if it's the deleted one
    if (this.activeAgentId === agentId) {
      this.activeAgentId = null;
    }

    // Delete from persistence
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        await deleteAgent(agentId);
        console.log(`[AgentManager] Deleted agent from Tauri backend: ${agentId}`);
      } catch (error) {
        console.warn(`[AgentManager] Failed to delete agent ${agentId} from Tauri:`, error);
      }
    }

    // Always update localStorage
    this.saveToLocalStorage();

    // Dispatch event
    if (agent) {
      this.dispatchAgentEvent('agent-deleted', agent);
    }

    console.log(`[AgentManager] Deleted agent: ${agentId}`);
  }

  /**
   * List all agents
   *
   * @returns Array of all agents
   */
  public async listAgents(): Promise<Agent[]> {
    await this.ensureLoaded();

    const agentList = Array.from(this.agents.values());

    // Sort by creation date (newest first)
    agentList.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return agentList.map(agent => ({ ...agent }));
  }

  /**
   * Get agent metadata for list display
   *
   * @returns Array of agent metadata
   */
  public async getAgentMetadataList(): Promise<AgentMetadata[]> {
    await this.ensureLoaded();

    const metadata: AgentMetadata[] = [];
    for (const agent of this.agents.values()) {
      metadata.push({
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        model: agent.model,
        created_at: agent.created_at
      });
    }

    // Sort by creation date (newest first)
    metadata.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return metadata;
  }

  /**
   * Search agents by name or model
   *
   * @param query - Search query (case-insensitive)
   * @returns Array of matching agents
   */
  public async searchAgents(query: string): Promise<Agent[]> {
    await this.ensureLoaded();

    const lowerQuery = query.toLowerCase();
    const results: Agent[] = [];

    for (const agent of this.agents.values()) {
      if (
        agent.name.toLowerCase().includes(lowerQuery) ||
        agent.model.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ ...agent });
      }
    }

    return results;
  }

  /**
   * Filter agents by model
   *
   * @param model - Model identifier (e.g., 'gpt-4', 'claude-3')
   * @returns Array of agents using the specified model
   */
  public async filterByModel(model: string): Promise<Agent[]> {
    await this.ensureLoaded();

    const results: Agent[] = [];

    for (const agent of this.agents.values()) {
      if (agent.model === model) {
        results.push({ ...agent });
      }
    }

    return results;
  }

  /**
   * Get active agent
   *
   * @returns Active agent or null
   */
  public async getActiveAgent(): Promise<Agent | null> {
    if (!this.activeAgentId) {
      return null;
    }
    return await this.getAgent(this.activeAgentId);
  }

  /**
   * Set active agent
   *
   * @param agentId - Agent ID
   * @throws Error if agent not found
   */
  public async setActiveAgent(agentId: string): Promise<void> {
    await this.ensureLoaded();

    if (!this.agents.has(agentId)) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.activeAgentId = agentId;

    // Save to localStorage
    localStorage.setItem('vcpchat-active-agent', agentId);

    console.log(`[AgentManager] Set active agent: ${agentId}`);
  }

  /**
   * Clear active agent
   */
  public clearActiveAgent(): void {
    this.activeAgentId = null;
    localStorage.removeItem('vcpchat-active-agent');
    console.log('[AgentManager] Cleared active agent');
  }

  /**
   * Get default agent
   *
   * @returns Default agent or null
   */
  public async getDefaultAgent(): Promise<Agent | null> {
    if (!this.defaultAgentId) {
      return null;
    }
    return await this.getAgent(this.defaultAgentId);
  }

  /**
   * Set default agent
   *
   * @param agentId - Agent ID
   * @throws Error if agent not found
   */
  public async setDefaultAgent(agentId: string): Promise<void> {
    await this.ensureLoaded();

    if (!this.agents.has(agentId)) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.defaultAgentId = agentId;

    // Save to localStorage
    localStorage.setItem('vcpchat-default-agent', agentId);

    console.log(`[AgentManager] Set default agent: ${agentId}`);
  }

  /**
   * Get total agent count
   *
   * @returns Number of agents
   */
  public async getAgentCount(): Promise<number> {
    await this.ensureLoaded();
    return this.agents.size;
  }

  /**
   * Check if agent exists
   *
   * @param agentId - Agent ID
   * @returns True if agent exists
   */
  public async hasAgent(agentId: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.agents.has(agentId);
  }

  /**
   * Persist agent to backend
   */
  private async persistAgent(agent: Agent): Promise<void> {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        await writeAgent(agent);
        console.log(`[AgentManager] Saved agent to Tauri backend: ${agent.id}`);
      } catch (error) {
        console.warn('[AgentManager] Tauri save failed, falling back to localStorage:', error);
        this.saveToLocalStorage();
      }
    } else {
      // Web debug mirror mode - use localStorage only
      this.saveToLocalStorage();
    }
  }

  /**
   * Dispatch agent event
   */
  private dispatchAgentEvent(eventName: string, agent: Agent): void {
    const event = new CustomEvent(eventName, {
      detail: {
        agentId: agent.id,
        agentName: agent.name,
        agent: { ...agent }
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Load active and default agent IDs from localStorage
   */
  public loadPersistedState(): void {
    const activeId = localStorage.getItem('vcpchat-active-agent');
    if (activeId) {
      this.activeAgentId = activeId;
      console.log(`[AgentManager] Restored active agent: ${activeId}`);
    }

    const defaultId = localStorage.getItem('vcpchat-default-agent');
    if (defaultId) {
      this.defaultAgentId = defaultId;
      console.log(`[AgentManager] Restored default agent: ${defaultId}`);
    }
  }

  /**
   * Clear all agents (for testing/reset)
   */
  public async clearAllAgents(): Promise<void> {
    this.agents.clear();
    this.activeAgentId = null;
    this.defaultAgentId = null;
    this.loaded = false;

    localStorage.removeItem('vcpchat-agents');
    localStorage.removeItem('vcpchat-active-agent');
    localStorage.removeItem('vcpchat-default-agent');

    console.log('[AgentManager] Cleared all agents');
  }

  /**
   * Preload agents into cache
   */
  public async preloadCache(): Promise<void> {
    await this.listAgents();
  }

  /**
   * Clear agent cache
   */
  public clearCache(): void {
    this.agents.clear();
    this.loaded = false;
    console.log('[AgentManager] Cache cleared');
  }
}

/**
 * Initialize AgentManager and export singleton instance
 */
export function initAgentManager(): AgentManager {
  const manager = AgentManager.getInstance();
  manager.loadPersistedState();
  return manager;
}

/**
 * Get list of unique models from all agents
 */
export async function getAvailableModels(): Promise<string[]> {
  const manager = AgentManager.getInstance();
  const agents = await manager.listAgents();

  const models = new Set<string>();
  for (const agent of agents) {
    models.add(agent.model);
  }

  return Array.from(models).sort();
}

