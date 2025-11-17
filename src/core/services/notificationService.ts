/**
 * NotificationService (US5-019)
 *
 * Manages notification lifecycle:
 * - Receives notifications from WebSocket
 * - Plays notification sounds
 * - Updates badge counts
 * - Integrates with NotificationsPanel
 */

import { Notification, NotificationType } from '../models/notification';
import { VCPWebSocketClient } from './websocketClient';

export class NotificationService {
  private static instance: NotificationService;
  private websocketClient: VCPWebSocketClient | null = null;
  private notificationHandlers: Set<(notification: Notification) => void> = new Set();
  private soundEnabled: boolean = true;
  private badgeCount: number = 0;

  private constructor() {
    this.initializeWebSocketListener();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize WebSocket listener for notifications
   */
  private initializeWebSocketListener(): void {
    // Get WebSocket client instance
    this.websocketClient = VCPWebSocketClient.getInstance();

    // Listen for notification messages
    this.websocketClient.on('notification', (data: any) => {
      this.handleWebSocketNotification(data);
    });

    this.websocketClient.on('plugin_complete', (data: any) => {
      this.createNotification({
        type: 'plugin_complete',
        title: 'Plugin Completed',
        message: data.message || 'A plugin operation has completed',
        data: data.result
      });
    });

    this.websocketClient.on('system_alert', (data: any) => {
      this.createNotification({
        type: 'system_alert',
        title: 'System Alert',
        message: data.message || 'System notification',
        data: data
      });
    });

    this.websocketClient.on('error', (data: any) => {
      this.createNotification({
        type: 'error',
        title: 'Error',
        message: data.message || 'An error occurred',
        data: data.details
      });
    });
  }

  /**
   * Handle WebSocket notification
   */
  private handleWebSocketNotification(data: any): void {
    const notification: Notification = {
      id: this.generateId(),
      type: data.type || 'system_alert',
      title: data.title || 'Notification',
      message: data.message || '',
      timestamp: new Date().toISOString(),
      read: false,
      data: data.data
    };

    this.notifyHandlers(notification);
  }

  /**
   * Create a new notification
   */
  public createNotification(params: {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }): void {
    const notification: Notification = {
      id: this.generateId(),
      type: params.type,
      title: params.title,
      message: params.message,
      timestamp: new Date().toISOString(),
      read: false,
      data: params.data
    };

    this.notifyHandlers(notification);
    this.playNotificationSound();
    this.incrementBadge();
    this.showSystemNotification(notification);
  }

  /**
   * Register notification handler
   */
  public onNotification(handler: (notification: Notification) => void): void {
    this.notificationHandlers.add(handler);
  }

  /**
   * Unregister notification handler
   */
  public offNotification(handler: (notification: Notification) => void): void {
    this.notificationHandlers.delete(handler);
  }

  /**
   * Notify all handlers
   */
  private notifyHandlers(notification: Notification): void {
    this.notificationHandlers.forEach(handler => {
      try {
        handler(notification);
      } catch (error) {
        console.error('Notification handler error:', error);
      }
    });
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    if (!this.soundEnabled) return;

    try {
      const audio = new Audio('assets/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => {
        console.error('Failed to play notification sound:', err);
      });
    } catch (error) {
      console.error('Notification sound error:', error);
    }
  }

  /**
   * Show system notification (OS-level)
   */
  private async showSystemNotification(notification: Notification): Promise<void> {
    try {
      // Check if Tauri notification API is available
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/api/notification');

      let permissionGranted = await isPermissionGranted();

      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        sendNotification({
          title: notification.title,
          body: notification.message,
          icon: 'assets/icons/notification-icon.png'
        });
      }
    } catch (error) {
      console.error('Failed to show system notification:', error);
    }
  }

  /**
   * Increment badge count
   */
  private incrementBadge(): void {
    this.badgeCount++;
    this.updateBadge();
  }

  /**
   * Decrement badge count
   */
  public decrementBadge(): void {
    if (this.badgeCount > 0) {
      this.badgeCount--;
      this.updateBadge();
    }
  }

  /**
   * Reset badge count
   */
  public resetBadge(): void {
    this.badgeCount = 0;
    this.updateBadge();
  }

  /**
   * Update badge display
   */
  private updateBadge(): void {
    // Update badge in UI
    const badge = document.querySelector('#notifications-badge');
    if (badge) {
      badge.textContent = this.badgeCount.toString();

      if (this.badgeCount > 0) {
        badge.classList.add('has-notifications');
      } else {
        badge.classList.remove('has-notifications');
      }
    }

    // Update app badge (Tauri API)
    this.updateAppBadge(this.badgeCount);
  }

  /**
   * Update app badge (dock/taskbar icon)
   */
  private async updateAppBadge(count: number): Promise<void> {
    try {
      const { appWindow } = await import('@tauri-apps/api/window');

      // Set badge count (platform-specific)
      // macOS: Shows number on dock icon
      // Windows: Shows overlay on taskbar
      await appWindow.setBadgeLabel(count > 0 ? count.toString() : null);
    } catch (error) {
      console.error('Failed to update app badge:', error);
    }
  }

  /**
   * Enable/disable notification sounds
   */
  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current badge count
   */
  public getBadgeCount(): number {
    return this.badgeCount;
  }
}
