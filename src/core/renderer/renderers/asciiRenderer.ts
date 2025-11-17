/**
 * ASCII Art Renderer (CORE-036)
 *
 * Responsibilities:
 * - Render ASCII art with preserved monospace layout
 * - Maintain exact spacing and character alignment
 * - Support ANSI color codes and formatting
 * - Preserve box-drawing characters
 * - Handle different line endings (CRLF, LF)
 * - Optional ANSI color rendering
 * - Copy ASCII art to clipboard
 * - Download as .txt file
 * - Zoom controls for better visibility
 * - Streaming chunk rendering (progressive ASCII loading)
 *
 * Features:
 * - Monospace Font: Preserve exact character spacing
 * - ANSI Colors: Parse and render ANSI escape sequences
 * - Box Drawing: Unicode box-drawing characters
 * - Line Preservation: No text wrapping or reformatting
 * - Copy Button: Copy entire ASCII art
 * - Download Button: Save as .txt file
 * - Zoom Controls: Increase/decrease font size
 * - Dark/Light Theme: Auto-adapts to theme
 * - Character Count: Show dimensions (lines x max width)
 * - Whitespace Display: Option to show spaces/tabs
 *
 * Usage:
 * ```typescript
 * import { createAsciiRenderer } from './renderers/asciiRenderer';
 *
 * const renderer = createAsciiRenderer();
 * const html = await renderer.render(asciiContent);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * ANSI color codes mapping
 */
const ANSI_COLORS: Record<string, string> = {
  '30': '#000000', // Black
  '31': '#CD3131', // Red
  '32': '#0DBC79', // Green
  '33': '#E5E510', // Yellow
  '34': '#2472C8', // Blue
  '35': '#BC3FBC', // Magenta
  '36': '#11A8CD', // Cyan
  '37': '#E5E5E5', // White
  '90': '#666666', // Bright Black (Gray)
  '91': '#F14C4C', // Bright Red
  '92': '#23D18B', // Bright Green
  '93': '#F5F543', // Bright Yellow
  '94': '#3B8EEA', // Bright Blue
  '95': '#D670D6', // Bright Magenta
  '96': '#29B8DB', // Bright Cyan
  '97': '#FFFFFF'  // Bright White
};

/**
 * ASCII art metadata
 */
export interface AsciiMetadata {
  lines: number;
  maxWidth: number;
  hasAnsiCodes: boolean;
  hasBoxDrawing: boolean;
  hasUnicode: boolean;
}

/**
 * ASCII renderer options
 */
export interface AsciiRendererOptions {
  /**
   * Enable ANSI color rendering
   * Default: true
   */
  ansiColors?: boolean;

  /**
   * Enable copy button
   * Default: true
   */
  copyButton?: boolean;

  /**
   * Enable download button
   * Default: true
   */
  downloadButton?: boolean;

  /**
   * Enable zoom controls
   * Default: true
   */
  zoomControls?: boolean;

  /**
   * Show metadata (dimensions)
   * Default: true
   */
  showMetadata?: boolean;

  /**
   * Base font size (px)
   * Default: 14
   */
  baseFontSize?: number;

  /**
   * Max display lines before truncation
   * Default: 500
   */
  maxLines?: number;

  /**
   * Preserve trailing whitespace
   * Default: true
   */
  preserveWhitespace?: boolean;

  /**
   * Custom CSS class for ASCII container
   * Default: 'ascii-renderer'
   */
  className?: string;
}

/**
 * ASCII Art Renderer
 * Implements IRenderer interface for ASCII art with monospace layout
 */
export class AsciiRenderer implements IRenderer {
  public readonly type = 'ascii' as const;

  private options: Required<AsciiRendererOptions>;
  private streamBuffer: string = '';
  private asciiCounter: number = 1;

