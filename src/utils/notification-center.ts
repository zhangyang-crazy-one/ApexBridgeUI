/**
 * Notification Center
 * Manages notifications from WebSocket and other sources
 */

import { showCustomConfirm } from './custom-modal';

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
}

export class NotificationCenter {
  private static instance: NotificationCenter;
  private notifications: Notification[] = [];
  private container: HTMLElement | null = null;
  private clearButton: HTMLElement | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): NotificationCenter {
    if (!NotificationCenter.instance) {
      NotificationCenter.instance = new NotificationCenter();
    }
    return NotificationCenter.instance;
  }

  /**
   * Initialize notification center
   */
  private init(): void {
    this.container = document.getElementById('notifications-container');
    this.clearButton = document.getElementById('clear-notifications-btn');

    if (!this.container) {
      console.warn('[NotificationCenter] Container not found');
      return;
    }

    // Bind clear button
    this.clearButton?.addEventListener('click', () => {
      this.clearAll();
    });

    console.log('[NotificationCenter] Initialized');
  }

  /**
   * Add a new notification
   */
  public addNotification(notification: Omit<Notification, 'id' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      read: false
    };

    this.notifications.unshift(newNotification);
    this.render();
  }

  /**
   * Mark notification as read
   */
  public markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.render();
    }
  }

  /**
   * Clear all notifications
   */
  public async clearAll(): Promise<void> {
    const confirmed = await showCustomConfirm({
      title: '确认操作',
      message: '您确定要清除所有通知吗？此操作不可撤销。',
      confirmText: '确认清除',
      cancelText: '取消'
    });

    if (confirmed) {
      this.notifications = [];
      this.render();
    }
  }

  /**
   * Render notifications
   */
  private render(): void {
    if (!this.container) return;

    if (this.notifications.length === 0) {
      this.container.innerHTML = `
        <div class="empty-notifications">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
          </svg>
          <p>No notifications yet</p>
        </div>
      `;
      if (this.clearButton) {
        (this.clearButton as HTMLButtonElement).disabled = true;
      }
      return;
    }

    if (this.clearButton) {
      (this.clearButton as HTMLButtonElement).disabled = false;
    }

    this.container.innerHTML = this.notifications.map(notification => `
      <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">${notification.time}</div>
      </div>
    `).join('');

    // Bind click events
    this.container.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.id;
        if (id) {
          this.markAsRead(id);
        }
      });
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format time (for display)
   */
  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  /**
   * Add WebSocket notification listener
   */
  public setupWebSocketListener(wsClient: any): void {
    // Register notification handler for WebSocket messages
    wsClient.on({
      onNotification: (notification: any) => {
        console.log('[NotificationCenter] Received WebSocket notification:', notification);

        // Convert WebSocket notification format to NotificationCenter format
        this.addNotification({
          title: notification.title || 'Notification',
          message: notification.message || notification.content || '',
          time: notification.time || new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          type: notification.type || 'info'
        });
      },

      onStateChange: (state: string) => {
        console.log('[NotificationCenter] WebSocket state changed:', state);

        // Show connection status notifications
        if (state === 'connected') {
          this.addNotification({
            title: 'WebSocket Connected',
            message: 'Successfully connected to VCP backend',
            time: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            type: 'success'
          });
        } else if (state === 'error' || state === 'disconnected') {
          this.addNotification({
            title: 'WebSocket Disconnected',
            message: 'Lost connection to VCP backend. Attempting to reconnect...',
            time: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            type: 'warning'
          });
        }
      },

      onError: (error: Error) => {
        console.error('[NotificationCenter] WebSocket error:', error);
        this.addNotification({
          title: 'WebSocket Error',
          message: error.message || 'An error occurred with the WebSocket connection',
          time: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          type: 'error'
        });
      }
    });

    console.log('[NotificationCenter] WebSocket listener registered');
  }
}

/**
 * Initialize notification center
 */
export function initNotificationCenter(): NotificationCenter {
  return NotificationCenter.getInstance();
}

/**
 * Helper function to show a notification
 * @param type Notification type: 'info' | 'success' | 'warning' | 'error'
 * @param title Notification title
 * @param message Notification message
 */
export function showNotification(
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  message: string
): void {
  const notificationCenter = NotificationCenter.getInstance();
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  notificationCenter.addNotification({
    title,
    message,
    time: timeString,
    type
  });
}
