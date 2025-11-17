/**
 * DOM Builder Module (CORE-018B)
 *
 * Responsibilities:
 * - Construct message DOM skeleton structure
 * - Apply role-based styling (user vs agent)
 * - Create reusable message components (header, content, footer)
 * - Provide utility functions for DOM element creation
 * - Support theme-aware styling with CSS variables
 *
 * Architecture:
 * Message Structure:
 * ┌─────────────────────────────────────┐
 * │ Message Container (.message)        │
 * │ ├── Message Header                  │
 * │ │   ├── Avatar                      │
 * │ │   ├── Sender Name                 │
 * │ │   └── Metadata (role, model)     │
 * │ ├── Message Content                 │
 * │ │   ├── Content Zone (renderer)    │
 * │ │   └── Attachments Zone           │
 * │ └── Message Footer                  │
 * │     ├── Timestamp                   │
 * │     └── Actions (copy, regenerate) │
 * └─────────────────────────────────────┘
 */

import type { Message } from '../models/message';
import { convertAvatarPath, getDefaultUserAvatar, getDefaultAgentAvatar } from '../utils/pathUtils';

/**
 * DOM Builder Options
 */
export interface DOMBuilderOptions {
  /**
   * Enable avatar display
   * Default: true
   */
  showAvatar?: boolean;

  /**
   * Avatar path for the message sender
   * - For user messages: should be GlobalSettings.user_avatar
   * - For agent messages: should be Agent.avatar
   * - If not provided, avatar will not be rendered
   */
  avatarPath?: string;

  /**
   * Enable message metadata (model, tokens)
   * Default: true
   */
  showMetadata?: boolean;

  /**
   * Enable message footer with actions
   * Default: true
   */
  showFooter?: boolean;

  /**
   * Enable theme color from avatar
   * Default: true
   */
  useThemeColor?: boolean;

  /**
   * Custom CSS classes to add to message container
   */
  customClasses?: string[];
}

/**
 * Message Component References
 * Returned by buildMessageDOM for efficient updates
 */
export interface MessageDOMRefs {
  /**
   * Root message container element
   */
  container: HTMLElement;

  /**
   * Message header section
   */
  header: HTMLElement;

  /**
   * Avatar element (if enabled)
   */
  avatar?: HTMLElement;

  /**
   * Sender name element
   */
  senderName: HTMLElement;

  /**
   * Metadata element (model, tokens)
   */
  metadata?: HTMLElement;

  /**
   * Content zone for rendered message
   */
  contentZone: HTMLElement;

  /**
   * Attachments zone for file previews
   */
  attachmentsZone?: HTMLElement;

  /**
   * Message footer section
   */
  footer?: HTMLElement;

  /**
   * Timestamp element
   */
  timestamp?: HTMLElement;

  /**
   * Actions container (copy, regenerate buttons)
   */
  actions?: HTMLElement;
}

/**
 * DOM Builder
 * Singleton class for creating message DOM structures
 */
export class DOMBuilder {
  private static instance: DOMBuilder;

  private constructor() {}

  public static getInstance(): DOMBuilder {
    if (!DOMBuilder.instance) {
      DOMBuilder.instance = new DOMBuilder();
    }
    return DOMBuilder.instance;
  }

  /**
   * Build complete message DOM structure
   *
   * @param message - Message data model
   * @param options - Builder options
   * @returns MessageDOMRefs - References to all created elements
   */
  public async buildMessageDOM(
    message: Message,
    options: DOMBuilderOptions = {}
  ): Promise<MessageDOMRefs> {
    const {
      showAvatar = true,
      avatarPath,
      showMetadata = true,
      showFooter = true,
      useThemeColor = true,
      customClasses = []
    } = options;

    // Create container
    const container = this.createMessageContainer(message, customClasses);

    // Create header
    const { header, avatar, senderName, metadata } = this.createMessageHeader(
      message,
      { showAvatar, showMetadata, avatarPath }
    );
    container.appendChild(header);

    // Create content zone
    const contentZone = this.createContentZone(message);
    container.appendChild(contentZone);

    // Create attachments zone if message has attachments (now async)
    let attachmentsZone: HTMLElement | undefined;
    if (message.attachments && message.attachments.length > 0) {
      attachmentsZone = await this.createAttachmentsZone(message);
      container.appendChild(attachmentsZone);
    }

    // Create footer
    let footer: HTMLElement | undefined;
    let timestamp: HTMLElement | undefined;
    let actions: HTMLElement | undefined;

    if (showFooter) {
      const footerRefs = this.createMessageFooter(message);
      footer = footerRefs.footer;
      timestamp = footerRefs.timestamp;
      actions = footerRefs.actions;
      container.appendChild(footer);
    }

    return {
      container,
      header,
      avatar,
      senderName,
      metadata,
      contentZone,
      attachmentsZone,
      footer,
      timestamp,
      actions
    };
  }

