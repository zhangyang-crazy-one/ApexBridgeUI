/**
 * Tauri Browser Mock Layer
 * Provides browser-compatible fallbacks for Tauri-specific APIs
 * Enables frontend testing without Tauri runtime
 */

import { showNotification } from '@/utils/notification-center';

/**
 * Check if running in Tauri environment
 */
export function isTauriAvailable(): boolean {
  return Boolean((window as any).__TAURI__);
}

/**
 * Mock window state for browser testing
 */
interface MockWindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  alwaysOnTop: boolean;
  transparency: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

const mockWindowState: MockWindowState = {
  isMaximized: false,
  isMinimized: false,
  alwaysOnTop: false,
  transparency: 1.0,
  width: 1200,
  height: 800,
  x: 100,
  y: 100
};

/**
 * Browser-compatible window control operations
 */
export const BrowserWindowControls = {
  minimize: async (): Promise<void> => {
    mockWindowState.isMinimized = true;
    mockWindowState.isMaximized = false;
    console.log('[Browser Mock] Window minimized');
    showNotification('info', 'Window Minimized', 'Window has been minimized (browser simulation)');
  },

  maximize: async (): Promise<void> => {
    mockWindowState.isMaximized = true;
    mockWindowState.isMinimized = false;
    console.log('[Browser Mock] Window maximized');
    showNotification('info', 'Window Maximized', 'Window has been maximized (browser simulation)');
  },

  restore: async (): Promise<void> => {
    mockWindowState.isMaximized = false;
    mockWindowState.isMinimized = false;
    console.log('[Browser Mock] Window restored');
    showNotification('info', 'Window Restored', 'Window has been restored (browser simulation)');
  },

  toggleMaximize: async (): Promise<void> => {
    if (mockWindowState.isMaximized) {
      await BrowserWindowControls.restore();
    } else {
      await BrowserWindowControls.maximize();
    }
  },

  close: async (): Promise<void> => {
    console.log('[Browser Mock] Close window requested');
    const confirmed = confirm('Are you sure you want to close the application? (Browser simulation)');
    if (confirmed) {
      showNotification('warning', 'Window Closing', 'Application would close here in Tauri');
    }
  },

  isMaximized: (): boolean => mockWindowState.isMaximized,
  isMinimized: (): boolean => mockWindowState.isMinimized,

  setAlwaysOnTop: async (value: boolean): Promise<void> => {
    mockWindowState.alwaysOnTop = value;
    console.log(`[Browser Mock] Always on top: ${value}`);
    showNotification('info', 'Always on Top', `Window ${value ? 'pinned' : 'unpinned'} (browser simulation)`);
  },

  setTransparency: async (value: number): Promise<void> => {
    mockWindowState.transparency = Math.max(0.2, Math.min(1.0, value));
    console.log(`[Browser Mock] Transparency: ${mockWindowState.transparency}`);
    // Apply visual effect in browser
    document.body.style.opacity = String(mockWindowState.transparency);
    showNotification('info', 'Transparency Changed', `Window transparency: ${Math.round(mockWindowState.transparency * 100)}%`);
  },

  getState: (): MockWindowState => ({ ...mockWindowState })
};

/**
 * Safe invoke wrapper that falls back to localStorage in browser
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (isTauriAvailable()) {
    // Use actual Tauri invoke
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  }

  // Browser fallback using localStorage
  console.log(`[Browser Mock] invoke('${command}', ${JSON.stringify(args)})`);
  return handleBrowserCommand<T>(command, args);
}

/**
 * Handle Tauri commands in browser mode using localStorage
 */
