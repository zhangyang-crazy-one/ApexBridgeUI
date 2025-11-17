/**
 * PDF Renderer (CORE-030)
 *
 * Responsibilities:
 * - Render PDF documents with page navigation
 * - Support PDF file display using PDF.js library
 * - Provide page navigation controls (prev/next, jump to page)
 * - Zoom controls (zoom in/out, fit to width/page)
 * - Search functionality within PDF content
 * - Display PDF metadata (title, author, page count)
 * - Download PDF file
 * - Thumbnail navigation sidebar
 * - Streaming chunk rendering (progressive PDF loading)
 *
 * Features:
 * - Page Navigation: Previous/Next page buttons, page number input
 * - Zoom Controls: Zoom in/out, fit to width, fit to page, actual size
 * - Search: Text search with highlight and navigation
 * - Thumbnail Sidebar: Visual page thumbnails for quick navigation
 * - Rotation: Rotate pages 90° clockwise/counterclockwise
 * - Full-screen Mode: View PDF in full-screen
 * - Print Support: Print PDF document
 * - Download: Download PDF file
 * - Keyboard Shortcuts: Arrow keys (navigation), +/- (zoom), / (search)
 * - Metadata Display: Title, author, subject, page count, file size
 *
 * Usage:
 * ```typescript
 * import { createPdfRenderer } from './renderers/pdfRenderer';
 *
 * const renderer = createPdfRenderer();
 * const html = await renderer.render('https://example.com/document.pdf');
 * // Or Base64: data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogIC...
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * PDF metadata
 */
export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount?: number;
  size?: number;  // File size in bytes
  src: string;
}

/**
 * Zoom mode
 */
export type PdfZoomMode = 'fit-width' | 'fit-page' | 'actual' | 'custom';

/**
 * PDF renderer options
 */
export interface PdfRendererOptions {
  /**
   * Enable page navigation controls
   * Default: true
   */
  navigation?: boolean;

  /**
   * Enable zoom controls
   * Default: true
   */
  zoomControls?: boolean;

  /**
   * Enable search functionality
   * Default: true
   */
  searchEnabled?: boolean;

  /**
   * Enable thumbnail sidebar
   * Default: true
   */
  thumbnails?: boolean;

  /**
   * Enable rotation controls
   * Default: true
   */
  rotationControls?: boolean;

  /**
   * Enable full-screen button
   * Default: true
   */
  fullScreenButton?: boolean;

  /**
   * Enable print button
   * Default: true
   */
  printButton?: boolean;

  /**
   * Enable download button
   * Default: true
   */
  downloadButton?: boolean;

  /**
   * Show PDF metadata
   * Default: true
   */
  showMetadata?: boolean;

  /**
   * Enable keyboard shortcuts
   * Default: true
   */
  keyboardShortcuts?: boolean;

  /**
   * Initial zoom mode
   * Default: 'fit-width'
   */
  initialZoom?: PdfZoomMode;

  /**
   * Initial page number
   * Default: 1
   */
  initialPage?: number;

  /**
   * Zoom step (percentage)
   * Default: 0.1 (10%)
   */
  zoomStep?: number;

  /**
   * Min zoom level
   * Default: 0.5 (50%)
   */
  minZoom?: number;

  /**
   * Max zoom level
   * Default: 3.0 (300%)
   */
  maxZoom?: number;

  /**
   * Background color for PDF container
   * Default: '#525659'
   */
  backgroundColor?: string;

  /**
   * Custom CSS class for PDF container
   * Default: 'pdf-renderer'
   */
  className?: string;

  /**
   * Enable text selection
   * Default: true
   */
  textSelection?: boolean;
}

/**
 * PDF Renderer
 * Implements IRenderer interface for PDF documents with page navigation
 */
export class PdfRenderer implements IRenderer {
  public readonly type = 'pdf' as const;

  private options: Required<PdfRendererOptions>;
  private streamBuffer: string = '';
  private pdfCounter: number = 1;

  constructor(options: PdfRendererOptions = {}) {
    this.options = {
      navigation: options.navigation ?? true,
      zoomControls: options.zoomControls ?? true,
      searchEnabled: options.searchEnabled ?? true,
      thumbnails: options.thumbnails ?? true,
      rotationControls: options.rotationControls ?? true,
      fullScreenButton: options.fullScreenButton ?? true,
      printButton: options.printButton ?? true,
      downloadButton: options.downloadButton ?? true,
      showMetadata: options.showMetadata ?? true,
      keyboardShortcuts: options.keyboardShortcuts ?? true,
      initialZoom: options.initialZoom ?? 'fit-width',
      initialPage: options.initialPage ?? 1,
      zoomStep: options.zoomStep ?? 0.1,
      minZoom: options.minZoom ?? 0.5,
      maxZoom: options.maxZoom ?? 3.0,
      backgroundColor: options.backgroundColor ?? '#525659',
      className: options.className ?? 'pdf-renderer',
      textSelection: options.textSelection ?? true
    };
  }

