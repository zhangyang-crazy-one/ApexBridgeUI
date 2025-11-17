/**
 * Internationalization (i18n) Translation System
 * Supports Chinese (zh-CN) and English (en-US)
 */

export type Language = 'zh-CN' | 'en-US';

export interface Translations {
  // Welcome screen
  welcome_title: string;
  welcome_subtitle: string;
  multi_agent_support: string;
  multi_agent_desc: string;
  group_collaboration: string;
  group_collaboration_desc: string;
  rich_content: string;
  rich_content_desc: string;
  get_started: string;

  // Navigation
  conversations: string;
  notifications: string;

  // Agent selection
  select_agent: string;
  no_agents_available: string;

  // Topic list
  no_conversations: string;
  new_conversation: string;
  delete_topic: string;
  delete_topic_confirm: string;
  rename_topic: string;

  // Chat interface
  type_message: string;
  send: string;
  sending: string;
  stop_generating: string;
  char_count: string;

  // Message status
  message_pending: string;
  message_streaming: string;
  message_complete: string;
  message_error: string;

  // Settings
  settings: string;
  user_settings: string;
  backend_settings: string;
  window_settings: string;
  keyboard_shortcuts: string;
  language_setting: string;
  theme_setting: string;
  save: string;
  cancel: string;

  // Common actions
  create: string;
  edit: string;
  delete: string;
  copy: string;
  paste: string;
  cut: string;
  undo: string;
  redo: string;
  search: string;

  // Notifications
  notification_new: string;
  notification_system: string;
  notification_plugin: string;
  notification_error: string;
  mark_as_read: string;
  clear_all: string;
  no_notifications: string;

  // File operations
  attach_file: string;

  // Error messages
  error_load_settings: string;
  error_load_agents: string;
  error_load_topics: string;
  error_save_conversation: string;
  error_send_message: string;
  error_network: string;

  // Time formats
  time_now: string;
  time_minutes_ago: string;
  time_hours_ago: string;
  time_days_ago: string;
  time_weeks_ago: string;
}

export const translations: Record<Language, Translations> = {
  'zh-CN': {
    // Welcome screen
    welcome_title: '欢迎使用VCPChat',
    welcome_subtitle: '选择智能体开始对话',
    multi_agent_support: '多智能体支持',
    multi_agent_desc: '与不同AI角色对话',
    group_collaboration: '群组协作',
    group_collaboration_desc: '多个智能体协同工作',
    rich_content: '富媒体内容',
    rich_content_desc: 'Markdown、代码、图片等',
    get_started: '开始使用',

    // Navigation
    conversations: '对话',
    notifications: '通知',

    // Agent selection
    select_agent: '选择智能体...',
    no_agents_available: '暂无可用智能体',

    // Topic list
    no_conversations: '暂无对话',
    new_conversation: '新建对话',
    delete_topic: '删除对话',
    delete_topic_confirm: '确定要删除此对话吗？',
    rename_topic: '重命名对话',

    // Chat interface
    type_message: '输入消息...',
    send: '发送',
    sending: '发送中...',
    stop_generating: '停止生成',
    char_count: '字符数',

    // Message status
    message_pending: '等待中',
    message_streaming: '生成中',
    message_complete: '完成',
    message_error: '错误',

    // Settings
    settings: '设置',
    user_settings: '用户设置',
    backend_settings: '后端设置',
    window_settings: '窗口设置',
    keyboard_shortcuts: '快捷键',
    language_setting: '界面语言',
    theme_setting: '主题',
    save: '保存',
    cancel: '取消',

    // Common actions
    create: '创建',
    edit: '编辑',
    delete: '删除',
    copy: '复制',
    paste: '粘贴',
    cut: '剪切',
    undo: '撤销',
    redo: '重做',
    search: '搜索',

    // Notifications
    notification_new: '新通知',
    notification_system: '系统通知',
    notification_plugin: '插件通知',
    notification_error: '错误通知',
    mark_as_read: '标记为已读',
    clear_all: '清空全部',
    no_notifications: '暂无通知',

    // File operations
    attach_file: '附加文件',

    // Error messages
    error_load_settings: '加载设置失败',
    error_load_agents: '加载智能体列表失败',
    error_load_topics: '加载对话列表失败',
    error_save_conversation: '保存对话失败',
    error_send_message: '发送消息失败',
    error_network: '网络连接失败',

    // Time formats
    time_now: '刚刚',
    time_minutes_ago: '分钟前',
    time_hours_ago: '小时前',
    time_days_ago: '天前',
    time_weeks_ago: '周前',
  },

  'en-US': {
    // Welcome screen
    welcome_title: 'Welcome to VCPChat',
    welcome_subtitle: 'Select an agent and start a conversation',
    multi_agent_support: 'Multi-Agent Support',
    multi_agent_desc: 'Chat with different AI personalities',
    group_collaboration: 'Group Collaboration',
    group_collaboration_desc: 'Multiple agents working together',
    rich_content: 'Rich Media Content',
    rich_content_desc: 'Markdown, code, images, and more',
    get_started: 'Get Started',

    // Navigation
    conversations: 'Conversations',
    notifications: 'Notifications',

    // Agent selection
    select_agent: 'Select an agent...',
    no_agents_available: 'No agents available',

    // Topic list
    no_conversations: 'No conversations yet',
    new_conversation: 'New Conversation',
    delete_topic: 'Delete Conversation',
    delete_topic_confirm: 'Are you sure you want to delete this conversation?',
    rename_topic: 'Rename Conversation',

    // Chat interface
    type_message: 'Type a message...',
    send: 'Send',
    sending: 'Sending...',
    stop_generating: 'Stop Generating',
    char_count: 'Characters',

    // Message status
    message_pending: 'Pending',
    message_streaming: 'Generating',
    message_complete: 'Complete',
    message_error: 'Error',

    // Settings
    settings: 'Settings',
    user_settings: 'User Settings',
    backend_settings: 'Backend Settings',
    window_settings: 'Window Settings',
    keyboard_shortcuts: 'Keyboard Shortcuts',
    language_setting: 'Language',
    theme_setting: 'Theme',
    save: 'Save',
    cancel: 'Cancel',

    // Common actions
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    copy: 'Copy',
    paste: 'Paste',
    cut: 'Cut',
    undo: 'Undo',
    redo: 'Redo',
    search: 'Search',

    // Notifications
    notification_new: 'New Notification',
    notification_system: 'System Notification',
    notification_plugin: 'Plugin Notification',
    notification_error: 'Error Notification',
    mark_as_read: 'Mark as Read',
    clear_all: 'Clear All',
    no_notifications: 'No notifications',

    // File operations
    attach_file: 'Attach File',

    // Error messages
    error_load_settings: 'Failed to load settings',
    error_load_agents: 'Failed to load agents',
    error_load_topics: 'Failed to load topics',
    error_save_conversation: 'Failed to save conversation',
    error_send_message: 'Failed to send message',
    error_network: 'Network connection failed',

    // Time formats
    time_now: 'Just now',
    time_minutes_ago: 'minutes ago',
    time_hours_ago: 'hours ago',
    time_days_ago: 'days ago',
    time_weeks_ago: 'weeks ago',
  },
};

/**
 * Get translations for a specific language
 */
export function getTranslations(language: Language): Translations {
  return translations[language] || translations['zh-CN'];
}

/**
 * Translate a key to the current language
 */
export function t(language: Language, key: keyof Translations): string {
  const trans = getTranslations(language);
  return trans[key] || key;
}
