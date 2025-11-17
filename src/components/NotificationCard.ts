/**
 * NotificationCard Component (US5-016, US5-017)
 *
 * Individual notification card with:
 * - Type-based icon (plugin_complete, system_alert, error)
 * - Message content
 * - Timestamp
 * - Mark as read functionality
 * - Delete action
 */

import { Notification, NotificationType } from '../core/models/notification';
import { t } from '../core/i18n/i18nHelper';

export class NotificationCard {
  private notification: Notification;
  private container: HTMLElement;
  private onMarkAsRead?: (id: string) => void;
  private onDelete?: (id: string) => void;

  constructor(
    notification: Notification,
    onMarkAsRead?: (id: string) => void,
    onDelete?: (id: string) => void
  ) {
    this.notification = notification;
    this.onMarkAsRead = onMarkAsRead;
    this.onDelete = onDelete;

    this.container = document.createElement('div');
    this.render();
  }

  /**
   * Get notification icon based on type
   */
  private getIcon(type: NotificationType): string {
    switch (type) {
      case 'plugin_complete':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      case 'system_alert':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;
      case 'error':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke-width="2" stroke-linecap="round"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;
      case 'tool_request':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      default:
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
    }
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.justNow');
    if (diffMins < 60) return t('notifications.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('notifications.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('notifications.daysAgo', { count: diffDays });

    return date.toLocaleDateString();
  }

  /**
   * Render the notification card
   */
  private render(): void {
    this.container.className = `notification-card notification-${this.notification.type} ${this.notification.read ? 'read' : 'unread'}`;
    this.container.dataset.notificationId = this.notification.id;

    this.container.innerHTML = `
      <div class="notification-icon notification-icon-${this.notification.type}">
        ${this.getIcon(this.notification.type)}
      </div>

      <div class="notification-content">
        <div class="notification-header">
          <span class="notification-title">${this.notification.title}</span>
          <span class="notification-timestamp">${this.formatTimestamp(this.notification.timestamp)}</span>
        </div>

        <div class="notification-message">${this.notification.message}</div>

        ${this.notification.data ? `
          <div class="notification-data">
            ${this.renderNotificationData(this.notification.data)}
          </div>
        ` : ''}
      </div>

      <div class="notification-actions">
        ${!this.notification.read ? `
          <button
            type="button"
            class="notification-action-btn"
            data-action="mark-read"
            title="${t('notifications.markAsRead')}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        ` : ''}

        <button
          type="button"
          class="notification-action-btn"
          data-action="delete"
          title="${t('notifications.delete')}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render notification data (optional extra info)
   */
  private renderNotificationData(data: any): string {
    if (typeof data === 'string') {
      return `<pre>${data}</pre>`;
    }

    if (typeof data === 'object') {
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }

    return '';
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Mark as read button
    const markReadBtn = this.container.querySelector('[data-action="mark-read"]');
    markReadBtn?.addEventListener('click', () => this.markAsRead());

    // Delete button
    const deleteBtn = this.container.querySelector('[data-action="delete"]');
    deleteBtn?.addEventListener('click', () => this.delete());

    // Click on card body to mark as read (if unread)
    if (!this.notification.read) {
      const contentArea = this.container.querySelector('.notification-content');
      contentArea?.addEventListener('click', () => this.markAsRead());
    }
  }

  /**
   * Mark notification as read (US5-017)
   */
  private markAsRead(): void {
    if (this.notification.read) return;

    this.notification.read = true;
    this.container.classList.remove('unread');
    this.container.classList.add('read');

    // Remove mark-as-read button
    const markReadBtn = this.container.querySelector('[data-action="mark-read"]');
    markReadBtn?.remove();

    // Callback
    if (this.onMarkAsRead) {
      this.onMarkAsRead(this.notification.id);
    }
  }

  /**
   * Delete notification
   */
  private delete(): void {
    // Fade out animation
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(20px)';

    setTimeout(() => {
      if (this.onDelete) {
        this.onDelete(this.notification.id);
      }
      this.container.remove();
    }, 300);
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLElement {
    return this.container;
  }
}
