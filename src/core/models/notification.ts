// Notification data model
export type NotificationType = 'plugin_complete' | 'system_alert' | 'error';

export interface Notification {
  id: string;                        // 唯一标识符 (UUID)
  type: NotificationType;            // 通知类型
  title: string;                     // 通知标题
  content: string;                   // 通知内容
  timestamp: string;                 // ISO 8601 时间戳
  read_status: boolean;              // 用户已确认
}

/**
 * Validate Notification data
 */
export function validateNotification(notification: Notification): string | null {
  if (!notification.id || notification.id.length === 0) {
    return 'Notification ID is required';
  }

  const validTypes: NotificationType[] = ['plugin_complete', 'system_alert', 'error'];
  if (!validTypes.includes(notification.type)) {
    return 'Notification type must be one of: plugin_complete, system_alert, error';
  }

  if (!notification.title || notification.title.length < 1 || notification.title.length > 100) {
    return 'Notification title must be 1-100 characters';
  }

  // Validate timestamp
  if (!notification.timestamp || isNaN(Date.parse(notification.timestamp))) {
    return 'Notification timestamp must be a valid ISO 8601 timestamp';
  }

  return null;
}
