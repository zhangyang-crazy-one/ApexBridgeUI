/**
 * Demo Data Initialization
 *
 * Creates sample agent and settings data in localStorage for demonstration purposes.
 * This ensures the UI has data to display when first launched.
 */

import { Agent } from '../core/models/agent';
import { Settings } from '../core/models/settings';

/**
 * Initialize demo agent data if no agents exist
 */
export function initDemoAgents(): void {
  const existingAgents = localStorage.getItem('vcpchat-agents');

  if (existingAgents) {
    console.log('[Demo Data] Agents already exist, skipping initialization');
    return;
  }

  console.log('[Demo Data] Creating demo agents...');

  const demoAgents: Agent[] = [
    {
      id: 'agent-nova-001',
      name: 'Nova',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMCIgZmlsbD0iIzZCNjZEQSIvPjx0ZXh0IHg9IjMyIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TjwvdGV4dD48L3N2Zz4=', // Base64 encoded SVG for Nova
      system_prompt: 'You are Nova, a helpful AI assistant designed to assist with programming tasks, answer questions, and provide thoughtful insights.',
      model: 'glm-4.6',
      temperature: 0.7,
      context_token_limit: 4096,
      max_output_tokens: 2048,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'agent-coco-002',
      name: 'Coco',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMCIgZmlsbD0iI0ZGQTVDRSIvPjx0ZXh0IHg9IjMyIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QzwvdGV4dD48L3N2Zz4=', // Base64 encoded SVG for Coco
      system_prompt: 'You are Coco, a friendly and creative AI assistant who loves to help with writing, brainstorming, and creative projects.',
      model: 'glm-4.6',
      temperature: 0.8,
      context_token_limit: 8192,
      max_output_tokens: 4096,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'agent-sage-003',
      name: 'Sage',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMCIgZmlsbD0iIzQyQTU5MiIvPjx0ZXh0IHg9IjMyIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UzwvdGV4dD48L3N2Zz4=', // Base64 encoded SVG for Sage
      system_prompt: 'You are Sage, a knowledgeable AI assistant specialized in research, analysis, and providing detailed explanations.',
      model: 'glm-4.6',
      temperature: 0.5,
      context_token_limit: 16384,
      max_output_tokens: 8192,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  localStorage.setItem('vcpchat-agents', JSON.stringify(demoAgents));
  console.log(`[Demo Data] Created ${demoAgents.length} demo agents`);
}

/**
 * Initialize demo settings if no settings exist
 */
export function initDemoSettings(): void {
  const existingSettings = localStorage.getItem('vcpchat-settings');

  if (existingSettings) {
    console.log('[Demo Data] Settings already exist, skipping initialization');
    return;
  }

  console.log('[Demo Data] Creating demo settings...');

  const demoSettings: Settings = {
    // General Settings
    theme: 'light',
    language: 'en',

    // Backend Configuration
    backend_url: 'http://localhost:6005/v1/chat/completions',
    api_key: 'VCP_ZhipuAI_Access_Key_2025', // Match VCPToolBox/config.env Key value
    websocket_url: 'ws://localhost:6005/VCPlog/VCP_Key=VCP_WebSocket_Key_2025',
    websocket_key: '', // Key is embedded in URL path for VCPToolBox WebSocket server

    // UI Preferences
    sidebar_left_width: 260,
    sidebar_right_width: 260,
    sidebar_left_collapsed: false,
    sidebar_right_collapsed: false,
    show_avatar: true,
    show_timestamp: true,
    message_font_size: 17,

    // Feature Flags
    enable_streaming: true,
    enable_notifications: true,
    enable_plugins: true,
    enable_shortcuts: true,

    // User Profile
    user_name: 'User',
    user_avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMCIgZmlsbD0iIzk5OTk5OSIvPjx0ZXh0IHg9IjMyIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VTwvdGV4dD48L3N2Zz4=', // Base64 encoded default user avatar
  };

  localStorage.setItem('vcpchat-settings', JSON.stringify(demoSettings));
  console.log('[Demo Data] Created demo settings');
}

/**
 * Initialize all demo data
 */
export function initDemoData(): void {
  console.log('[Demo Data] Initializing demonstration data...');

  try {
    initDemoAgents();
    initDemoSettings();
    console.log('[Demo Data] ✅ Demo data initialization complete');
  } catch (error) {
    console.error('[Demo Data] ❌ Failed to initialize demo data:', error);
  }
}
