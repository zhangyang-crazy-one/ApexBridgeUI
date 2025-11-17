/**
 * ChatMessage Component - Renders chat messages with support for group chat
 * Displays agent name/avatar for group messages and single agent messages
 */

import type { Message } from '../core/models';

export interface ChatMessageOptions {
  message: Message;
  isGroupChat?: boolean;           // Whether this is a group conversation
  showAgentInfo?: boolean;          // Whether to show agent name/avatar
  agentAvatar?: string;             // Agent avatar URL (optional)
  currentUser?: string;             // Current user name for display
}

export class ChatMessage {
  private container: HTMLElement;
  private options: ChatMessageOptions;

  constructor(container: HTMLElement, options: ChatMessageOptions) {
    this.container = container;
    this.options = options;
    this.render();
  }

  render(): void {
    const { message, isGroupChat, showAgentInfo, agentAvatar } = this.options;
    const isUser = message.role === 'user' || message.sender === 'user';

    // In group chat, always show sender info
    // In single agent chat, only show if explicitly requested
    const shouldShowSender = isGroupChat || showAgentInfo;

    const senderName = message.sender_name || (isUser ? this.options.currentUser || 'User' : 'Agent');
    const time = this.formatTime(message.timestamp);
    const streamingClass = message.is_streaming ? 'streaming' : '';

    // Get avatar
    let avatar: string;
    if (isUser) {
      avatar = this.getUserInitial(senderName);
    } else {
      // For group chat, use sender-specific avatar if available
      if (agentAvatar) {
        avatar = `<img src="${agentAvatar}" alt="${this.escapeHtml(senderName)}" class="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                 <div class="avatar-fallback" style="display:none;">${this.getAgentInitial(senderName)}</div>`;
      } else {
        avatar = this.getAgentInitial(senderName);
      }
    }

    this.container.innerHTML = `
      <div class="message ${message.role || message.sender}" data-message-id="${message.id || ''}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content-wrapper">
          ${shouldShowSender ? `
            <div class="message-header">
              <span class="message-sender">${this.escapeHtml(senderName)}</span>
              ${message.sender_id && message.sender_id !== 'user' && isGroupChat ?
                `<span class="message-sender-id" title="Agent ID: ${message.sender_id}">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                  </svg>
                </span>` : ''}
              <span class="message-time">${time}</span>
            </div>
          ` : `
            <div class="message-header">
              <span class="message-time">${time}</span>
            </div>
          `}
          <div class="message-content ${streamingClass}">
            ${this.escapeHtml(message.content)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update message content (for streaming)
   */
  updateContent(content: string, isStreaming: boolean = false): void {
    const contentElement = this.container.querySelector('.message-content');
    if (contentElement) {
      contentElement.textContent = content;
      if (isStreaming) {
        contentElement.classList.add('streaming');
      } else {
        contentElement.classList.remove('streaming');
      }
    }
  }

  /**
   * Mark message as complete
   */
  markComplete(): void {
    const contentElement = this.container.querySelector('.message-content');
    if (contentElement) {
      contentElement.classList.remove('streaming');
    }
  }

  private formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return '';
    }
  }

  private getUserInitial(userName: string): string {
    const initial = userName.charAt(0).toUpperCase();
    return `<div class="avatar-initial user-avatar">${initial}</div>`;
  }

  private getAgentInitial(agentName: string): string {
    const initial = agentName.charAt(0).toUpperCase();
    return `<div class="avatar-initial agent-avatar">${initial}</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}

/**
 * Render a message to HTML string (for inline rendering)
 */
export function renderMessageHTML(options: ChatMessageOptions): string {
  const { message, isGroupChat, showAgentInfo, agentAvatar, currentUser } = options;
  const isUser = message.role === 'user' || message.sender === 'user';

  const shouldShowSender = isGroupChat || showAgentInfo;
  const senderName = message.sender_name || (isUser ? currentUser || 'User' : 'Agent');
  const time = formatTimeString(message.timestamp);
  const streamingClass = message.is_streaming ? 'streaming' : '';

  // Get avatar HTML
  let avatar: string;
  if (isUser) {
    const initial = senderName.charAt(0).toUpperCase();
    avatar = `<div class="avatar-initial user-avatar">${initial}</div>`;
  } else {
    if (agentAvatar) {
      avatar = `<img src="${agentAvatar}" alt="${escapeHtmlString(senderName)}" class="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
               <div class="avatar-fallback" style="display:none;">${senderName.charAt(0).toUpperCase()}</div>`;
    } else {
      const initial = senderName.charAt(0).toUpperCase();
      avatar = `<div class="avatar-initial agent-avatar">${initial}</div>`;
    }
  }

  return `
    <div class="message ${message.role || message.sender}" data-message-id="${message.id || ''}">
      <div class="message-avatar">${avatar}</div>
      <div class="message-content-wrapper">
        ${shouldShowSender ? `
          <div class="message-header">
            <span class="message-sender">${escapeHtmlString(senderName)}</span>
            ${message.sender_id && message.sender_id !== 'user' && isGroupChat ?
              `<span class="message-sender-id" title="Agent ID: ${message.sender_id}">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                </svg>
              </span>` : ''}
            <span class="message-time">${time}</span>
          </div>
        ` : `
          <div class="message-header">
            <span class="message-time">${time}</span>
          </div>
        `}
        <div class="message-content ${streamingClass}">
          ${escapeHtmlString(message.content)}
        </div>
      </div>
    </div>
  `;
}

// Helper functions for standalone usage
function formatTimeString(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    return '';
  }
}

function escapeHtmlString(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
