/**
 * Path Utilities
 *
 * Provides path conversion functions for assets (avatars, images, etc.)
 * to work in both development and packaged environments.
 */

// Import Tauri converter if available
let convertFileSrcFunc: ((filePath: string, protocol?: string) => string) | null = null;
let tauriInitialized = false;

// Dynamically import Tauri API (only available in Tauri environment)
(async () => {
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    convertFileSrcFunc = convertFileSrc;
    tauriInitialized = true;
    console.log('[PathUtils] Tauri convertFileSrc initialized');
  } catch (error) {
    tauriInitialized = true; // Mark as initialized even on failure
    console.warn('[PathUtils] Tauri not available, using fallback paths');
  }
})();

/**
 * Convert avatar path to work in both dev and packaged environments
 * - In dev: Uses HTTP protocol (http://localhost:1420/)
 * - In exe: Uses Tauri asset protocol (asset://localhost/)
 * - In browser: Returns path as-is
 * - Supports absolute paths (C:\..., /usr/..., etc.)
 *
 * @param avatarPath - Original avatar path
 * @returns Converted path suitable for current environment
 */
export function convertAvatarPath(avatarPath: string): string {
  // Already converted or absolute URL
  if (avatarPath.startsWith('asset://') ||
      avatarPath.startsWith('http://') ||
      avatarPath.startsWith('https://') ||
      avatarPath.startsWith('data:')) {
    return avatarPath;
  }

  // Check if it's an absolute Windows path (C:\..., D:\..., etc.)
  const isWindowsAbsolutePath = /^[a-zA-Z]:[\\\/]/.test(avatarPath);
  // Check if it's an absolute Unix path (starting with / but not a relative web path)
  // Note: relative paths like "/assets/..." should NOT be treated as absolute
  const isUnixAbsolutePath = /^\/[^\/]/.test(avatarPath) && !avatarPath.startsWith('/assets');

  const isAbsolutePath = isWindowsAbsolutePath || isUnixAbsolutePath;

  // Use Tauri converter if available (packaged exe)
  if (convertFileSrcFunc !== null) {
    try {
      // For absolute paths, convert directly
      if (isAbsolutePath) {
        console.log(`[PathUtils] Converting absolute path: ${avatarPath}`);
        return convertFileSrcFunc(avatarPath);
      }

      // For relative paths, remove leading slash for Tauri
      const cleanPath = avatarPath.startsWith('/') ? avatarPath.slice(1) : avatarPath;
      return convertFileSrcFunc(cleanPath);
    } catch (error) {
      console.warn(`[PathUtils] Failed to convert path: ${avatarPath}`, error);
      // Fallback: For absolute paths that failed conversion, try to make them work in browser
      if (isAbsolutePath) {
        console.warn(`[PathUtils] Absolute paths are not supported in browser mode`);
        // Return a placeholder or default avatar
        return 'assets/avatars/default.svg';
      }
      return avatarPath;
    }
  }

  // Fallback for dev/browser mode
  // For absolute paths in dev mode, they won't work due to browser security
  if (isAbsolutePath) {
    console.warn(`[PathUtils] Absolute path detected in browser mode (not supported): ${avatarPath}`);
    console.warn(`[PathUtils] Absolute paths only work in Tauri desktop app. Using default avatar.`);
    // Return default avatar instead of the absolute path
    return 'assets/avatars/default.svg';
  }

  // For relative paths, return as-is
  return avatarPath;
}

/**
 * Get default avatar path for user
 */
export function getDefaultUserAvatar(): string {
  return 'assets/avatars/default-user.png';
}

/**
 * Get default avatar path for agent
 */
export function getDefaultAgentAvatar(): string {
  return 'assets/avatars/default.svg';
}