function handleBrowserCommand<T>(
  command: string,
  args?: Record<string, unknown>
): T {
  const storageKey = `vcpchat_${command}`;

  switch (command) {
    // Window commands
    case 'minimize_window':
      BrowserWindowControls.minimize();
      return undefined as T;

    case 'maximize_window':
      BrowserWindowControls.maximize();
      return undefined as T;

    case 'close_window':
      BrowserWindowControls.close();
      return undefined as T;

    case 'set_window_always_on_top':
      BrowserWindowControls.setAlwaysOnTop(args?.alwaysOnTop as boolean);
      return undefined as T;

    case 'set_window_transparency':
      BrowserWindowControls.setTransparency(args?.transparency as number);
      return undefined as T;

    // Agent commands
    case 'list_agents':
      return getStorageArray<T>('vcpchat_agents');

    case 'read_agent':
      return getStorageItem<T>('vcpchat_agents', args?.agentId as string);

    case 'write_agent':
      setStorageItem('vcpchat_agents', args?.agent as any);
      return undefined as T;

    case 'delete_agent':
      deleteStorageItem('vcpchat_agents', args?.agentId as string);
      return undefined as T;

    // Group commands
    case 'list_groups':
      return getStorageArray<T>('vcpchat_groups');

    case 'read_group':
      return getStorageItem<T>('vcpchat_groups', args?.groupId as string);

    case 'write_group':
      setStorageItem('vcpchat_groups', args?.group as any);
      return undefined as T;

    case 'delete_group':
      deleteStorageItem('vcpchat_groups', args?.groupId as string);
      return undefined as T;

    // Topic commands
    case 'list_topics':
      return getStorageArray<T>('vcpchat_topics');

    case 'read_conversation':
      return getStorageItem<T>('vcpchat_topics', args?.topicId as string);

    case 'write_conversation':
      setStorageItem('vcpchat_topics', args?.topic as any);
      return undefined as T;

    case 'delete_conversation':
      deleteStorageItem('vcpchat_topics', args?.topicId as string);
      return undefined as T;

    // Settings commands
    case 'read_settings':
      const settings = localStorage.getItem('vcpchat_settings');
      return settings ? JSON.parse(settings) : getDefaultSettings() as T;

    case 'write_settings':
      localStorage.setItem('vcpchat_settings', JSON.stringify(args?.settings));
      return undefined as T;

    default:
      console.warn(`[Browser Mock] Unknown command: ${command}`);
      throw new Error(`Browser mock does not support command: ${command}`);
  }
}

/**
 * Get array from localStorage
 */
function getStorageArray<T>(key: string): T {
  const data = localStorage.getItem(key);
  return (data ? JSON.parse(data) : []) as T;
}

/**
 * Get single item from localStorage array by ID
 */
function getStorageItem<T>(key: string, id: string): T {
  const array = JSON.parse(localStorage.getItem(key) || '[]');
  const item = array.find((item: any) => item.id === id);
  if (!item) {
    throw new Error(`Item with id ${id} not found`);
  }
  return item as T;
}

/**
 * Set item in localStorage array (add or update)
 */
function setStorageItem(key: string, item: any): void {
  const array = JSON.parse(localStorage.getItem(key) || '[]');
  const index = array.findIndex((existing: any) => existing.id === item.id);
  if (index >= 0) {
    array[index] = item;
  } else {
    array.push(item);
  }
  localStorage.setItem(key, JSON.stringify(array));
}

/**
 * Delete item from localStorage array by ID
 */
function deleteStorageItem(key: string, id: string): void {
  const array = JSON.parse(localStorage.getItem(key) || '[]');
  const filtered = array.filter((item: any) => item.id !== id);
  localStorage.setItem(key, JSON.stringify(filtered));
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    user: {
      name: 'User',
      avatar: ''
    },
    backend: {
      url: 'http://localhost:6005/v1/chat/completions',
      apiKey: '',
      websocketUrl: '',
      websocketKey: ''
    },
    window: {
      alwaysOnTop: false,
      transparency: 1.0,
      width: 1200,
      height: 800,
      x: 100,
      y: 100,
      startupBehavior: 'normal'
    },
    shortcuts: {
      send_message: 'Ctrl+Enter',
      new_topic: 'Ctrl+N',
      search: 'Ctrl+F'
    },
    appearance: {
      theme: 'default',
      language: 'en-US'
    }
  };
}

/**
 * Initialize browser mock layer
 * Call this at app startup to set up browser fallbacks
 */
export function initBrowserMock(): void {
  if (isTauriAvailable()) {
    console.log('[Tauri Mock] Running in Tauri environment - no mock needed');
    return;
  }

  console.log('[Browser Mock] Initializing browser compatibility layer');

  // Add visual indicator for browser mode
  const indicator = document.createElement('div');
  indicator.id = 'browser-mode-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 165, 0, 0.9);
    color: #000;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10000;
    pointer-events: none;
  `;
  indicator.textContent = 'Browser Test Mode';
  document.body.appendChild(indicator);

  // Override console for better visibility
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    if (args[0]?.toString().includes('[Browser Mock]')) {
      originalLog('%c' + args[0], 'color: #ff9800; font-weight: bold', ...args.slice(1));
    } else {
      originalLog(...args);
    }
  };

  console.log('[Browser Mock] Browser compatibility layer initialized');
}

/**
 * Export mock state for testing
 */
export function getMockWindowState(): MockWindowState {
  return { ...mockWindowState };
}
