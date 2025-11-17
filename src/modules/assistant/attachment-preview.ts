/**
 * Attachment Preview Component (CORE-016)
 *
 * Generates visual previews/thumbnails for file attachments.
 *
 * Features:
 * - Image thumbnail generation with Canvas API
 * - PDF first-page preview
 * - Document icons with filename truncation
 * - Video/Audio preview placeholders
 * - Lazy loading for performance
 * - Remove button on hover
 *
 * Supported File Types:
 * - Images (jpg, png, gif, webp) - Canvas-based thumbnail
 * - PDFs - First page preview (when available)
 * - Documents (txt, md, doc, docx) - Icon + filename
 * - Audio (mp3, wav, flac) - Waveform icon
 * - Video (mp4, webm, avi) - Play icon
 */

import { Attachment } from '../../core/models/attachment';

interface ThumbnailOptions {
  maxWidth?: number;      // Maximum thumbnail width (default: 120px)
  maxHeight?: number;     // Maximum thumbnail height (default: 80px)
  quality?: number;       // JPEG quality 0-1 (default: 0.8)
  format?: 'image/jpeg' | 'image/png';  // Output format (default: jpeg)
}

/**
 * AttachmentPreview Manager
 * Singleton class for generating attachment previews
 */
export class AttachmentPreview {
  private static instance: AttachmentPreview;

  // Default thumbnail dimensions
  private readonly DEFAULT_MAX_WIDTH = 120;
  private readonly DEFAULT_MAX_HEIGHT = 80;
  private readonly DEFAULT_QUALITY = 0.8;