  /**
   * Create message container with role-based styling
   */
  private createMessageContainer(
    message: Message,
    customClasses: string[]
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'message-container';
    container.dataset.messageId = message.id;
    container.dataset.role = message.sender;

    // Add role-specific class (message-user, message-agent)
    container.classList.add(`message-${message.sender}`);

    // Add streaming class if message is streaming
    if (message.is_streaming) {
      container.classList.add('message-streaming');
    }

    // Add state class if message has state
    if (message.state) {
      container.classList.add(`message-${message.state}`);
    }

    // Add custom classes
    customClasses.forEach(cls => container.classList.add(cls));

    return container;
  }

  /**
   * Create message header with avatar and metadata
   */
  private createMessageHeader(
    message: Message,
    options: {
      showAvatar: boolean;
      showMetadata: boolean;
      avatarPath?: string;
    }
  ): {
    header: HTMLElement;
    avatar?: HTMLElement;
    senderName: HTMLElement;
    metadata?: HTMLElement;
  } {
    const header = document.createElement('div');
    header.className = 'message__header';

    // Create avatar with image element
    let avatar: HTMLElement | undefined;
    if (options.showAvatar && options.avatarPath) {
      avatar = document.createElement('div');
      avatar.className = 'message__avatar';
      avatar.dataset.senderId = message.sender_id;

      // Create avatar image
      const avatarImg = document.createElement('img');
      avatarImg.className = 'message__avatar-img';
      avatarImg.alt = message.sender_name || message.sender;

      // Convert and set avatar path
      const convertedPath = convertAvatarPath(options.avatarPath);
      avatarImg.src = convertedPath;

      // Error handling with fallback
      avatarImg.onerror = () => {
        console.warn(`[DOMBuilder] Failed to load avatar: ${options.avatarPath}`);
        const fallbackPath = message.sender === 'user'
          ? convertAvatarPath(getDefaultUserAvatar())
          : convertAvatarPath(getDefaultAgentAvatar());
        avatarImg.src = fallbackPath;
      };

      avatar.appendChild(avatarImg);
      header.appendChild(avatar);
    }

    // Sender info container
    const senderInfo = document.createElement('div');
    senderInfo.className = 'message__sender-info';

    // Sender name
    const senderName = document.createElement('span');
    senderName.className = 'message__sender-name';
    senderName.textContent = message.sender_name || 'Unknown';
    senderInfo.appendChild(senderName);

    // Metadata (model, tokens, latency)
    let metadata: HTMLElement | undefined;
    if (options.showMetadata && message.metadata) {
      metadata = document.createElement('div');
      metadata.className = 'message__metadata';

      const metadataItems: string[] = [];

      if (message.metadata.model_used) {
        metadataItems.push(message.metadata.model_used);
      }

      if (message.metadata.tokens !== undefined) {
        metadataItems.push(`${message.metadata.tokens} tokens`);
      }

      if (message.metadata.latency_ms !== undefined) {
        metadataItems.push(`${message.metadata.latency_ms}ms`);
      }

      metadata.textContent = metadataItems.join(' · ');
      senderInfo.appendChild(metadata);
    }

    header.appendChild(senderInfo);

    return { header, avatar, senderName, metadata };
  }

  /**
   * Create content zone for rendered message
   * This is where renderers will inject HTML
   */
  private createContentZone(message: Message): HTMLElement {
    const contentZone = document.createElement('div');
    contentZone.className = 'message__content';
    contentZone.dataset.messageId = message.id;

    // Add placeholder for empty messages
    if (!message.content || message.content.trim() === '') {
      contentZone.classList.add('message__content--empty');

      if (message.is_streaming) {
        // Show typing indicator for streaming messages
        const indicator = this.createTypingIndicator();
        contentZone.appendChild(indicator);
      } else {
        // Show empty state
        const emptyState = document.createElement('span');
        emptyState.className = 'message__empty-state';
        emptyState.textContent = 'No content';
        contentZone.appendChild(emptyState);
      }
    }

    return contentZone;
  }

