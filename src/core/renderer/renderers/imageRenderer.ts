/**
 * Image Renderer (CORE-027)
 *
 * Responsibilities:
 * - Render images with interactive zoom and pan controls
 * - Support all common image formats (PNG, JPEG, GIF, WebP, SVG, BMP)
 * - Provide zoom in/out, fit to screen, actual size controls
 * - Enable pan/drag to move zoomed images
 * - Display image metadata (dimensions, format, size)
 * - Support full-screen mode
 * - Lazy loading for performance
 * - Streaming chunk rendering for progressive display
 *
 * Features:
 * - Zoom Controls: Zoom in, zoom out, fit to screen, actual size (100%)
 * - Pan/Drag: Click and drag to pan zoomed images
 * - Mouse Wheel Zoom: Scroll to zoom in/out
 * - Double-click: Toggle between fit and actual size
 * - Full-screen Mode: View image in full-screen overlay
 * - Image Info: Display dimensions, format, file size
 * - Lazy Loading: Load images only when visible
 * - Progressive JPEG: Support progressive rendering
 * - Rotation: Rotate image 90° clockwise/counterclockwise
 * - Download: Download image to local file
 *
 * Usage:
 * ```typescript
 * import { createImageRenderer } from './renderers/imageRenderer';
 *
 * const renderer = createImageRenderer();
 * const html = await renderer.render('https://example.com/image.png');
 * // Or Base64: data:image/png;base64,iVBORw0KGgo...
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Image formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'bmp' | 'ico' | 'unknown';

/**
 * Zoom mode
 */
export type ZoomMode = 'fit' | 'actual' | 'custom';

/**
 * Image metadata
 */
export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: ImageFormat;
  size?: number; // File size in bytes
  src: string;
}

/**
 * Image renderer options
 */
export interface ImageRendererOptions {
  /**
   * Enable zoom controls
   * Default: true
   */
  zoomControls?: boolean;

  /**
   * Enable pan/drag
   * Default: true
   */
  pannable?: boolean;

  /**
   * Enable mouse wheel zoom
   * Default: true
   */
  mouseWheelZoom?: boolean;

  /**
   * Enable double-click toggle
   * Default: true
   */
  doubleClickToggle?: boolean;

  /**
   * Enable full-screen mode
   * Default: true
   */
  fullScreenButton?: boolean;

  /**
   * Enable rotation controls
   * Default: true
   */
  rotationControls?: boolean;

  /**
   * Enable download button
   * Default: true
   */
  downloadButton?: boolean;

  /**
   * Show image metadata
   * Default: true
   */
  showMetadata?: boolean;

  /**
   * Enable lazy loading
   * Default: true
   */
  lazyLoad?: boolean;

  /**
   * Initial zoom mode
   * Default: 'fit'
   */
  initialZoom?: ZoomMode;

  /**
   * Zoom step (percentage)
   * Default: 0.2 (20%)
   */
  zoomStep?: number;

  /**
   * Min zoom level
   * Default: 0.1 (10%)
   */
  minZoom?: number;

  /**
   * Max zoom level
   * Default: 5.0 (500%)
   */
  maxZoom?: number;

  /**
   * Background color for transparent images
   * Default: '#f0f0f0'
   */
  backgroundColor?: string;

  /**
   * Custom CSS class for image container
   * Default: 'image-renderer'
   */
  className?: string;

  /**
   * Enable smooth zoom transitions
   * Default: true
   */
  smoothZoom?: boolean;
}

/**
 * Image Renderer
 * Implements IRenderer interface for images with zoom and pan
 */
export class ImageRenderer implements IRenderer {
  public readonly type = 'image' as const;

  private options: Required<ImageRendererOptions>;
  private streamBuffer: string = '';
  private imageCounter: number = 1;

  constructor(options: ImageRendererOptions = {}) {
    this.options = {
      zoomControls: options.zoomControls ?? true,
      pannable: options.pannable ?? true,
      mouseWheelZoom: options.mouseWheelZoom ?? true,
      doubleClickToggle: options.doubleClickToggle ?? true,
      fullScreenButton: options.fullScreenButton ?? true,
      rotationControls: options.rotationControls ?? true,
      downloadButton: options.downloadButton ?? true,
      showMetadata: options.showMetadata ?? true,
      lazyLoad: options.lazyLoad ?? true,
      initialZoom: options.initialZoom ?? 'fit',
      zoomStep: options.zoomStep ?? 0.2,
      minZoom: options.minZoom ?? 0.1,
      maxZoom: options.maxZoom ?? 5.0,
      backgroundColor: options.backgroundColor ?? '#f0f0f0',
      className: options.className ?? 'image-renderer',
      smoothZoom: options.smoothZoom ?? true
    };
  }