  constructor(options: AsciiRendererOptions = {}) {
    this.options = {
      ansiColors: options.ansiColors ?? true,
      copyButton: options.copyButton ?? true,
      downloadButton: options.downloadButton ?? true,
      zoomControls: options.zoomControls ?? true,
      showMetadata: options.showMetadata ?? true,
      baseFontSize: options.baseFontSize ?? 14,
      maxLines: options.maxLines ?? 500,
      preserveWhitespace: options.preserveWhitespace ?? true,
      className: options.className ?? 'ascii-renderer'
    };
  }

  /**
   * Check if content is ASCII art
   * Detection heuristics:
   * - Contains box-drawing characters
   * - Has consistent character-based patterns
   * - Multiple lines with similar width
   * - Contains ANSI escape codes
   * - Uses ASCII art characters (|, -, +, *, #, etc.)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for ANSI escape codes
    if (/\x1b\[[0-9;]*m/.test(trimmed)) {
      return true;
    }

    // Check for box-drawing characters (Unicode U+2500-U+257F)
    if (/[\u2500-\u257F]/.test(trimmed)) {
      return true;
    }

    // Check for ASCII art patterns
    const lines = trimmed.split('\n');

    // Need at least 3 lines for ASCII art
    if (lines.length < 3) return false;

    // Check for common ASCII art characters
    const asciiArtChars = /[|\/\\+\-_=*#@%&]/;
    const linesWithAsciiArt = lines.filter(line => asciiArtChars.test(line)).length;

    // If >50% of lines have ASCII art characters
    if (linesWithAsciiArt / lines.length > 0.5) {
      return true;
    }

    // Check for consistent width (indicates deliberate formatting)
    const widths = lines.map(line => line.length);
    const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
    const similarWidth = widths.filter(w => Math.abs(w - avgWidth) < avgWidth * 0.2).length;

    // If >60% of lines have similar width
    if (similarWidth / lines.length > 0.6) {
      return true;
    }

    return false;
  }

  /**
   * Render ASCII art to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Analyze ASCII content
      const asciiMetadata = this.analyzeAscii(trimmed);

      // Generate unique ID
      const asciiId = `ascii-viewer-${Date.now()}-${this.asciiCounter++}`;

      // Process ANSI codes if enabled
      const processedContent = this.options.ansiColors
        ? this.processAnsiCodes(trimmed)
        : this.escapeHtml(trimmed);

      // Build ASCII HTML
      const asciiHtml = this.buildAsciiHTML(processedContent, asciiMetadata, asciiId);

      return asciiHtml;

    } catch (error) {
      console.error('[AsciiRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete ASCII data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.ascii-loading')) {
      const loading = document.createElement('div');
      loading.className = 'ascii-loading';
      loading.textContent = '⏳ Loading ASCII art...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete ASCII
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.ascii-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize ASCII viewer interactions
      this.initializeAscii(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[AsciiRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Analyze ASCII content metadata
   */
  private analyzeAscii(content: string): AsciiMetadata {
    const lines = content.split('\n');
    const maxWidth = Math.max(...lines.map(line => line.length));

    return {
      lines: lines.length,
      maxWidth,
      hasAnsiCodes: /\x1b\[[0-9;]*m/.test(content),
      hasBoxDrawing: /[\u2500-\u257F]/.test(content),
      hasUnicode: /[^\x00-\x7F]/.test(content)
    };
  }

  /**
   * Process ANSI escape codes
   */
  private processAnsiCodes(content: string): string {
    // Split by ANSI escape sequences
    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let result = '';
    let lastIndex = 0;
    let currentStyles: string[] = [];

    // Process each ANSI code
    let match;
    while ((match = ansiRegex.exec(content)) !== null) {
      // Add text before this code
      if (match.index > lastIndex) {
        const text = content.substring(lastIndex, match.index);
        result += this.wrapWithStyles(text, currentStyles);
      }

      // Parse ANSI code
      const codes = match[1].split(';').filter(c => c);

      for (const code of codes) {
        if (code === '0' || code === '') {
          // Reset all styles
          currentStyles = [];
        } else if (code === '1') {
          // Bold
          currentStyles.push('font-weight: bold');
        } else if (code === '3') {
          // Italic
          currentStyles.push('font-style: italic');
        } else if (code === '4') {
          // Underline
          currentStyles.push('text-decoration: underline');
        } else if (ANSI_COLORS[code]) {
          // Foreground color (30-37, 90-97)
          currentStyles.push(`color: ${ANSI_COLORS[code]}`);
        } else if (code.startsWith('4') && ANSI_COLORS[code.substring(1)]) {
          // Background color (40-47, 100-107)
          const bgColor = ANSI_COLORS[code.substring(1)];
          currentStyles.push(`background-color: ${bgColor}`);
        }
      }

      lastIndex = ansiRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const text = content.substring(lastIndex);
      result += this.wrapWithStyles(text, currentStyles);
    }

    return result;
  }

  /**
   * Wrap text with ANSI styles
   */
  private wrapWithStyles(text: string, styles: string[]): string {
    if (styles.length === 0) {
      return this.escapeHtml(text);
    }

    const styleAttr = styles.join('; ');
    return `<span style="${styleAttr}">${this.escapeHtml(text)}</span>`;
  }

  /**
   * Build ASCII HTML
   */
  private buildAsciiHTML(content: string, metadata: AsciiMetadata, asciiId: string): string {
    let html = `<div class="${this.options.className}" data-ascii-id="${asciiId}">`;

    // Header with actions
    html += '<div class="ascii-header">';
    html += '<span class="ascii-label">ASCII Art</span>';

    // Metadata
    if (this.options.showMetadata) {
      html += '<div class="ascii-metadata">';
      html += `<span class="ascii-meta-item">${metadata.lines} lines</span>`;
      html += `<span class="ascii-meta-item">${metadata.maxWidth} chars wide</span>`;

      if (metadata.hasAnsiCodes) {
        html += '<span class="ascii-meta-badge">ANSI Colors</span>';
      }
      if (metadata.hasBoxDrawing) {
        html += '<span class="ascii-meta-badge">Box Drawing</span>';
      }
      if (metadata.hasUnicode) {
        html += '<span class="ascii-meta-badge">Unicode</span>';
      }

      html += '</div>'; // .ascii-metadata
    }

    html += '<div class="ascii-actions">';

    if (this.options.zoomControls) {
      html += '<button class="ascii-zoom-out" data-action="zoom-out" title="Zoom Out">−</button>';
      html += `<span class="ascii-zoom-level">${this.options.baseFontSize}px</span>`;
      html += '<button class="ascii-zoom-in" data-action="zoom-in" title="Zoom In">+</button>';
    }

    if (this.options.copyButton) {
      html += '<button class="ascii-copy-btn" data-action="copy" title="Copy">📋</button>';
    }

    if (this.options.downloadButton) {
      html += '<button class="ascii-download-btn" data-action="download" title="Download">💾</button>';
    }

    html += '</div>'; // .ascii-actions
    html += '</div>'; // .ascii-header

    // ASCII content with monospace font
    html += `<div class="ascii-content" style="font-size: ${this.options.baseFontSize}px;">`;
    html += '<pre class="ascii-text">';

    // Split and render lines
    const lines = content.split('\n');
    const displayLines = lines.slice(0, this.options.maxLines);

    for (const line of displayLines) {
      // Preserve whitespace
      if (this.options.preserveWhitespace) {
        // Replace spaces with non-breaking spaces to preserve layout
        const preservedLine = line.replace(/ /g, '&nbsp;');
        html += preservedLine + '\n';
      } else {
        html += line + '\n';
      }
    }

    // Truncation notice
    if (lines.length > this.options.maxLines) {
      html += `\n... (${lines.length - this.options.maxLines} more lines hidden)`;
    }

    html += '</pre>';
    html += '</div>'; // .ascii-content

    html += '</div>'; // .ascii-renderer

    return html;
  }

  /**
   * Initialize ASCII viewer interactions
   */
  private initializeAscii(container: HTMLElement): void {
    const asciiId = container.getAttribute('data-ascii-id');
    if (!asciiId) return;

    const asciiContent = container.querySelector('.ascii-content') as HTMLElement;
    const zoomLevel = container.querySelector('.ascii-zoom-level') as HTMLElement;

    let currentFontSize = this.options.baseFontSize;

    // Zoom in button
    const zoomInBtn = container.querySelector('.ascii-zoom-in');
    if (zoomInBtn && asciiContent && zoomLevel) {
      zoomInBtn.addEventListener('click', () => {
        currentFontSize = Math.min(currentFontSize + 2, 32);
        asciiContent.style.fontSize = `${currentFontSize}px`;
        zoomLevel.textContent = `${currentFontSize}px`;
      });
    }

    // Zoom out button
    const zoomOutBtn = container.querySelector('.ascii-zoom-out');
    if (zoomOutBtn && asciiContent && zoomLevel) {
      zoomOutBtn.addEventListener('click', () => {
        currentFontSize = Math.max(currentFontSize - 2, 8);
        asciiContent.style.fontSize = `${currentFontSize}px`;
        zoomLevel.textContent = `${currentFontSize}px`;
      });
    }

    // Copy button
    const copyBtn = container.querySelector('.ascii-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const asciiText = this.extractAsciiText(container);
        navigator.clipboard.writeText(asciiText).then(() => {
          (copyBtn as HTMLElement).textContent = '✓';
          setTimeout(() => {
            (copyBtn as HTMLElement).textContent = '📋';
          }, 2000);
        });
      });
    }