  /**
   * Check if content is a PDF
   * Detection heuristics:
   * - Starts with data:application/pdf (Base64)
   * - Ends with .pdf extension
   * - Valid URL pointing to PDF
   * - Starts with %PDF- (PDF magic number)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for Base64 PDF
    if (/^data:application\/pdf;base64,/.test(trimmed)) {
      return true;
    }

    // Check for PDF URL extension
    if (/\.pdf(\?.*)?$/i.test(trimmed)) {
      return true;
    }

    // Check for PDF magic number (%PDF-)
    if (trimmed.startsWith('%PDF-')) {
      return true;
    }

    // Check if it's a valid URL (might be PDF)
    try {
      new URL(trimmed);
      return /^https?:\/\//i.test(trimmed);
    } catch {
      return false;
    }
  }

  /**
   * Render PDF to HTML with page navigation
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Extract PDF metadata
      const pdfMetadata = await this.extractMetadata(trimmed);

      // Generate unique ID
      const pdfId = `pdf-viewer-${Date.now()}-${this.pdfCounter++}`;

      // Build PDF HTML
      const pdfHtml = this.buildPdfHTML(pdfMetadata, pdfId);

      return pdfHtml;

    } catch (error) {
      console.error('[PdfRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete PDF data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.pdf-loading')) {
      const loading = document.createElement('div');
      loading.className = 'pdf-loading';
      loading.textContent = '⏳ Loading PDF...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete PDF
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.pdf-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize PDF viewer
      this.initializePdf(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[PdfRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Extract PDF metadata
   */
  private async extractMetadata(src: string): Promise<PdfMetadata> {
    const metadata: PdfMetadata = { src };

    // Calculate Base64 size
    if (src.startsWith('data:application/pdf;base64,')) {
      const base64Data = src.split(',')[1];
      if (base64Data) {
        metadata.size = Math.floor((base64Data.length * 3) / 4);
      }
    }

    // In production, this would use PDF.js to extract metadata:
    // const loadingTask = pdfjsLib.getDocument(src);
    // const pdf = await loadingTask.promise;
    // metadata.pageCount = pdf.numPages;
    // const info = await pdf.getMetadata();
    // metadata.title = info.info.Title;
    // metadata.author = info.info.Author;
    // metadata.subject = info.info.Subject;
    // metadata.creator = info.info.Creator;
    // metadata.producer = info.info.Producer;

    // Placeholder metadata
    metadata.pageCount = 1; // Would be extracted from PDF

    return metadata;
  }