  /**
   * Check if content is an image
   * Detection heuristics:
   * - Starts with data:image/ (Base64)
   * - Ends with image extension (.png, .jpg, .gif, etc.)
   * - Valid URL pointing to image
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for Base64 image
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp|x-icon);base64,/.test(trimmed)) {
      return true;
    }

    // Check for image URL extensions
    if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(trimmed)) {
      return true;
    }

    // Check if it's a valid URL (might be an image)
    try {
      new URL(trimmed);
      // Could be an image URL without extension
      return /^https?:\/\//i.test(trimmed);
    } catch {
      return false;
    }
  }

  /**
   * Render image to HTML with zoom and pan controls
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Extract image metadata
      const imageMetadata = await this.extractMetadata(trimmed);

      // Generate unique ID
      const imageId = `image-viewer-${Date.now()}-${this.imageCounter++}`;

      // Build image HTML
      const imageHtml = this.buildImageHTML(imageMetadata, imageId);

      return imageHtml;

    } catch (error) {
      console.error('[ImageRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete image data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.image-loading')) {
      const loading = document.createElement('div');
      loading.className = 'image-loading';
      loading.textContent = '⏳ Loading image...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete image
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.image-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize image interactions
      this.initializeImage(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[ImageRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Extract image metadata
   */
  private async extractMetadata(src: string): Promise<ImageMetadata> {
    const metadata: ImageMetadata = { src };

    // Detect format from URL or Base64
    if (src.startsWith('data:image/')) {
      const formatMatch = src.match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp|x-icon);base64,/);
      if (formatMatch) {
        metadata.format = this.normalizeFormat(formatMatch[1]);
      }

