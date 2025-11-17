/**
 * VCPChat Bootstrap System (CORE-062)
 *
 * Centralized initialization sequence for all managers and UI components
 *
 * Responsibilities:
 * - Initialize managers in correct dependency order
 * - Load persisted data (settings, agents, groups)
 * - Apply settings to UI
 * - Initialize UI components
 * - Handle initialization errors gracefully
 * - Provide initialization state tracking
 *
 * Initialization Order:
 * 1. SettingsManager - Must be first (affects all other components)
 * 2. AgentManager - Load agents from storage
 * 3. GroupManager - Load groups from storage
 * 4. ChatManager - Prepare for message sending
 * 5. UI Components - Populate interface after data loaded
 *
 * Usage:
 * ```typescript
 * import { bootstrap } from './core/bootstrap';
 *
 * document.addEventListener('DOMContentLoaded', async () => {
 *   try {
 *     await bootstrap();
 *     console.log('VCPChat initialized successfully');
 *   } catch (error) {
 *     console.error('Initialization failed:', error);
 *   }
 * });
 * ```
 */

import { SettingsManager, initSettingsManager } from './managers/settingsManager';
import { AgentManager, initAgentManager } from './managers/agentManager';
import { GroupManager, initGroupManager } from './managers/groupManager';
import { TopicListManager, initTopicListManager } from './managers/topicListManager';
import { ChatManager, initChatManager } from './managers/chatManager';
import { APIClient, initAPIClient, getAPIClient } from './services/apiClient';

export interface BootstrapState {
  initialized: boolean;
  settingsLoaded: boolean;
  agentsLoaded: boolean;
  groupsLoaded: boolean;
  topicsLoaded: boolean;
  uiRendered: boolean;
  error: Error | null;
}

export interface BootstrapContext {
  settingsManager: SettingsManager;
  agentManager: AgentManager;
  groupManager: GroupManager;
  topicManager: TopicListManager;
  chatManager: ChatManager;
  apiClient: APIClient;
}

let bootstrapState: BootstrapState = {
  initialized: false,
  settingsLoaded: false,
  agentsLoaded: false,
  groupsLoaded: false,
  topicsLoaded: false,
  uiRendered: false,
  error: null,
};

let bootstrapContext: BootstrapContext | null = null;

/**
 * Main bootstrap function - Initializes entire application
 *
 * @returns Bootstrap context with all managers
 * @throws Error if any critical initialization step fails
 */
export async function bootstrap(): Promise<BootstrapContext> {
  console.log('[Bootstrap] Starting VCPChat initialization...');

  try {
    // Phase 1: Initialize Settings Manager (CRITICAL - affects everything else)
    console.log('[Bootstrap] Phase 1: Loading settings...');
    const settingsManager = await initSettingsManager();
    bootstrapState.settingsLoaded = true;
    console.log('[Bootstrap] ✓ Settings loaded');

    // Phase 2: Initialize Data Managers
    console.log('[Bootstrap] Phase 2: Initializing data managers...');

    const agentManager = initAgentManager();
    await agentManager.listAgents(); // Ensure agents are loaded
    bootstrapState.agentsLoaded = true;
    console.log('[Bootstrap] ✓ Agent manager initialized');

    const groupManager = initGroupManager();
    await groupManager.listGroups(); // Ensure groups are loaded
    bootstrapState.groupsLoaded = true;
    console.log('[Bootstrap] ✓ Group manager initialized');

    // Phase 2.5: Initialize Topic Manager
    console.log('[Bootstrap] Phase 2.5: Initializing topic manager...');
    const topicManager = initTopicListManager();
    // Topics will be loaded on-demand when selecting agents
    bootstrapState.topicsLoaded = true;
    console.log('[Bootstrap] ✓ Topic manager initialized');

    // Phase 3: Initialize API Client
    console.log('[Bootstrap] Phase 3: Initializing API client...');
    const settings = settingsManager.getSettings();
    const apiClient = initAPIClient({
      baseURL: settings.backend_url || 'http://localhost:6005/v1/chat/completions',
      apiKey: settings.api_key || '',
      timeout: 120000,
    });
    console.log('[Bootstrap] ✓ API client initialized');

    // Phase 4: Initialize Chat Manager
    console.log('[Bootstrap] Phase 4: Initializing chat manager...');
    const chatManager = initChatManager(settings);
    console.log('[Bootstrap] ✓ Chat manager initialized');

    // Store context
    bootstrapContext = {
      settingsManager,
      agentManager,
      groupManager,
      topicManager,
      chatManager,
      apiClient,
    };

    bootstrapState.initialized = true;
    console.log('[Bootstrap] ✅ Initialization complete');

    return bootstrapContext;
  } catch (error) {
    bootstrapState.error = error as Error;
    console.error('[Bootstrap] ❌ Initialization failed:', error);
    throw new Error(`Bootstrap failed: ${(error as Error).message}`);
  }
}

/**
 * Get current bootstrap state
 *
 * @returns Current bootstrap state
 */
export function getBootstrapState(): Readonly<BootstrapState> {
  return { ...bootstrapState };
}

/**
 * Get bootstrap context (managers)
 *
 * @returns Bootstrap context or null if not initialized
 */
export function getBootstrapContext(): Readonly<BootstrapContext> | null {
  return bootstrapContext ? { ...bootstrapContext } : null;
}

/**
 * Check if bootstrap is complete
 *
 * @returns True if bootstrap is complete
 */
export function isBootstrapped(): boolean {
  return bootstrapState.initialized && bootstrapContext !== null;
}

/**
 * Reset bootstrap state (for testing)
 */
export function resetBootstrap(): void {
  bootstrapState = {
    initialized: false,
    settingsLoaded: false,
    agentsLoaded: false,
    groupsLoaded: false,
    topicsLoaded: false,
    uiRendered: false,
    error: null,
  };
  bootstrapContext = null;
  console.log('[Bootstrap] Reset complete');
}
