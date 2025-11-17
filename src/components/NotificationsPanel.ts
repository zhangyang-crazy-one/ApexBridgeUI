/**
 * NotificationsPanel Component (US5-015, US5-018)
 *
 * Manages notification display:
 * - List view of all notifications
 * - Filter by read/unread
 * - Clear all notifications action
 * - Badge count display
 * - Real-time updates from WebSocket
 */

import { Notification } from '../core/models/notification';
import { NotificationCard } from './NotificationCard';
import { t } from '../core/i18n/i18nHelper';

export class NotificationsPanel {
  private container: HTMLElement;
  private notifications: Notification[] = [];
  private notificationCards: Map<string, NotificationCard> = new Map();
  private filter: 'all' | 'unread' | 'read' = 'all';

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.loadNotifications();
  }

  /**
   * Render the notifications panel
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="notifications-panel">
        <!-- Header -->
        <div class="notifications-header">
          <h3>${t('notifications.title')}</h3>
          <div class="notifications-badge" id="notifications-badge">0</div>
        </div>

        <!-- Filter Tabs -->
        <div class="notifications-filters">
          <button
            class="filter-btn active"
            data-filter="all"
          >
            ${t('notifications.all')}
          </button>
          <button
            class="filter-btn"
            data-filter="unread"
          >
            ${t('notifications.unread')}
          </button>
          <button
            class="filter-btn"
            data-filter="read"
          >
            ${t('notifications.read')}
          </button>
        </div>

        <!-- Actions -->
        <div class="notifications-actions">
          <button
            type="button"
            class="btn-secondary btn-sm"
            id="mark-all-read-btn"
          >
            ${t('notifications.markAllRead')}
          </button>
          <button
            type="button"
            class="btn-secondary btn-sm"
            id="clear-all-btn"
          >
            ${t('notifications.clearAll')}
          </button>
        </div>

        <!-- Notifications List -->
        <div class="notifications-list" id="notifications-list">
          <div class="notifications-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="1" y1="1" x2="23" y2="23" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>${t('notifications.noNotifications')}</p>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const filter = target.dataset.filter as typeof this.filter;

        // Update active button
        filterBtns.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        // Apply filter
        this.filter = filter;
        this.applyFilter();
      });
    });

    // Mark all as read button
    const markAllReadBtn = this.container.querySelector('#mark-all-read-btn');
    markAllReadBtn?.addEventListener('click', () => this.markAllAsRead());

    // Clear all button (US5-018)
    const clearAllBtn = this.container.querySelector('#clear-all-btn');
    clearAllBtn?.addEventListener('click', () => this.clearAll());
  }

  /**
   * Load notifications from storage
   */
  private async loadNotifications(): Promise<void> {
    try {
      // Load notifications from Tauri IPC
      const { invoke } = await import('@tauri-apps/api/core');
      this.notifications = await invoke('read_notifications');

      this.renderNotifications();
      this.updateBadge();
    } catch (error) {
      console.error('Failed to load notifications:', error);
      // Initialize with empty array
      this.notifications = [];
    }
  }

  /**
   * Render notifications list
   */
  private renderNotifications(): void {
    const listContainer = this.container.querySelector('#notifications-list');
    if (!listContainer) return;

    // Clear existing cards
    this.notificationCards.clear();
    listContainer.innerHTML = '';

    // Filter notifications
    let filteredNotifications = this.notifications;

    if (this.filter === 'unread') {
      filteredNotifications = this.notifications.filter(n => !n.read);
    } else if (this.filter === 'read') {
      filteredNotifications = this.notifications.filter(n => n.read);
    }

    // Show empty state if no notifications
    if (filteredNotifications.length === 0) {
      listContainer.innerHTML = `
        <div class="notifications-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>${t('notifications.noNotifications')}</p>
        </div>
      `;
      return;
    }

    // Render notification cards
    filteredNotifications.forEach(notification => {
      const card = new NotificationCard(
        notification,
        (id) => this.handleMarkAsRead(id),
        (id) => this.handleDelete(id)
      );

      this.notificationCards.set(notification.id, card);
      listContainer.appendChild(card.getElement());
    });
  }

  /**
   * Apply filter
   */
  private applyFilter(): void {
    this.renderNotifications();
  }

  /**
   * Handle mark as read
   */
  private async handleMarkAsRead(id: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      await this.saveNotifications();
      this.updateBadge();
    }
  }

  /**
   * Handle delete
   */
  private async handleDelete(id: string): Promise<void> {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notificationCards.delete(id);
    await this.saveNotifications();
    this.updateBadge();

    // Re-render if list is now empty
    const listContainer = this.container.querySelector('#notifications-list');
    if (listContainer && listContainer.children.length === 0) {
      this.renderNotifications();
    }
  }

  /**
   * Mark all as read
   */
  private async markAllAsRead(): Promise<void> {
    this.notifications.forEach(n => n.read = true);

    await this.saveNotifications();
    this.renderNotifications();
    this.updateBadge();
  }

  /**
   * Clear all notifications (US5-018)
   */
  private async clearAll(): Promise<void> {
    const confirmed = confirm(t('notifications.clearAllConfirm'));
    if (!confirmed) return;

    this.notifications = [];
    this.notificationCards.clear();

    await this.saveNotifications();
    this.renderNotifications();
    this.updateBadge();
  }

  /**
   * Update badge count
   */
  private updateBadge(): void {
    const badge = this.container.querySelector('#notifications-badge');
    if (!badge) return;

    const unreadCount = this.notifications.filter(n => !n.read).length;

    badge.textContent = unreadCount.toString();

    if (unreadCount > 0) {
      badge.classList.add('has-notifications');
    } else {
      badge.classList.remove('has-notifications');
    }
  }

  /**
   * Save notifications to storage
   */
  private async saveNotifications(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_notifications', { notifications: this.notifications });
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }

  /**
   * Add new notification (called from WebSocket or other sources)
   */
  public async addNotification(notification: Notification): Promise<void> {
    this.notifications.unshift(notification); // Add to beginning

    await this.saveNotifications();
    this.renderNotifications();
    this.updateBadge();

    // Play notification sound (if enabled in settings)
    this.playNotificationSound();
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    try {
      const audio = new Audio('assets/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.error('Failed to play notification sound:', err));
    } catch (error) {
      console.error('Notification sound error:', error);
    }
  }

  /**
   * Get unread count (for external use)
   */
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }
}