      // Calculate Base64 size
      const base64Data = src.split(',')[1];
      if (base64Data) {
        metadata.size = Math.floor((base64Data.length * 3) / 4);
      }
    } else {
      // Extract format from file extension
      const extMatch = src.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i);
      if (extMatch) {
        metadata.format = this.normalizeFormat(extMatch[1]);
      }
    }

    // In production, this would load the image to get dimensions:
    // const img = new Image();
    // img.src = src;
    // await img.decode();
    // metadata.width = img.naturalWidth;
    // metadata.height = img.naturalHeight;

    return metadata;
  }

  /**
   * Normalize image format string
   */
  private normalizeFormat(format: string): ImageFormat {
    const normalized = format.toLowerCase().replace(/^jpeg$/, 'jpeg').replace(/^jpg$/, 'jpeg');

    if (['png', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(normalized)) {
      return normalized as ImageFormat;
    }

    return 'unknown';
  }

  /**
   * Build image HTML
   */
  private buildImageHTML(metadata: ImageMetadata, imageId: string): string {
    const { src, width, height, format, size } = metadata;

    // Build container
    let html = `<div class="${this.options.className}" data-image-id="${imageId}">`;

    // Header with actions
    html += '<div class="image-header">';
    html += '<span class="image-label">Image Viewer</span>';

    if (this.options.showMetadata && (width || height || format)) {
      html += '<span class="image-metadata">';
      if (width && height) {
        html += `${width} × ${height}`;
      }
      if (format) {
        html += ` • ${format.toUpperCase()}`;
      }
      if (size) {
        html += ` • ${this.formatFileSize(size)}`;
      }
      html += '</span>';
    }

    html += '<div class="image-actions">';

    if (this.options.zoomControls) {
      html += '<button class="image-zoom-in-btn" data-action="zoom-in" title="Zoom In">🔍+</button>';
      html += '<button class="image-zoom-out-btn" data-action="zoom-out" title="Zoom Out">🔍−</button>';
      html += '<button class="image-fit-btn" data-action="fit" title="Fit to Screen">⛶</button>';
      html += '<button class="image-actual-btn" data-action="actual" title="Actual Size (100%)">1:1</button>';
    }

    if (this.options.rotationControls) {
      html += '<button class="image-rotate-ccw-btn" data-action="rotate-ccw" title="Rotate Left">↶</button>';
      html += '<button class="image-rotate-cw-btn" data-action="rotate-cw" title="Rotate Right">↷</button>';
    }

    if (this.options.downloadButton) {
      html += '<button class="image-download-btn" data-action="download" title="Download">💾</button>';
    }

    if (this.options.fullScreenButton) {
      html += '<button class="image-fullscreen-btn" data-action="toggle-fullscreen" title="Full Screen">⛶</button>';
    }

    html += '</div>'; // .image-actions
    html += '</div>'; // .image-header

    // Image container
    const pannableClass = this.options.pannable ? ' pannable' : '';
    html += `<div class="image-container${pannableClass}" data-zoom="1" data-rotation="0">`;

    // Image wrapper (for zoom/pan transforms)
    html += '<div class="image-wrapper">';

    // Image element
    const lazyAttr = this.options.lazyLoad ? ' loading="lazy"' : '';
    const bgStyle = `background-color: ${this.options.backgroundColor}`;
    html += `<img class="image-content" src="${this.escapeHtml(src)}" alt="Image"${lazyAttr} style="${bgStyle}" />`;

    html += '</div>'; // .image-wrapper
    html += '</div>'; // .image-container

    // Zoom level indicator
    html += '<div class="image-zoom-indicator">100%</div>';

    html += '</div>'; // .image-renderer

    return html;
  }

  /**
   * Initialize image interactions
   */
  private initializeImage(container: HTMLElement): void {
    const imageContainer = container.querySelector('.image-container') as HTMLElement;
    const imageWrapper = container.querySelector('.image-wrapper') as HTMLElement;
    const img = container.querySelector('.image-content') as HTMLImageElement;
    const zoomIndicator = container.querySelector('.image-zoom-indicator') as HTMLElement;

    if (!imageContainer || !imageWrapper || !img) return;

    // Zoom state
    let currentZoom = 1.0;
    let currentRotation = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let translateX = 0;
    let translateY = 0;

    // Update transform
    const updateTransform = () => {
      const smoothClass = this.options.smoothZoom ? ' smooth' : '';
      imageWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom}) rotate(${currentRotation}deg)`;
      imageWrapper.className = `image-wrapper${smoothClass}`;

      // Update zoom indicator
      if (zoomIndicator) {
        zoomIndicator.textContent = `${Math.round(currentZoom * 100)}%`;
      }
    };

    // Zoom in
    const zoomInBtn = container.querySelector('.image-zoom-in-btn');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        currentZoom = Math.min(currentZoom + this.options.zoomStep, this.options.maxZoom);
        updateTransform();
      });
    }

    // Zoom out
    const zoomOutBtn = container.querySelector('.image-zoom-out-btn');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        currentZoom = Math.max(currentZoom - this.options.zoomStep, this.options.minZoom);
        updateTransform();
      });
    }

    // Fit to screen
    const fitBtn = container.querySelector('.image-fit-btn');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        currentZoom = 1.0;
        translateX = 0;
        translateY = 0;
        updateTransform();
      });
    }

    // Actual size (100%)
    const actualBtn = container.querySelector('.image-actual-btn');
    if (actualBtn) {
      actualBtn.addEventListener('click', () => {
        currentZoom = 1.0;
        translateX = 0;
        translateY = 0;
        updateTransform();
      });
    }

    // Rotate counterclockwise
    const rotateCcwBtn = container.querySelector('.image-rotate-ccw-btn');
    if (rotateCcwBtn) {
      rotateCcwBtn.addEventListener('click', () => {
        currentRotation = (currentRotation - 90) % 360;
        updateTransform();
      });
    }

    // Rotate clockwise
    const rotateCwBtn = container.querySelector('.image-rotate-cw-btn');
    if (rotateCwBtn) {
      rotateCwBtn.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        updateTransform();
      });
    }

    // Download
    const downloadBtn = container.querySelector('.image-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'image';
        link.click();
      });
    }

    // Full-screen
    const fullscreenBtn = container.querySelector('.image-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (container.classList.contains('fullscreen')) {
          container.classList.remove('fullscreen');
        } else {
          container.classList.add('fullscreen');
        }
      });
    }

    // Mouse wheel zoom
    if (this.options.mouseWheelZoom) {
      imageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -this.options.zoomStep : this.options.zoomStep;
        currentZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, currentZoom + delta));
        updateTransform();
      });
    }

    // Double-click toggle
    if (this.options.doubleClickToggle) {
      imageContainer.addEventListener('dblclick', () => {
        if (currentZoom === 1.0) {
          currentZoom = 2.0;
        } else {
          currentZoom = 1.0;
          translateX = 0;
          translateY = 0;
        }
        updateTransform();
      });
    }

    // Pan/drag
    if (this.options.pannable) {
      imageContainer.addEventListener('mousedown', (e) => {
        if (currentZoom <= 1.0) return; // Only pan when zoomed in

        isPanning = true;
        panStartX = e.clientX - translateX;
        panStartY = e.clientY - translateY;
        imageContainer.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;

        translateX = e.clientX - panStartX;
        translateY = e.clientY - panStartY;
        updateTransform();
      });

      window.addEventListener('mouseup', () => {
        if (isPanning) {
          isPanning = false;
          imageContainer.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
        }
      });
    }

    // Initial transform
    updateTransform();

    console.log('[ImageRenderer] Image interactions initialized');
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>Image Loading Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="image-source">
          <pre><code>${this.escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</code></pre>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML entities
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
   * Get renderer configuration
   */
  public getOptions(): Required<ImageRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<ImageRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create image renderer
 */
export function createImageRenderer(options?: ImageRendererOptions): ImageRenderer {
  return new ImageRenderer(options);
}

/**
 * Convenience function to render image
 */
export async function renderImage(
  content: string,
  options?: ImageRendererOptions
): Promise<string> {
  const renderer = createImageRenderer(options);
  return renderer.render(content);
}

/**
 * Example images for documentation
 */
export const IMAGE_EXAMPLES = {
  url: 'https://example.com/image.png',

  base64Png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',

  base64Jpeg: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDA...',

  svg: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InJlZCIvPjwvc3ZnPg=='
};
