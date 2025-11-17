// GlobalSettings data model
export interface WindowPreferences {
  always_on_top: boolean;
  transparency: number;              // 0.0 (透明) 到 1.0 (不透明)
  startup_behavior: 'normal' | 'minimized' | 'hidden';
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SidebarWidths {
  agents_list: number;               // 像素
  notifications: number;             // 像素
}

export interface KeyboardShortcut {
  action: string;
  keys: string;                      // 如 "Ctrl+Enter", "Cmd+N"
}

/**
 * CORE-012G: Streaming preferences
 * Controls how AI responses are displayed during streaming
 */
export interface StreamingPreferences {
  smooth_streaming: boolean;         // true=逐字显示, false=立即显示完整响应
  chunk_delay_ms: number;           // 每个chunk之间的延迟 (仅smooth_streaming=true时)
  enable_morphdom: boolean;         // 启用morphdom DOM优化
  scroll_throttle_ms: number;       // 滚动节流延迟
  buffer_size: number;              // 预缓冲chunk数量
}

export interface GlobalSettings {
  backend_url: string;               // VCPToolBox URL
  api_key: string;                   // Bearer 令牌
  websocket_url?: string;            // WebSocket URL (可选)
  websocket_key?: string;            // WebSocket 认证密钥 (可选)
  user_name: string;                 // 用户显示名称
  user_avatar: string;               // 用户头像路径
  theme: string;                     // 主题名称
  language: 'zh-CN' | 'en-US';       // 界面语言 (中文/English) - Added 2025-10-28
  sidebar_widths: SidebarWidths;
  window_preferences: WindowPreferences;
  streaming_preferences: StreamingPreferences; // CORE-012G: Streaming settings
  keyboard_shortcuts: KeyboardShortcut[];
}

/**
 * Get default settings
 */
export function getDefaultSettings(): GlobalSettings {
  return {
    backend_url: 'http://localhost:6005/v1/chat/completions',
    api_key: '',
    user_name: 'User',
    user_avatar: 'assets/avatars/default-user.png',
    theme: 'claude-light',
    language: 'zh-CN',  // Default to Chinese
    sidebar_widths: {
      agents_list: 280,
      notifications: 300
    },
    window_preferences: {
      always_on_top: false,
      transparency: 1.0,
      startup_behavior: 'normal',
      width: 1200,
      height: 800,
      x: 100,
      y: 100
    },
    // CORE-012G: Default streaming preferences
    streaming_preferences: {
      smooth_streaming: true,        // 默认启用平滑流式传输
      chunk_delay_ms: 0,            // 无额外延迟（自然网络延迟）
      enable_morphdom: true,        // 启用morphdom优化
      scroll_throttle_ms: 100,      // 100ms滚动节流
      buffer_size: 3                // 预缓冲3个chunks
    },
    keyboard_shortcuts: [
      { action: 'send_message', keys: 'Ctrl+Enter' },
      { action: 'new_topic', keys: 'Ctrl+N' },
      { action: 'search', keys: 'Ctrl+F' }
    ]
  };
}

/**
 * Validate GlobalSettings data
 */
export function validateSettings(settings: GlobalSettings): string | null {
  // Validate URL
  try {
    new URL(settings.backend_url);
  } catch {
    return 'Settings backend_url must be a valid HTTP(S) URL';
  }

  if (!settings.user_name || settings.user_name.length < 1 || settings.user_name.length > 50) {
    return 'Settings user_name must be 1-50 characters';
  }

  if (!settings.user_avatar || settings.user_avatar.length === 0) {
    return 'Settings user_avatar is required';
  }

  if (!settings.theme || settings.theme.length === 0) {
    return 'Settings theme is required';
  }

  // Validate language
  if (settings.language !== 'zh-CN' && settings.language !== 'en-US') {
    return 'Settings language must be "zh-CN" or "en-US"';
  }

  // Validate transparency
  if (settings.window_preferences.transparency < 0.0 || settings.window_preferences.transparency > 1.0) {
    return 'Settings window transparency must be between 0.0 and 1.0';
  }

  // Validate window size
  if (settings.window_preferences.width < 800) {
    return 'Settings window width must be >= 800';
  }
  if (settings.window_preferences.height < 600) {
    return 'Settings window height must be >= 600';
  }

  // Validate sidebar widths
  if (settings.sidebar_widths.agents_list < 200 || settings.sidebar_widths.agents_list > 600) {
    return 'Settings agents_list sidebar width must be between 200 and 600';
  }
  if (settings.sidebar_widths.notifications < 200 || settings.sidebar_widths.notifications > 600) {
    return 'Settings notifications sidebar width must be between 200 and 600';
  }

  // CORE-012G: Validate streaming preferences
  if (settings.streaming_preferences.chunk_delay_ms < 0) {
    return 'Settings chunk_delay_ms must be non-negative';
  }
  if (settings.streaming_preferences.scroll_throttle_ms < 16 || settings.streaming_preferences.scroll_throttle_ms > 500) {
    return 'Settings scroll_throttle_ms must be between 16 and 500 (16ms = 60fps, 500ms = 2fps)';
  }
  if (settings.streaming_preferences.buffer_size < 1 || settings.streaming_preferences.buffer_size > 10) {
    return 'Settings buffer_size must be between 1 and 10';
  }

  return null;
}