  /**
   * Build PDF HTML
   */
  private buildPdfHTML(metadata: PdfMetadata, pdfId: string): string {
    const { src, title, author, pageCount, size } = metadata;

    // Build container
    let html = `<div class="${this.options.className}" data-pdf-id="${pdfId}">`;

    // Header with actions
    html += '<div class="pdf-header">';
    html += '<span class="pdf-label">PDF Viewer</span>';

    if (this.options.showMetadata && (title || author || pageCount)) {
      html += '<span class="pdf-metadata">';
      if (title) {
        html += this.escapeHtml(title);
      }
      if (author) {
        html += ` • ${this.escapeHtml(author)}`;
      }
      if (pageCount) {
        html += ` • ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
      }
      if (size) {
        html += ` • ${this.formatFileSize(size)}`;
      }
      html += '</span>';
    }

    html += '<div class="pdf-actions">';

    if (this.options.searchEnabled) {
      html += '<input type="text" class="pdf-search-input" placeholder="Search PDF..." />';
      html += '<button class="pdf-search-btn" data-action="search" title="Search (/)">🔍</button>';
    }

    if (this.options.printButton) {
      html += '<button class="pdf-print-btn" data-action="print" title="Print">🖨️</button>';
    }

    if (this.options.downloadButton) {
      html += '<button class="pdf-download-btn" data-action="download" title="Download">💾</button>';
    }

    html += '</div>'; // .pdf-actions
    html += '</div>'; // .pdf-header

    // Main content area
    html += '<div class="pdf-content-area">';

    // Thumbnail sidebar (if enabled)
    if (this.options.thumbnails) {
      html += '<div class="pdf-thumbnail-sidebar">';
      html += '<div class="pdf-thumbnail-container">';
      html += '<!-- Thumbnails will be rendered here -->';
      html += '</div>';
      html += '</div>';
    }

    // PDF viewer container
    html += `<div class="pdf-viewer-container" style="background-color: ${this.options.backgroundColor}">`;
    html += '<canvas class="pdf-canvas"></canvas>';
    html += '<div class="pdf-text-layer"></div>'; // For text selection
    html += '</div>';

    html += '</div>'; // .pdf-content-area

    // Controls toolbar
    if (this.options.navigation || this.options.zoomControls) {
      html += this.buildControlsToolbar();
    }

    html += '</div>'; // .pdf-renderer

    return html;
  }

  /**
   * Build controls toolbar
   */
  private buildControlsToolbar(): string {
    let html = '<div class="pdf-controls">';

    // Page navigation (if enabled)
    if (this.options.navigation) {
      html += '<div class="pdf-page-controls">';
      html += '<button class="pdf-prev-page-btn" data-action="prev-page" title="Previous Page (←)">◀</button>';
      html += '<input type="number" class="pdf-page-input" value="1" min="1" title="Page Number">';
      html += '<span class="pdf-page-total">/ 1</span>';
      html += '<button class="pdf-next-page-btn" data-action="next-page" title="Next Page (→)">▶</button>';
      html += '</div>';
    }

    // Zoom controls (if enabled)
    if (this.options.zoomControls) {
      html += '<div class="pdf-zoom-controls">';
      html += '<button class="pdf-zoom-out-btn" data-action="zoom-out" title="Zoom Out (-)">−</button>';
      html += '<span class="pdf-zoom-level">100%</span>';
      html += '<button class="pdf-zoom-in-btn" data-action="zoom-in" title="Zoom In (+)">+</button>';
      html += '<button class="pdf-fit-width-btn" data-action="fit-width" title="Fit to Width">⬌</button>';
      html += '<button class="pdf-fit-page-btn" data-action="fit-page" title="Fit to Page">⛶</button>';
      html += '<button class="pdf-actual-size-btn" data-action="actual-size" title="Actual Size">1:1</button>';
      html += '</div>';
    }

    // Rotation controls (if enabled)
    if (this.options.rotationControls) {
      html += '<div class="pdf-rotation-controls">';
      html += '<button class="pdf-rotate-ccw-btn" data-action="rotate-ccw" title="Rotate Left">↶</button>';
      html += '<button class="pdf-rotate-cw-btn" data-action="rotate-cw" title="Rotate Right">↷</button>';
      html += '</div>';
    }

    // Full-screen button (if enabled)
    if (this.options.fullScreenButton) {
      html += '<button class="pdf-fullscreen-btn" data-action="fullscreen" title="Full Screen">⛶</button>';
    }

    html += '</div>'; // .pdf-controls

    return html;
  }

  /**
   * Initialize PDF viewer
   * This is a placeholder implementation. In production, use PDF.js library.
   */
  private initializePdf(container: HTMLElement): void {
    const canvas = container.querySelector('.pdf-canvas') as HTMLCanvasElement;
    const pageInput = container.querySelector('.pdf-page-input') as HTMLInputElement;
    const pageTotal = container.querySelector('.pdf-page-total') as HTMLElement;
    const zoomLevel = container.querySelector('.pdf-zoom-level') as HTMLElement;

    if (!canvas) return;

    // PDF.js would be initialized here:
    // const loadingTask = pdfjsLib.getDocument(src);
    // const pdf = await loadingTask.promise;
    // this.renderPage(pdf, pageNum, scale);

    // State management
    let currentPage = this.options.initialPage;
    let totalPages = 1; // Would be from PDF metadata
    let currentZoom = 1.0;
    let rotation = 0;

    // Update page total
    if (pageTotal) {
      pageTotal.textContent = `/ ${totalPages}`;
    }

    // Page navigation
    const prevPageBtn = container.querySelector('.pdf-prev-page-btn');
    const nextPageBtn = container.querySelector('.pdf-next-page-btn');

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          if (pageInput) pageInput.value = String(currentPage);
          console.log('[PdfRenderer] Navigate to page', currentPage);
          // this.renderPage(pdf, currentPage, currentZoom);
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          if (pageInput) pageInput.value = String(currentPage);
          console.log('[PdfRenderer] Navigate to page', currentPage);
          // this.renderPage(pdf, currentPage, currentZoom);
        }
      });
    }

    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const newPage = Number((e.target as HTMLInputElement).value);
        if (newPage >= 1 && newPage <= totalPages) {
          currentPage = newPage;
          console.log('[PdfRenderer] Jump to page', currentPage);
          // this.renderPage(pdf, currentPage, currentZoom);
        } else {
          pageInput.value = String(currentPage);
        }
      });
    }

    // Zoom controls
    const zoomInBtn = container.querySelector('.pdf-zoom-in-btn');
    const zoomOutBtn = container.querySelector('.pdf-zoom-out-btn');
    const fitWidthBtn = container.querySelector('.pdf-fit-width-btn');
    const fitPageBtn = container.querySelector('.pdf-fit-page-btn');
    const actualSizeBtn = container.querySelector('.pdf-actual-size-btn');

    const updateZoomDisplay = () => {
      if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
      }
    };

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        currentZoom = Math.min(currentZoom + this.options.zoomStep, this.options.maxZoom);
        updateZoomDisplay();
        console.log('[PdfRenderer] Zoom in:', currentZoom);
        // this.renderPage(pdf, currentPage, currentZoom);
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        currentZoom = Math.max(currentZoom - this.options.zoomStep, this.options.minZoom);
        updateZoomDisplay();
        console.log('[PdfRenderer] Zoom out:', currentZoom);
        // this.renderPage(pdf, currentPage, currentZoom);
      });
    }

    if (fitWidthBtn) {
      fitWidthBtn.addEventListener('click', () => {
        console.log('[PdfRenderer] Fit to width');
        // Calculate zoom to fit width
        // currentZoom = containerWidth / pageWidth;
        // this.renderPage(pdf, currentPage, currentZoom);
      });
    }

    if (fitPageBtn) {
      fitPageBtn.addEventListener('click', () => {
        console.log('[PdfRenderer] Fit to page');
        // Calculate zoom to fit entire page
        // this.renderPage(pdf, currentPage, currentZoom);
      });
    }

    if (actualSizeBtn) {
      actualSizeBtn.addEventListener('click', () => {
        currentZoom = 1.0;
        updateZoomDisplay();
        console.log('[PdfRenderer] Actual size');
        // this.renderPage(pdf, currentPage, currentZoom);
      });
    }

    // Rotation controls
    const rotateCcwBtn = container.querySelector('.pdf-rotate-ccw-btn');
    const rotateCwBtn = container.querySelector('.pdf-rotate-cw-btn');

    if (rotateCcwBtn) {
      rotateCcwBtn.addEventListener('click', () => {
        rotation = (rotation - 90) % 360;
        console.log('[PdfRenderer] Rotate left:', rotation);
        // this.renderPage(pdf, currentPage, currentZoom, rotation);
      });
    }

    if (rotateCwBtn) {
      rotateCwBtn.addEventListener('click', () => {
        rotation = (rotation + 90) % 360;
        console.log('[PdfRenderer] Rotate right:', rotation);
        // this.renderPage(pdf, currentPage, currentZoom, rotation);
      });
    }

    // Search functionality
    const searchInput = container.querySelector('.pdf-search-input') as HTMLInputElement;
    const searchBtn = container.querySelector('.pdf-search-btn');

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
          console.log('[PdfRenderer] Search:', query);
          // Perform PDF text search using PDF.js
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          searchBtn.click();
        }
      });
    }

    // Print button
    const printBtn = container.querySelector('.pdf-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        console.log('[PdfRenderer] Print PDF');
        // In production: window.print() or PDF.js print API
      });
    }

    // Download button
    const downloadBtn = container.querySelector('.pdf-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const pdfSrc = container.querySelector('.pdf-renderer')?.getAttribute('data-pdf-src');
        if (pdfSrc) {
          const link = document.createElement('a');
          link.href = pdfSrc;
          link.download = 'document.pdf';
          link.click();
        }
      });
    }

    // Full-screen button
    const fullscreenBtn = container.querySelector('.pdf-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          container.requestFullscreen();
        }
      });
    }

    // Keyboard shortcuts (if enabled)
    if (this.options.keyboardShortcuts) {
      container.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (prevPageBtn) (prevPageBtn as HTMLElement).click();
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (nextPageBtn) (nextPageBtn as HTMLElement).click();
            break;
          case '+':
          case '=':
            e.preventDefault();
            if (zoomInBtn) (zoomInBtn as HTMLElement).click();
            break;
          case '-':
          case '_':
            e.preventDefault();
            if (zoomOutBtn) (zoomOutBtn as HTMLElement).click();
            break;
          case '/':
            e.preventDefault();
            if (searchInput) searchInput.focus();
            break;
        }
      });

      // Make container focusable
      container.setAttribute('tabindex', '0');
    }

    console.log('[PdfRenderer] PDF viewer initialized (placeholder)');
    console.log('[PdfRenderer] In production, integrate PDF.js library for full functionality');
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
          <strong>PDF Loading Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="pdf-source">
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
  public getOptions(): Required<PdfRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<PdfRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create PDF renderer
 */
export function createPdfRenderer(options?: PdfRendererOptions): PdfRenderer {
  return new PdfRenderer(options);
}

/**
 * Convenience function to render PDF
 */
export async function renderPdf(
  content: string,
  options?: PdfRendererOptions
): Promise<string> {
  const renderer = createPdfRenderer(options);
  return renderer.render(content);
}

/**
 * Example PDFs for documentation
 */
export const PDF_EXAMPLES = {
  url: 'https://example.com/document.pdf',

  base64: 'data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogIC8gVHlwZSAvQ2F0YWxvZwog...',

  magicNumber: '%PDF-1.7\n...'
};
