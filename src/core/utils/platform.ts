/**
 * Platform Detection Utility for VCPChat
 *
 * Provides platform detection and feature gating for cross-platform compatibility.
 * Detects whether running in Tauri, browser, and which OS/platform.
 *
 * US6-009: Platform detection utility for feature gating
 * US6-018: Web debug mirror detection and feature flags
 */

/**
 * Platform types
 */
export type Platform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'browser';

/**
 * Environment type
 */
export type Environment = 'tauri' | 'browser' | 'unknown';

/**
 * Platform detection result
 */
export interface PlatformInfo {
  platform: Platform;
  environment: Environment;
  isTauri: boolean;
  isBrowser: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  isDevelopment: boolean;
  isDebugMirror: boolean; // Running in web debug mirror (localhost:1420)
}

/**
 * Detect current platform
 */
function detectPlatform(): Platform {
  // Check if running in Tauri
  // @ts-ignore - __TAURI__ is injected by Tauri
  if (typeof window !== 'undefined' && window.__TAURI__ !== undefined) {
    // Platform detection in Tauri
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    if (userAgent.includes('windows') || navigator.platform.toLowerCase().includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
  }

  // Browser environment
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (userAgent.includes('android')) return 'android';
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';

  return 'browser';
}

/**
 * Detect environment (Tauri or browser)
 */
function detectEnvironment(): Environment {
  // @ts-ignore - __TAURI__ is injected by Tauri
  if (typeof window !== 'undefined' && window.__TAURI__ !== undefined) {
    return 'tauri';
  }

  // Check if we're in a browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  return 'unknown';
}

/**
 * Check if running in development mode
 */
function isDevelopment(): boolean {
  // Check if in Vite development mode
  if (import.meta.env.DEV) {
    return true;
  }

  // Check if running on localhost
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  return false;
}

/**
 * Check if running in web debug mirror (localhost:1420)
 */
function isDebugMirror(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' &&
    window.location.port === '1420' &&
    detectEnvironment() === 'browser'
  );
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = detectPlatform();
  const environment = detectEnvironment();

  return {
    platform,
    environment,
    isTauri: environment === 'tauri',
    isBrowser: environment === 'browser',
    isDesktop: platform === 'windows' || platform === 'macos' || platform === 'linux',
    isMobile: platform === 'android' || platform === 'ios',
    isAndroid: platform === 'android',
    isIOS: platform === 'ios',
    isWindows: platform === 'windows',
    isMacOS: platform === 'macos',
    isLinux: platform === 'linux',
    isDevelopment: isDevelopment(),
    isDebugMirror: isDebugMirror(),
  };
}

/**
 * Cached platform info (avoid repeated detection)
 */
let cachedPlatformInfo: PlatformInfo | null = null;

/**
 * Get cached platform info
 */
export function platform(): PlatformInfo {
  if (!cachedPlatformInfo) {
    cachedPlatformInfo = getPlatformInfo();
  }
  return cachedPlatformInfo;
}

/**
 * Feature flags based on platform
 */
export const features = {
  /**
   * Check if Tauri commands are available
   */
  hasTauriCommands(): boolean {
    return platform().isTauri;
  },

  /**
   * Check if window controls should be shown
   */
  hasWindowControls(): boolean {
    return platform().isDesktop && platform().isTauri;
  },

  /**
   * Check if file system access is available
   */
  hasFileSystem(): boolean {
    return platform().isTauri;
  },

  /**
   * Check if notifications are available
   */
  hasNotifications(): boolean {
    return platform().isTauri || ('Notification' in window);
  },

  /**
   * Check if audio engine is available
   */
  hasAudioEngine(): boolean {
    // Python audio engine only available in Tauri desktop builds
    return platform().isTauri && platform().isDesktop;
  },

  /**
   * Check if WebSocket is available
   */
  hasWebSocket(): boolean {
    return 'WebSocket' in window;
  },

  /**
   * Check if developer tools should be enabled
   */
  hasDevTools(): boolean {
    return platform().isDevelopment;
  },

  /**
   * Check if mobile-optimized UI should be used
   */
  useMobileUI(): boolean {
    return platform().isMobile;
  },

  /**
   * Check if touch events should be used
   */
  useTouchEvents(): boolean {
    return platform().isMobile || ('ontouchstart' in window);
  },
};

/**
 * Conditional execution based on platform
 */
export function onPlatform<T>(
  handlers: Partial<Record<Platform | 'default', () => T>>
): T | undefined {
  const currentPlatform = platform().platform;

  if (handlers[currentPlatform]) {
    return handlers[currentPlatform]!();
  }

  if (handlers.default) {
    return handlers.default();
  }

  return undefined;
}

/**
 * Conditional execution based on environment
 */
export function onEnvironment<T>(
  handlers: Partial<Record<Environment | 'default', () => T>>
): T | undefined {
  const currentEnv = platform().environment;

  if (handlers[currentEnv]) {
    return handlers[currentEnv]!();
  }

  if (handlers.default) {
    return handlers.default();
  }

  return undefined;
}

// Export platform info as default
export default platform();