    // Download button
    const downloadBtn = container.querySelector('.ascii-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const asciiText = this.extractAsciiText(container);
        const blob = new Blob([asciiText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ascii-art.txt';
        link.click();
        URL.revokeObjectURL(url);
      });
    }

    console.log('[AsciiRenderer] ASCII viewer initialized');
  }

  /**
   * Extract ASCII text from container
   */
  private extractAsciiText(container: HTMLElement): string {
    const preElement = container.querySelector('.ascii-text');
    if (!preElement) return '';

    // Get text content and restore spaces
    let text = preElement.textContent || '';

    // Remove non-breaking spaces if they were added
    text = text.replace(/\u00A0/g, ' ');

    return text;
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>ASCII Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="ascii-source">
          <pre><code>${this.escapeHtml(content.substring(0, 500))}${content.length > 500 ? '...' : ''}</code></pre>
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
  public getOptions(): Required<AsciiRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<AsciiRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create ASCII renderer
 */
export function createAsciiRenderer(options?: AsciiRendererOptions): AsciiRenderer {
  return new AsciiRenderer(options);
}

/**
 * Convenience function to render ASCII
 */
export async function renderAscii(
  content: string,
  options?: AsciiRendererOptions
): Promise<string> {
  const renderer = createAsciiRenderer(options);
  return renderer.render(content);
}

/**
 * Example ASCII art for documentation
 */
export const ASCII_EXAMPLES = {
  simple: `
    _____
   /     \\
  | () () |
   \\  ^  /
    |||||
    |||||
  `,

  boxDrawing: `
┌─────────────────────┐
│  Box Drawing Demo   │
├─────────────────────┤
│ ├── Item 1          │
│ ├── Item 2          │
│ └── Item 3          │
└─────────────────────┘
  `,

  ansi: `
\x1b[31mRed Text\x1b[0m
\x1b[32mGreen Text\x1b[0m
\x1b[33mYellow Text\x1b[0m
\x1b[34mBlue Text\x1b[0m
\x1b[1mBold Text\x1b[0m
\x1b[4mUnderlined Text\x1b[0m
  `,

  logo: `
     /\\
    /  \\
   / /\\ \\
  / ____ \\
 /_/    \\_\\
  `,

  banner: `
╔═══════════════════════════════════════╗
║                                       ║
║         VCPChat ASCII Banner          ║
║                                       ║
║  A modern AI collaboration platform   ║
║                                       ║
╚═══════════════════════════════════════╝
  `
};