  // Thumbnail cache to avoid regenerating
  private thumbnailCache: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): AttachmentPreview {
    if (!AttachmentPreview.instance) {
      AttachmentPreview.instance = new AttachmentPreview();
    }
    return AttachmentPreview.instance;
  }

  /**
   * Generate thumbnail for attachment
   * Returns data URL or undefined if generation fails
   */
  public async generateThumbnail(
    attachment: Attachment,
    options: ThumbnailOptions = {}
  ): Promise<string | undefined> {
    // Check cache first
    const cacheKey = `${attachment.id}_${options.maxWidth || this.DEFAULT_MAX_WIDTH}`;
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey);
    }

    let thumbnail: string | undefined;

    // Generate thumbnail based on file type
    switch (attachment.file_type) {
      case 'image':
        thumbnail = await this.generateImageThumbnail(attachment, options);
        break;
      case 'pdf':
        thumbnail = await this.generatePDFThumbnail(attachment, options);
        break;
      case 'video':
      case 'audio':
      case 'document':
      case 'other':
      default:
        // No thumbnail for these types
        thumbnail = undefined;
        break;
    }

    // Cache successful thumbnail
    if (thumbnail) {
      this.thumbnailCache.set(cacheKey, thumbnail);

      // Update attachment model with thumbnail
      attachment.thumbnail = thumbnail;
    }

    return thumbnail;
  }

  /**
   * Generate thumbnail for image using Canvas API
   */
  private async generateImageThumbnail(
    attachment: Attachment,
    options: ThumbnailOptions
  ): Promise<string | undefined> {
    const maxWidth = options.maxWidth || this.DEFAULT_MAX_WIDTH;
    const maxHeight = options.maxHeight || this.DEFAULT_MAX_HEIGHT;
    const quality = options.quality || this.DEFAULT_QUALITY;
    const format = options.format || 'image/jpeg';

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate thumbnail dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;

          // Scale down if larger than max dimensions
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;

            if (width > height) {
              // Landscape orientation
              width = maxWidth;
              height = maxWidth / aspectRatio;

              if (height > maxHeight) {
                height = maxHeight;
                width = maxHeight * aspectRatio;
              }
            } else {
              // Portrait orientation
              height = maxHeight;
              width = maxHeight * aspectRatio;

              if (width > maxWidth) {
                width = maxWidth;
                height = maxWidth / aspectRatio;
              }
            }
          }

          // Create canvas and draw scaled image
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(width);
          canvas.height = Math.floor(height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(undefined);
            return;
          }

          // Use higher quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to data URL
          const dataUrl = canvas.toDataURL(format, quality);
          resolve(dataUrl);
        } catch (error) {
          console.error('Failed to generate image thumbnail:', error);
          resolve(undefined);
        }
      };

      img.onerror = () => {
        console.error('Failed to load image for thumbnail:', attachment.filename);
        resolve(undefined);
      };

      // Load image from data URL
      img.src = attachment.file_path_or_base64;
    });
  }

  /**
   * Generate thumbnail for PDF using PDF.js
   * Renders first page to canvas and converts to data URL
   */
  private async generatePDFThumbnail(
    attachment: Attachment,
    options: ThumbnailOptions
  ): Promise<string | undefined> {
    try {
      // Dynamically import PDF.js and configure worker
      const { pdfjsLib, configurePDFWorker } = await import('../../core/utils/pdfWorker');
      configurePDFWorker();

      const maxWidth = options.maxWidth || this.DEFAULT_MAX_WIDTH;
      const maxHeight = options.maxHeight || this.DEFAULT_MAX_HEIGHT;
      const quality = options.quality || this.DEFAULT_QUALITY;

      console.log('[AttachmentPreview] Generating PDF thumbnail:', attachment.filename);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(attachment.file_path_or_base64);
      const pdf = await loadingTask.promise;

      console.log('[AttachmentPreview] PDF loaded, pages:', pdf.numPages);

      // Get first page
      const page = await pdf.getPage(1);

      // Calculate scale to fit within max dimensions
      const viewport = page.getViewport({ scale: 1.0 });
      let scale = 1.0;

      if (viewport.width > maxWidth || viewport.height > maxHeight) {
        const scaleX = maxWidth / viewport.width;
        const scaleY = maxHeight / viewport.height;
        scale = Math.min(scaleX, scaleY);
      }

      const scaledViewport = page.getViewport({ scale });

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);

      const context = canvas.getContext('2d');
      if (!context) {
        console.error('[AttachmentPreview] Failed to get canvas context');
        await pdf.destroy();
        return undefined;
      }

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };

      await page.render(renderContext).promise;

      console.log('[AttachmentPreview] PDF page rendered to canvas');

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Cleanup
      await pdf.destroy();

      return dataUrl;

    } catch (error) {
      console.error('[AttachmentPreview] Failed to generate PDF thumbnail:', error);
      return undefined;
    }
  }

  /**
   * Create attachment preview element with thumbnail
   */
  public createPreviewElement(attachment: Attachment, onRemove?: (id: string) => void): HTMLElement {
    const container = document.createElement('div');
    container.className = 'attachment-preview';
    container.dataset.attachmentId = attachment.id;

    // Thumbnail or icon container
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'attachment-preview__thumbnail';

    if (attachment.thumbnail) {
      // Show actual thumbnail
      const thumbnail = document.createElement('img');
      thumbnail.src = attachment.thumbnail;
      thumbnail.className = 'attachment-preview__thumbnail-img';
      thumbnail.alt = attachment.filename;
      thumbnailContainer.appendChild(thumbnail);
    } else {
      // Show file type icon
      const icon = this.getFileTypeIcon(attachment.file_type);
      thumbnailContainer.innerHTML = icon;
    }

    container.appendChild(thumbnailContainer);

    // File info container
    const infoContainer = document.createElement('div');
    infoContainer.className = 'attachment-preview__info';

    // Filename
    const filename = document.createElement('div');
    filename.className = 'attachment-preview__filename';
    filename.textContent = this.truncateFilename(attachment.filename, 20);
    filename.title = attachment.filename;  // Full name on hover
    infoContainer.appendChild(filename);

    // File size
    const filesize = document.createElement('div');
    filesize.className = 'attachment-preview__filesize';
    filesize.textContent = this.formatFileSize(attachment.file_size);
    infoContainer.appendChild(filesize);

    container.appendChild(infoContainer);

    // Remove button
    if (onRemove) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'attachment-preview__remove';
      removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>`;
      removeBtn.title = 'Remove attachment';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(attachment.id);
      });
      container.appendChild(removeBtn);
    }

    return container;
  }

  /**
   * Get SVG icon for file type
   */
  private getFileTypeIcon(fileType: string): string {
    const iconStyles = 'width: 48px; height: 48px;';

    switch (fileType) {
      case 'image':
        return `<svg style="${iconStyles}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>`;

      case 'pdf':
        return `<svg style="${iconStyles}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="9" y1="15" x2="15" y2="15"></line>
          <line x1="9" y1="12" x2="15" y2="12"></line>
        </svg>`;

      case 'video':
        return `<svg style="${iconStyles}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>`;

      case 'audio':
        return `<svg style="${iconStyles}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>`;

      case 'document':
      case 'other':
      default:
        return `<svg style="${iconStyles}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>`;
    }
  }

  /**
   * Truncate filename to specified length
   */
  private truncateFilename(filename: string, maxLength: number): string {
    if (filename.length <= maxLength) {
      return filename;
    }

    const ext = filename.split('.').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.length - ext.length - 1);

    // Keep extension, truncate name
    const truncatedName = nameWithoutExt.substring(0, maxLength - ext.length - 4);
    return `${truncatedName}...${ext}`;
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const size = bytes / Math.pow(k, i);
    const formatted = size.toFixed(i === 0 ? 0 : 1);

    return `${formatted} ${units[i]}`;
  }

  /**
   * Clear thumbnail cache
   */
  public clearCache(): void {
    this.thumbnailCache.clear();
  }

  /**
   * Clear specific thumbnail from cache
   */
  public clearThumbnail(attachmentId: string): void {
    for (const key of this.thumbnailCache.keys()) {
      if (key.startsWith(attachmentId)) {
        this.thumbnailCache.delete(key);
      }
    }
  }
}

/**
 * Factory function to get singleton instance
 */
export function getAttachmentPreview(): AttachmentPreview {
  return AttachmentPreview.getInstance();
}
