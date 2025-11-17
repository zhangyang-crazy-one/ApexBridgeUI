/**
 * Avatar Display System (CORE-014)
 *
 * Responsibilities:
 * - Render user and agent avatars
 * - Handle avatar image loading with fallbacks
 * - Provide default avatars for entities without custom images
 * - Cache avatar elements for performance
 */

import type { Message } from '@core/models';

export interface AvatarOptions {
  size?: number;                    // Avatar size in pixels (default: 32)
  shape?: 'circle' | 'rounded';     // Avatar shape (default: circle)
  fallbackText?: string;            // Text for fallback avatar (initials)
  className?: string;               // Additional CSS classes
}

/**
 * Avatar Display Manager
 * Handles avatar rendering and caching
 */
export class AvatarManager {
  private static instance: AvatarManager;
  private avatarCache: Map<string, HTMLElement> = new Map();
  private imageLoadErrors: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): AvatarManager {
    if (!AvatarManager.instance) {
      AvatarManager.instance = new AvatarManager();
    }
    return AvatarManager.instance;
  }

  /**
   * Create avatar element for a message
   */
  public createAvatar(
    message: Message,
    avatarPath: string,
    options: AvatarOptions = {}
  ): HTMLElement {
    const {
      size = 32,
      shape = 'circle',
      fallbackText = message.sender_name?.charAt(0)?.toUpperCase() || '?',
      className = ''
    } = options;

    // Check cache
    const cacheKey = `${message.sender_id}_${avatarPath}_${size}`;
    if (this.avatarCache.has(cacheKey)) {
      return this.avatarCache.get(cacheKey)!.cloneNode(true) as HTMLElement;
    }

    const container = document.createElement('div');
    container.className = `avatar avatar--${shape} ${className}`.trim();
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.setAttribute('data-sender-id', message.sender_id || '');
    container.setAttribute('data-sender-type', message.sender);

    // If image path is available and hasn't failed before, try loading it
    if (avatarPath && !this.imageLoadErrors.has(avatarPath)) {
      const img = this.createImageElement(avatarPath, fallbackText, size);
      container.appendChild(img);
    } else {
      // Use fallback avatar
      const fallback = this.createFallbackAvatar(fallbackText, message.sender, size);
      container.appendChild(fallback);
    }

    // Cache avatar element
    this.avatarCache.set(cacheKey, container.cloneNode(true) as HTMLElement);

    return container;
  }

  /**
   * Create image element with error handling
   */
  private createImageElement(
    src: string,
    fallbackText: string,
    size: number
  ): HTMLImageElement {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Avatar for ${fallbackText}`;
    img.className = 'avatar__image';
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;

    // Handle image load errors
    img.addEventListener('error', () => {
      console.warn(`[AvatarManager] Failed to load avatar: ${src}`);
      this.imageLoadErrors.add(src);

      // Replace with fallback
      const parent = img.parentElement;
      if (parent) {
        const sender = parent.getAttribute('data-sender-type') as 'user' | 'agent';
        const fallback = this.createFallbackAvatar(fallbackText, sender, size);
        parent.replaceChild(fallback, img);
      }
    });

    return img;
  }

  /**
   * Create fallback avatar with initials
   */
  private createFallbackAvatar(
    text: string,
    sender: 'user' | 'agent',
    size: number
  ): HTMLElement {
    const fallback = document.createElement('div');
    fallback.className = `avatar__fallback avatar__fallback--${sender}`;
    fallback.textContent = text;
    fallback.style.width = `${size}px`;
    fallback.style.height = `${size}px`;
    fallback.style.fontSize = `${size * 0.45}px`; // 45% of avatar size
    fallback.style.lineHeight = `${size}px`;

    return fallback;
  }

  /**
   * Get initials from name (first letter of first name + first letter of last name)
   */
  public static getInitials(name: string): string {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    // First letter of first name + first letter of last name
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Clear avatar cache
   */
  public clearCache(): void {
    this.avatarCache.clear();
    console.log('[AvatarManager] Avatar cache cleared');
  }

  /**
   * Clear cached avatar for specific sender
   */
  public clearSenderCache(senderId: string): void {
    const keysToDelete: string[] = [];
    this.avatarCache.forEach((_, key) => {
      if (key.startsWith(senderId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.avatarCache.delete(key));
    console.log(`[AvatarManager] Cleared ${keysToDelete.length} cached avatars for sender: ${senderId}`);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; failedImages: number } {
    return {
      size: this.avatarCache.size,
      failedImages: this.imageLoadErrors.size
    };
  }
}

/**
 * Initialize avatar manager and export singleton instance
 */
export function initAvatarManager(): AvatarManager {
  return AvatarManager.getInstance();
}

/**
 * Helper function to create avatar from message and global settings
 */
export function createMessageAvatar(
  message: Message,
  userAvatar: string,
  agentAvatars: Map<string, string>,
  options?: AvatarOptions
): HTMLElement {
  const manager = AvatarManager.getInstance();

  let avatarPath: string;
  if (message.sender === 'user') {
    avatarPath = userAvatar;
  } else {
    avatarPath = agentAvatars.get(message.sender_id || '') || '';
  }

  const fallbackText = AvatarManager.getInitials(message.sender_name || '?');

  return manager.createAvatar(message, avatarPath, {
    ...options,
    fallbackText
  });
}
