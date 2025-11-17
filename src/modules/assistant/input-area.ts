/**
 * Input Area Component
 *
 * Auto-resizing textarea with file attachment support.
 *
 * Features:
 * - Auto-resize textarea based on content (1-10 lines)
 * - File drag & drop support
 * - File picker integration
 * - Attachment preview with remove capability
 * - Send button with keyboard shortcuts (Ctrl+Enter)
 * - Character/token counter
 * - Streaming interruption support
 *
 * CORE-011: Input area with textarea auto-resize and file attachment
 */

import { Attachment, detectFileType } from '../../core/models/attachment';
import { invoke } from '@tauri-apps/api/core';
import { getAttachmentPreview } from './attachment-preview';

interface InputAreaOptions {
  onSend: (content: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  placeholder?: string;
  maxLines?: number;
  maxAttachments?: number;
}

export class InputArea {
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private stopButton: HTMLButtonElement;
  private attachButton: HTMLButtonElement;
  private attachmentsContainer: HTMLElement;

  private attachments: Attachment[] = [];
  private isStreaming = false;

  // CORE-016: Attachment preview manager
  private attachmentPreview = getAttachmentPreview();

  // Configuration
  private readonly options: Required<InputAreaOptions>;
  private readonly MIN_HEIGHT = 44; // Single line height
  private readonly MAX_LINES = 10;
  private readonly LINE_HEIGHT = 24;

  constructor(containerId: string, options: InputAreaOptions) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }

    this.container = container;
    this.options = {
      placeholder: options.placeholder || 'Type your message...',
      maxLines: options.maxLines || this.MAX_LINES,
      maxAttachments: options.maxAttachments || 10,
      onSend: options.onSend,
      onStop: options.onStop || (() => {})
    };

    this.textarea = this.createTextarea();
    this.sendButton = this.createSendButton();
    this.stopButton = this.createStopButton();
    this.attachButton = this.createAttachButton();
    this.attachmentsContainer = this.createAttachmentsContainer();