  /**
   * Create attachments zone for file previews
   */
  private async createAttachmentsZone(message: Message): Promise<HTMLElement> {
    const attachmentsZone = document.createElement('div');
    attachmentsZone.className = 'message__attachments';
    attachmentsZone.dataset.messageId = message.id;

    // Render each attachment (now async)
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        const attachmentEl = await this.renderAttachment(attachment);
        attachmentsZone.appendChild(attachmentEl);
      }
    }

    return attachmentsZone;
  }

  /**
   * Render a single attachment based on its type
   */
  private async renderAttachment(attachment: any): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'attachment-item';
    container.dataset.attachmentId = attachment.id;
    container.dataset.fileType = attachment.file_type;

    // Render based on file type
    switch (attachment.file_type) {
      case 'image':
        container.appendChild(this.renderImageAttachment(attachment));
        break;
      case 'video':
        container.appendChild(this.renderVideoAttachment(attachment));
        break;
      case 'audio':
        // Audio rendering is now async
        const audioElement = await this.renderAudioAttachment(attachment);
        container.appendChild(audioElement);
        break;
      case 'pdf':
        container.appendChild(this.renderPDFAttachment(attachment));
        break;
      default:
        container.appendChild(this.renderDocumentAttachment(attachment));
        break;
    }

    return container;
  }

  /**
   * Render image attachment
   */
  private renderImageAttachment(attachment: any): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-image';

    const img = document.createElement('img');
    img.src = attachment.file_path_or_base64;
    img.alt = attachment.filename;
    img.className = 'attachment-image__img';
    img.loading = 'lazy';

    // Add click to view full size
    img.addEventListener('click', () => {
      this.openImageViewer(attachment.file_path_or_base64, attachment.filename);
    });

    wrapper.appendChild(img);

    // Add filename caption
    const caption = document.createElement('div');
    caption.className = 'attachment-caption';
    caption.textContent = attachment.filename;
    wrapper.appendChild(caption);

    return wrapper;
  }

  /**
   * Render video attachment
   */
  private renderVideoAttachment(attachment: any): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-video';

    const video = document.createElement('video');
    video.src = attachment.file_path_or_base64;
    video.controls = true;
    video.className = 'attachment-video__player';
    video.preload = 'metadata';

    wrapper.appendChild(video);

    // Add filename caption
    const caption = document.createElement('div');
    caption.className = 'attachment-caption';
    caption.textContent = attachment.filename;
    wrapper.appendChild(caption);

    return wrapper;
  }

  /**
   * Render audio attachment using AudioRenderer
   */
  private async renderAudioAttachment(attachment: any): Promise<HTMLElement> {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-audio';

    try {
      // Import AudioRenderer dynamically
      const { createAudioRenderer } = await import('./renderers/audioRenderer');

      // Create AudioRenderer instance with custom options for attachments
      const audioRenderer = createAudioRenderer({
        showMetadata: true,
        waveform: true,
        spectrumAnalyzer: false,  // Disable spectrum for attachments (performance)
        speedControl: true,
        className: 'attachment-audio-renderer'
      });

      // Render audio using AudioRenderer
      // AudioRenderer expects a URL or data URL
      const audioHTML = await audioRenderer.render(attachment.file_path_or_base64);

      // Convert HTML string to DOM element
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = audioHTML;
      const audioElement = tempDiv.firstElementChild as HTMLElement;

      if (audioElement) {
        wrapper.appendChild(audioElement);

        // Initialize audio controls (call finalize)
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          audioRenderer.finalize(wrapper);
        }, 0);
      } else {
        throw new Error('AudioRenderer returned empty element');
      }

    } catch (error) {
      // Fallback to native audio if rendering fails
      console.error('[DOMBuilder] AudioRenderer failed, using fallback:', error);
      const audio = document.createElement('audio');
      audio.src = attachment.file_path_or_base64;
      audio.controls = true;
      audio.className = 'attachment-audio__player';
      wrapper.appendChild(audio);
    }

    // Add filename caption
    const caption = document.createElement('div');
    caption.className = 'attachment-caption';
    caption.textContent = attachment.filename;
    wrapper.appendChild(caption);

    return wrapper;
  }

  /**
   * Render PDF attachment
   */
  private renderPDFAttachment(attachment: any): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-pdf';

    // Preview section (thumbnail or icon)
    const previewSection = document.createElement('div');
    previewSection.className = 'attachment-pdf__preview-section';

    if (attachment.thumbnail) {
      // Show thumbnail if available
      const thumbnail = document.createElement('img');
      thumbnail.src = attachment.thumbnail;
      thumbnail.alt = `${attachment.filename} - Page 1`;
      thumbnail.className = 'attachment-pdf__thumbnail';
      thumbnail.loading = 'lazy';

      // Add click to view full PDF (future enhancement)
      thumbnail.addEventListener('click', () => {
        console.log('[DOMBuilder] Open PDF viewer:', attachment.filename);
        // TODO: Open full PDF viewer modal
      });

      previewSection.appendChild(thumbnail);
    } else {
      // Fallback to icon if no thumbnail
      const icon = document.createElement('div');
      icon.className = 'attachment-pdf__icon';
      icon.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <text x="12" y="16" font-size="6" text-anchor="middle" fill="currentColor">PDF</text>
        </svg>
      `;
      previewSection.appendChild(icon);
    }

    wrapper.appendChild(previewSection);

    // Info section (filename and size)
    const info = document.createElement('div');
    info.className = 'attachment-pdf__info';
    info.innerHTML = `
      <div class="attachment-filename">${this.escapeHtml(attachment.filename)}</div>
      <div class="attachment-filesize">${this.formatFileSize(attachment.file_size)}</div>
    `;
    wrapper.appendChild(info);

    // Download button
    const downloadBtn = document.createElement('a');
    downloadBtn.href = attachment.file_path_or_base64;
    downloadBtn.download = attachment.filename;
    downloadBtn.className = 'attachment-download-btn';
    downloadBtn.textContent = 'Download';
    wrapper.appendChild(downloadBtn);

    return wrapper;
  }

  /**
   * Render document attachment (fallback)
   */
  private renderDocumentAttachment(attachment: any): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-document';

    // Document icon
    const icon = document.createElement('div');
    icon.className = 'attachment-document__icon';
    icon.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    `;
    wrapper.appendChild(icon);

    // Filename and size
    const info = document.createElement('div');
    info.className = 'attachment-document__info';
    info.innerHTML = `
      <div class="attachment-filename">${this.escapeHtml(attachment.filename)}</div>
      <div class="attachment-filesize">${this.formatFileSize(attachment.file_size)}</div>
    `;
    wrapper.appendChild(info);

    // Download button
    const downloadBtn = document.createElement('a');
    downloadBtn.href = attachment.file_path_or_base64;
    downloadBtn.download = attachment.filename;
    downloadBtn.className = 'attachment-download-btn';
    downloadBtn.textContent = 'Download';
    wrapper.appendChild(downloadBtn);

    return wrapper;
  }

  /**
   * Open image viewer modal
   */
  private openImageViewer(src: string, filename: string): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'image-viewer-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      cursor: zoom-out;
    `;

    // Create image
    const img = document.createElement('img');
    img.src = src;
    img.alt = filename;
    img.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    `;

    overlay.appendChild(img);

    // Close on click
    overlay.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    document.body.appendChild(overlay);
  }

  /**
   * Format file size to human-readable string
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Create message footer with timestamp and actions
   */
  private createMessageFooter(message: Message): {
    footer: HTMLElement;
    timestamp: HTMLElement;
    actions: HTMLElement;
  } {
    const footer = document.createElement('div');
    footer.className = 'message__footer';

    // Timestamp
    const timestamp = document.createElement('time');
    timestamp.className = 'message__timestamp';
    timestamp.dateTime = message.timestamp;
    timestamp.textContent = this.formatTimestamp(message.timestamp);
    footer.appendChild(timestamp);

    // Actions container
    const actions = document.createElement('div');
    actions.className = 'message__actions';

    // Copy button
    const copyBtn = this.createActionButton('copy', 'Copy message', () => {
      this.copyToClipboard(message.content);
    });
    actions.appendChild(copyBtn);

    // Regenerate button (only for agent messages)
    if (message.sender === 'agent') {
      const regenerateBtn = this.createActionButton(
        'regenerate',
        'Regenerate response',
        () => {
          window.dispatchEvent(
            new CustomEvent('message-regenerate', {
              detail: { messageId: message.id }
            })
          );
        }
      );
      actions.appendChild(regenerateBtn);
    }

    footer.appendChild(actions);

    return { footer, timestamp, actions };
  }

  /**
   * Create action button with icon
   */
  private createActionButton(
    action: 'copy' | 'regenerate',
    title: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `message__action message__action--${action}`;
    button.title = title;
    button.setAttribute('aria-label', title);

    // Add SVG icon
    const icon = this.getActionIcon(action);
    button.innerHTML = icon;

    button.addEventListener('click', onClick);

    return button;
  }

  /**
   * Get SVG icon for action
   */
  private getActionIcon(action: 'copy' | 'regenerate'): string {
    switch (action) {
      case 'copy':
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `;
      case 'regenerate':
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        `;
      default:
        return '';
    }
  }

  /**
   * Create typing indicator for streaming messages
   */
  private createTypingIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'message__typing-indicator';

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'message__typing-dot';
      indicator.appendChild(dot);
    }

    return indicator;
  }

  /**
   * Format timestamp to human-readable format
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // Less than 1 minute ago
    if (diffMins < 1) {
      return 'Just now';
    }

    // Less than 60 minutes ago
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }

    // Less than 24 hours ago
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    // Show full date
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Copy text to clipboard
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);

      // Show toast notification
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: 'Copied to clipboard',
            type: 'success',
            duration: 2000
          }
        })
      );
    } catch (error) {
      console.error('[DOMBuilder] Failed to copy to clipboard:', error);

      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: 'Failed to copy',
            type: 'error',
            duration: 2000
          }
        })
      );
    }
  }

  /**
   * Update message content zone (for streaming updates)
   */
  public updateContentZone(
    contentZone: HTMLElement,
    newContent: string | HTMLElement
  ): void {
    // Clear existing content
    contentZone.innerHTML = '';

    // Remove empty class
    contentZone.classList.remove('message__content--empty');

    // Insert new content
    if (typeof newContent === 'string') {
      contentZone.innerHTML = newContent;
    } else {
      contentZone.appendChild(newContent);
    }
  }

  /**
   * Update timestamp (for live updates)
   */
  public updateTimestamp(timestampElement: HTMLElement, timestamp: string): void {
    const timeEl = timestampElement as HTMLTimeElement;
    timeEl.dateTime = timestamp;
    timeEl.textContent = this.formatTimestamp(timestamp);
  }

  /**
   * Update metadata (for completed messages)
   */
  public updateMetadata(
    metadataElement: HTMLElement,
    metadata: {
      model_used?: string;
      tokens?: number;
      latency_ms?: number;
    }
  ): void {
    const items: string[] = [];

    if (metadata.model_used) {
      items.push(metadata.model_used);
    }

    if (metadata.tokens !== undefined) {
      items.push(`${metadata.tokens} tokens`);
    }

    if (metadata.latency_ms !== undefined) {
      items.push(`${metadata.latency_ms}ms`);
    }

    metadataElement.textContent = items.join(' · ');
  }

  /**
   * Add streaming class to container
   */
  public markAsStreaming(container: HTMLElement): void {
    container.classList.add('message-streaming');
  }

  /**
   * Remove streaming class and add complete class to container
   */
  public markAsComplete(container: HTMLElement): void {
    container.classList.remove('message-streaming');
    container.classList.add('message-complete');
  }

  /**
   * Add error class to container
   */
  public markAsError(container: HTMLElement): void {
    container.classList.add('message-error');
  }
}

/**
 * Factory function to get singleton instance
 */
export function getDOMBuilder(): DOMBuilder {
  return DOMBuilder.getInstance();
}

/**
 * Convenience function to build message DOM
 */
export async function buildMessageDOM(
  message: Message,
  options?: DOMBuilderOptions
): Promise<MessageDOMRefs> {
  const builder = getDOMBuilder();
  return builder.buildMessageDOM(message, options);
}