    this.buildLayout();
    this.attachEventListeners();
  }

  /**
   * Create textarea element
   */
  private createTextarea(): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.className = 'input-area-textarea';
    textarea.placeholder = this.options.placeholder;
    textarea.rows = 1;
    textarea.style.cssText = `
      flex: 1;
      min-height: ${this.MIN_HEIGHT}px;
      max-height: ${this.MIN_HEIGHT + (this.options.maxLines - 1) * this.LINE_HEIGHT}px;
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: var(--font-size-base);
      line-height: ${this.LINE_HEIGHT}px;
      resize: none;
      overflow-y: auto;
      transition: border-color var(--transition-fast);
    `;
    return textarea;
  }

  /**
   * Create send button
   */
  private createSendButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'input-area-send-btn';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;
    button.title = 'Send (Ctrl+Enter)';
    button.style.cssText = `
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: var(--radius-sm);
      background-color: var(--active-bg);
      color: var(--active-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    `;
    return button;
  }

  /**
   * Create stop button
   */
  private createStopButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'input-area-stop-btn';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
    `;
    button.title = 'Stop generating';
    button.style.cssText = `
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: var(--radius-sm);
      background-color: #E74C3C;
      color: white;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    `;
    return button;
  }

  /**
   * Create attachment button
   */
  private createAttachButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'input-area-attach-btn';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
      </svg>
    `;
    button.title = 'Attach file';
    button.style.cssText = `
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: var(--radius-sm);
      background-color: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    `;
    return button;
  }

  /**
   * Create attachments container
   */
  private createAttachmentsContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'input-area-attachments';
    container.style.cssText = `
      display: none;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) 0;
      margin-bottom: var(--spacing-sm);
    `;
    return container;
  }

  /**
   * Build complete layout
   */
  private buildLayout(): void {
    this.container.innerHTML = '';
    this.container.className = 'input-area-container';
    this.container.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: var(--spacing-md);
      background-color: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    `;

    // Attachments preview
    this.container.appendChild(this.attachmentsContainer);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.className = 'input-area-row';
    inputRow.style.cssText = `
      display: flex;
      gap: var(--spacing-sm);
      align-items: flex-end;
    `;

    inputRow.appendChild(this.attachButton);
    inputRow.appendChild(this.textarea);
    inputRow.appendChild(this.sendButton);
    inputRow.appendChild(this.stopButton);

    this.container.appendChild(inputRow);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Auto-resize textarea
    this.textarea.addEventListener('input', () => {
      this.autoResize();
    });

    // Send on Ctrl+Enter
    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send button click
    this.sendButton.addEventListener('click', () => {
      this.handleSend();
    });

    // Stop button click
    this.stopButton.addEventListener('click', () => {
      this.handleStop();
    });

    // Attach button click
    this.attachButton.addEventListener('click', async () => {
      await this.openFilePicker();
    });

    // Drag & drop support
    this.textarea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.textarea.style.borderColor = 'var(--active-bg)';
    });

    this.textarea.addEventListener('dragleave', () => {
      this.textarea.style.borderColor = 'var(--border-color)';
    });

    this.textarea.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.textarea.style.borderColor = 'var(--border-color)';

      if (e.dataTransfer?.files) {
        await this.handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Focus textarea on attach button hover
    this.attachButton.addEventListener('mouseenter', () => {
      this.attachButton.style.backgroundColor = 'var(--bg-tertiary)';
      this.attachButton.style.color = 'var(--text-primary)';
    });

    this.attachButton.addEventListener('mouseleave', () => {
      this.attachButton.style.backgroundColor = 'transparent';
      this.attachButton.style.color = 'var(--text-secondary)';
    });

    // Send button hover
    this.sendButton.addEventListener('mouseenter', () => {
      this.sendButton.style.transform = 'scale(1.05)';
    });

    this.sendButton.addEventListener('mouseleave', () => {
      this.sendButton.style.transform = 'scale(1)';
    });

    // Stop button hover
    this.stopButton.addEventListener('mouseenter', () => {
      this.stopButton.style.backgroundColor = '#C0392B';
    });

    this.stopButton.addEventListener('mouseleave', () => {
      this.stopButton.style.backgroundColor = '#E74C3C';
    });
  }

  /**
   * Auto-resize textarea based on content
   */
  private autoResize(): void {
    // Reset height to calculate scroll height
    this.textarea.style.height = `${this.MIN_HEIGHT}px`;

    const scrollHeight = this.textarea.scrollHeight;
    const maxHeight = this.MIN_HEIGHT + (this.options.maxLines - 1) * this.LINE_HEIGHT;
    const newHeight = Math.min(scrollHeight, maxHeight);

    this.textarea.style.height = `${newHeight}px`;
  }

  /**
   * Open file picker dialog
   */
  private async openFilePicker(): Promise<void> {
    try {
      const selected = await invoke<string[]>('open_file_dialog', {
        multiple: true,
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
          { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'doc', 'docx'] }
        ]
      });

      if (selected && selected.length > 0) {
        // Convert file paths to File objects
        const files: File[] = [];
        for (const path of selected) {
          const fileData = await invoke<{ name: string; data: number[] }>('read_file_as_bytes', { path });
          const blob = new Blob([new Uint8Array(fileData.data)]);
          const file = new File([blob], fileData.name);
          files.push(file);
        }

        await this.handleFiles(files);
      }
    } catch (error) {
      console.error('Failed to open file picker:', error);
    }
  }

  /**
   * Handle file attachments
   */
  private async handleFiles(files: File[]): Promise<void> {
    if (this.attachments.length >= this.options.maxAttachments) {
      alert(`Maximum ${this.options.maxAttachments} attachments allowed`);
      return;
    }

    const remainingSlots = this.options.maxAttachments - this.attachments.length;
    const filesToAdd = files.slice(0, remainingSlots);

    for (const file of filesToAdd) {
      const attachment = await this.createAttachment(file);
      this.attachments.push(attachment);
    }

    this.renderAttachments();
  }

  /**
   * Create attachment from file (CORE-016: Updated to use correct Attachment model + thumbnail generation)
   */
  private async createAttachment(file: File): Promise<Attachment> {
    return new Promise(async (resolve) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;

        const attachment: Attachment = {
          id: `attach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          file_type: detectFileType(file.name),
          file_size: file.size,
          file_path_or_base64: dataUrl  // Full data URL with MIME type
        };

        // CORE-016: Generate thumbnail for images
        if (attachment.file_type === 'image') {
          const thumbnail = await this.attachmentPreview.generateThumbnail(attachment, {
            maxWidth: 120,
            maxHeight: 80,
            quality: 0.8
          });
          if (thumbnail) {
            attachment.thumbnail = thumbnail;
          }
        }

        resolve(attachment);
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Render attachment previews
   */
  private renderAttachments(): void {
    this.attachmentsContainer.innerHTML = '';

    if (this.attachments.length === 0) {
      this.attachmentsContainer.style.display = 'none';
      return;
    }

    this.attachmentsContainer.style.display = 'flex';

    for (const attachment of this.attachments) {
      const preview = this.createAttachmentPreview(attachment);
      this.attachmentsContainer.appendChild(preview);
    }
  }

  /**
   * Create attachment preview element (CORE-016: Using AttachmentPreview module)
   */
  private createAttachmentPreview(attachment: Attachment): HTMLElement {
    return this.attachmentPreview.createPreviewElement(attachment, (id) => {
      this.removeAttachment(id);
    });
  }

  /**
   * Remove attachment
   */
  private removeAttachment(attachmentId: string): void {
    this.attachments = this.attachments.filter(a => a.id !== attachmentId);
    this.renderAttachments();
  }

  /**
   * Handle send action
   */
  private handleSend(): void {
    const content = this.textarea.value.trim();

    if (!content && this.attachments.length === 0) {
      return;
    }

    // Call send callback
    this.options.onSend(content, this.attachments);

    // Clear input and attachments
    this.textarea.value = '';
    this.attachments = [];
    this.autoResize();
    this.renderAttachments();
  }

  /**
   * Handle stop action (CORE-015)
   */
  private handleStop(): void {
    if (this.options.onStop) {
      this.options.onStop();
    }
    this.setStreaming(false);
  }

  /**
   * Set streaming state
   */
  public setStreaming(streaming: boolean): void {
    this.isStreaming = streaming;

    if (streaming) {
      this.sendButton.style.display = 'none';
      this.stopButton.style.display = 'flex';
      this.textarea.disabled = true;
      this.attachButton.disabled = true;
    } else {
      this.sendButton.style.display = 'flex';
      this.stopButton.style.display = 'none';
      this.textarea.disabled = false;
      this.attachButton.disabled = false;
    }
  }

  /**
   * Focus textarea
   */
  public focus(): void {
    this.textarea.focus();
  }

  /**
   * Clear input
   */
  public clear(): void {
    this.textarea.value = '';
    this.attachments = [];
    this.autoResize();
    this.renderAttachments();
  }

  /**
   * Destroy component
   */
  public destroy(): void {
    this.container.innerHTML = '';
  }
}

/**
 * Factory function to create InputArea instance
 */
export function createInputArea(containerId: string, options: InputAreaOptions): InputArea {
  return new InputArea(containerId, options);
}
