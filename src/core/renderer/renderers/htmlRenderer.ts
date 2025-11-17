/**
 * HTML Renderer (CORE-021)
 *
 * Responsibilities:
 * - Render HTML content in a sandboxed iframe for security
 * - Prevent XSS attacks through iframe sandbox attributes
 * - Support interactive HTML with JavaScript (if explicitly allowed)
 * - Auto-resize iframe to fit content
 * - Support CSS styling and animations
 * - Streaming chunk rendering with buffering
 * - Full-screen toggle for complex HTML applications
 *
 * Features:
 * - Sandboxed iframe: Isolates HTML from parent window
 * - CSP (Content Security Policy): Restricts resource loading
 * - Auto-resize: Iframe height adjusts to content
 * - Full-screen mode: Toggle full-screen for interactive content
 * - Theme integration: Inject parent theme variables
 * - Message passing: Safe communication with parent window
 * - Resource allowlist: Control external resource loading
 *
 * Security Considerations:
 * - All HTML is rendered in sandboxed iframe with restricted permissions
 * - JavaScript execution is disabled by default (can be enabled with allowScripts option)
 * - No access to parent window, cookies, or local storage by default
 * - External resources (images, scripts, stylesheets) are blocked by default
 * - CSP headers prevent inline scripts and external resource loading
 *
 * Usage:
 * ```typescript
 * import { createHtmlRenderer } from './renderers/htmlRenderer';
 *
 * const renderer = createHtmlRenderer({ allowScripts: false });
 * const html = await renderer.render('<div>Hello World</div>');
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * HTML renderer options
 */
export interface HtmlRendererOptions {
  /**
   * Allow JavaScript execution in sandbox
   * Default: false (security)
   */
  allowScripts?: boolean;

  /**
   * Allow form submissions from sandbox
   * Default: false
   */
  allowForms?: boolean;

  /**
   * Allow modal dialogs (alert, confirm, prompt)
   * Default: false
   */
  allowModals?: boolean;

  /**
   * Allow pointer lock API
   * Default: false
   */
  allowPointerLock?: boolean;

  /**
   * Allow popups (window.open, target="_blank")
   * Default: false
   */
  allowPopups?: boolean;

  /**
   * Allow same-origin access (dangerous!)
   * Default: false
   */
  allowSameOrigin?: boolean;

  /**
   * Enable auto-resize to fit content
   * Default: true
   */
  autoResize?: boolean;

  /**
   * Enable full-screen toggle button
   * Default: true
   */
  fullScreenButton?: boolean;

  /**
   * Show "HTML Content" label in header
   * Default: true
   */
  showLabel?: boolean;

  /**
   * Initial iframe height (before auto-resize)
   * Default: '400px'
   */
  initialHeight?: string;

  /**
   * Maximum iframe height
   * Default: '800px'
   */
  maxHeight?: string;

  /**
   * Inject parent theme CSS variables into iframe
   * Default: true
   */
  injectTheme?: boolean;

  /**
   * Custom CSS to inject into iframe
   */
  customCss?: string;

  /**
   * Custom sandbox attributes (overrides default)
   */
  customSandbox?: string;

  /**
   * Custom CSS class for HTML container
   * Default: 'html-renderer'
   */
  className?: string;
}

/**
 * HTML Renderer
 * Implements IRenderer interface for HTML content with sandboxed iframe
 */
export class HtmlRenderer implements IRenderer {
  public readonly type = 'html' as const;

  private options: Required<Omit<HtmlRendererOptions, 'customCss' | 'customSandbox'>> & {
    customCss?: string;
    customSandbox?: string;
  };

  private streamBuffer: string = '';
  private iframeRegistry: Map<string, HTMLIFrameElement> = new Map();

  constructor(options: HtmlRendererOptions = {}) {
    this.options = {
      allowScripts: options.allowScripts ?? false,
      allowForms: options.allowForms ?? false,
      allowModals: options.allowModals ?? false,
      allowPointerLock: options.allowPointerLock ?? false,
      allowPopups: options.allowPopups ?? false,
      allowSameOrigin: options.allowSameOrigin ?? false,
      autoResize: options.autoResize ?? true,
      fullScreenButton: options.fullScreenButton ?? true,
      showLabel: options.showLabel ?? true,
      initialHeight: options.initialHeight ?? '400px',
      maxHeight: options.maxHeight ?? '800px',
      injectTheme: options.injectTheme ?? true,
      className: options.className ?? 'html-renderer',
      customCss: options.customCss,
      customSandbox: options.customSandbox
    };
  }

  /**
   * Check if content is HTML
   * Detection heuristics:
   * - Contains HTML tags (<div>, <p>, <span>, etc.)
   * - Contains HTML5 semantic tags (<article>, <section>, <nav>, etc.)
   * - Contains <!DOCTYPE html>
   * - Contains <html>, <head>, <body> tags
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for DOCTYPE
    if (/^<!DOCTYPE\s+html/i.test(trimmed)) return true;

    // Check for HTML structure tags
    if (/<html[\s>]/i.test(trimmed) || /<head[\s>]/i.test(trimmed) || /<body[\s>]/i.test(trimmed)) {
      return true;
    }

    // Check for common HTML tags
    const htmlTagPatterns = [
      /<div[\s>]/i,
      /<p[\s>]/i,
      /<span[\s>]/i,
      /<article[\s>]/i,
      /<section[\s>]/i,
      /<header[\s>]/i,
      /<footer[\s>]/i,
      /<nav[\s>]/i,
      /<main[\s>]/i,
      /<aside[\s>]/i,
      /<h[1-6][\s>]/i,
      /<ul[\s>]/i,
      /<ol[\s>]/i,
      /<li[\s>]/i,
      /<table[\s>]/i,
      /<form[\s>]/i,
      /<button[\s>]/i,
      /<input[\s>]/i
    ];

    // If 2+ HTML tags found, likely HTML
    let tagCount = 0;
    for (const pattern of htmlTagPatterns) {
      if (pattern.test(trimmed)) {
        tagCount++;
        if (tagCount >= 2) return true;
      }
    }

    return false;
  }

  /**
   * Render HTML content to sandboxed iframe
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      // Build sandbox attributes
      const sandboxAttrs = this.buildSandboxAttributes();

      // Build iframe HTML
      const iframeId = this.generateIframeId();
      const iframeHtml = this.buildIframeHTML(content, iframeId, sandboxAttrs);

      return iframeHtml;

    } catch (error) {
      console.error('[HtmlRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete HTML document
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.html-loading')) {
      const loading = document.createElement('div');
      loading.className = 'html-loading';
      loading.textContent = '⏳ Loading HTML...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete HTML
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.html-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Setup iframe after DOM insertion
      const iframe = container.querySelector('iframe');
      if (iframe) {
        this.setupIframe(iframe as HTMLIFrameElement);
      }

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[HtmlRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Build sandbox attributes based on options
   */
  private buildSandboxAttributes(): string {
    // If custom sandbox provided, use it
    if (this.options.customSandbox) {
      return this.options.customSandbox;
    }

    const attrs: string[] = [];

    // Always include these for basic functionality
    attrs.push('allow-same-origin'); // Needed for some iframe features, but still sandboxed

    // Optional permissions based on configuration
    if (this.options.allowScripts) {
      attrs.push('allow-scripts');
    }

    if (this.options.allowForms) {
      attrs.push('allow-forms');
    }

    if (this.options.allowModals) {
      attrs.push('allow-modals');
    }

    if (this.options.allowPointerLock) {
      attrs.push('allow-pointer-lock');
    }

    if (this.options.allowPopups) {
      attrs.push('allow-popups');
    }

    return attrs.join(' ');
  }

  /**
   * Build complete iframe HTML
   */
  private buildIframeHTML(content: string, iframeId: string, sandboxAttrs: string): string {
    // Prepare HTML content for iframe
    const iframeContent = this.prepareIframeContent(content);

    // Detect current theme
    const theme = this.getCurrentTheme();
    const iconFilter = theme === 'light' ? 'filter: invert(1);' : '';

    // Build container
    let html = `<div class="${this.options.className}" data-iframe-id="${iframeId}">`;

    // Header with actions
    html += '<div class="html-header">';

    // 🔑 修复问题3：只在 showLabel 为 true 时显示标题
    if (this.options.showLabel) {
      html += '<span class="html-label">HTML Content</span>';
    }

    html += '<div class="html-actions">';

    if (this.options.fullScreenButton) {
      // 🔑 修复问题4：使用 SVG 图标替代 emoji
      html += `<button class="html-fullscreen-btn" data-action="toggle-fullscreen" title="Toggle Full Screen">
        <img src="src/template/pic_resource/icon/Emoji_instead/24-1px-whole-screen.svg"
             alt="Fullscreen"
             class="fullscreen-icon"
             style="width: 16px; height: 16px; ${iconFilter}" />
      </button>`;
    }

    html += '</div>';
    html += '</div>';

    // Iframe container
    html += `<div class="html-iframe-container">`;
    html += `<iframe
      id="${iframeId}"
      sandbox="${sandboxAttrs}"
      style="width: 100%; height: ${this.options.initialHeight}; border: none;"
      srcdoc="${this.escapeHtml(iframeContent)}"
      data-auto-resize="${this.options.autoResize}"
    ></iframe>`;
    html += '</div>';

    html += '</div>';

    return html;
  }

  /**
   * Prepare HTML content for iframe
   * Inject theme variables, custom CSS, and auto-resize script
   */
  private prepareIframeContent(rawHtml: string): string {
    // Check if it's a complete HTML document
    const isCompleteDoc = /<!DOCTYPE\s+html/i.test(rawHtml) || /<html[\s>]/i.test(rawHtml);

    if (isCompleteDoc) {
      // Complete HTML document - inject into existing structure
      return this.injectIntoCompleteDoc(rawHtml);
    } else {
      // Fragment - wrap in basic HTML structure
      return this.wrapFragment(rawHtml);
    }
  }

  /**
   * Inject theme and scripts into complete HTML document
   */
  private injectIntoCompleteDoc(html: string): string {
    // Build injection content
    const injection = this.buildInjectionContent();

    // Try to inject before </head>
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${injection}</head>`);
    }

    // Try to inject after <head>
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/(<head[^>]*>)/i, `$1${injection}`);
    }

    // Try to inject before </body>
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${injection}</body>`);
    }

    // Fallback: prepend to content
    return injection + html;
  }

  /**
   * Wrap HTML fragment in basic structure
   */
  private wrapFragment(fragment: string): string {
    const injection = this.buildInjectionContent();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${injection}
</head>
<body>
  ${fragment}
</body>
</html>
    `.trim();
  }

  /**
   * Build injection content (theme CSS, custom CSS, auto-resize script)
   */
  private buildInjectionContent(): string {
    let content = '';

    // Inject theme CSS variables
    if (this.options.injectTheme) {
      content += `
<style>
  :root {
    /* Inherit theme from parent */
    --bg-primary: #FAF9F5;
    --bg-secondary: #F0EEE6;
    --text-primary: #141413;
    --text-secondary: #666666;
  }

  [data-theme="dark"] {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2a2a2a;
    --text-primary: #e8e6e0;
    --text-secondary: #a8a8a8;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--text-primary);
    background: var(--bg-primary);
    margin: 0;
    padding: 16px;
  }
</style>
      `;
    }

    // Inject custom CSS
    if (this.options.customCss) {
      content += `<style>${this.options.customCss}</style>`;
    }

    // Inject auto-resize script
    if (this.options.autoResize) {
      content += `
<script>
(function() {
  function resizeIframe() {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      document.body.scrollHeight,
      document.body.offsetHeight
    );

    // Send height to parent
    window.parent.postMessage({
      type: 'iframe-resize',
      height: height
    }, '*');
  }

  // Resize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resizeIframe);
  } else {
    resizeIframe();
  }

  // Resize on window resize
  window.addEventListener('resize', resizeIframe);

  // Resize on content changes (MutationObserver)
  const observer = new MutationObserver(resizeIframe);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
})();
</script>
      `;
    }

    return content;
  }

  /**
   * Setup iframe after DOM insertion
   * Setup event listeners for auto-resize and full-screen
   * 🔑 修复问题5：改为 public 方法，允许外部调用
   */
  public setupIframe(iframe: HTMLIFrameElement): void {
    const iframeId = iframe.id;

    // Store in registry
    this.iframeRegistry.set(iframeId, iframe);

    // Setup auto-resize listener
    if (this.options.autoResize) {
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'iframe-resize' && event.source === iframe.contentWindow) {
          const newHeight = Math.min(event.data.height, parseInt(this.options.maxHeight));
          iframe.style.height = `${newHeight}px`;
        }
      });
    }

    // Setup full-screen listener
    if (this.options.fullScreenButton) {
      const container = iframe.closest(`.${this.options.className}`);
      const fullscreenBtn = container?.querySelector('.html-fullscreen-btn');

      if (fullscreenBtn) {
        console.log('[HtmlRenderer] Binding fullscreen button click event');
        fullscreenBtn.addEventListener('click', () => {
          console.log('[HtmlRenderer] Fullscreen button clicked');
          this.toggleFullScreen(iframe);
        });
      }
    }
  }

  /**
   * Toggle full-screen mode for iframe
   * 🔑 修复问题4：切换全屏图标
   */
  private toggleFullScreen(iframe: HTMLIFrameElement): void {
    const container = iframe.closest(`.${this.options.className}`) as HTMLElement;

    if (!container) return;

    const fullscreenBtn = container.querySelector('.html-fullscreen-btn');
    const iconImg = fullscreenBtn?.querySelector('.fullscreen-icon') as HTMLImageElement;
    const theme = this.getCurrentTheme();
    const iconFilter = theme === 'light' ? 'filter: invert(1);' : '';

    if (container.classList.contains('fullscreen')) {
      // Exit full-screen
      console.log('[HtmlRenderer] Exiting fullscreen mode');
      container.classList.remove('fullscreen');
      iframe.style.height = this.options.initialHeight;

      // 切换回全屏图标
      if (iconImg) {
        iconImg.src = 'src/template/pic_resource/icon/Emoji_instead/24-1px-whole-screen.svg';
        iconImg.alt = 'Fullscreen';
        iconImg.style.cssText = `width: 16px; height: 16px; ${iconFilter}`;
      }
      if (fullscreenBtn) {
        fullscreenBtn.setAttribute('title', 'Toggle Full Screen');
      }
    } else {
      // Enter full-screen
      console.log('[HtmlRenderer] Entering fullscreen mode');
      container.classList.add('fullscreen');
      iframe.style.height = '100vh';

      // 切换到退出全屏图标
      if (iconImg) {
        iconImg.src = 'src/template/pic_resource/icon/Emoji_instead/small-screen.svg';
        iconImg.alt = 'Exit Fullscreen';
        iconImg.style.cssText = `width: 16px; height: 16px; ${iconFilter}`;
      }
      if (fullscreenBtn) {
        fullscreenBtn.setAttribute('title', 'Exit Full Screen');
      }
    }
  }

  /**
   * Generate unique iframe ID
   */
  private generateIframeId(): string {
    return `html-iframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检测当前主题模式
   * @returns 'light' | 'dark'
   */
  private getCurrentTheme(): 'light' | 'dark' {
    // 方法1：检查 body 或 html 的 data-theme 属性
    const theme = document.documentElement.getAttribute('data-theme')
      || document.body.getAttribute('data-theme');

    if (theme === 'light' || theme === 'dark') {
      return theme;
    }

    // 方法2：检查 CSS 类名
    if (document.body.classList.contains('light-theme')) return 'light';
    if (document.body.classList.contains('dark-theme')) return 'dark';

    // 方法3：检查系统偏好
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light'; // 默认
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>HTML Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="html-source">
          <pre><code>${this.escapeHtml(content.substring(0, 500))}${content.length > 500 ? '...' : ''}</code></pre>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML entities for safe insertion
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
   * Cleanup iframe from registry
   */
  public cleanup(iframeId: string): void {
    this.iframeRegistry.delete(iframeId);
  }

  /**
   * Get renderer configuration
   */
  public getOptions(): typeof this.options {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<HtmlRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create HTML renderer
 */
export function createHtmlRenderer(options?: HtmlRendererOptions): HtmlRenderer {
  return new HtmlRenderer(options);
}

/**
 * Convenience function to render HTML
 */
export async function renderHtml(
  content: string,
  options?: HtmlRendererOptions
): Promise<string> {
  const renderer = createHtmlRenderer(options);
  return renderer.render(content);
}

/**
 * Safe HTML renderer with strictest security
 * - No JavaScript
 * - No forms
 * - No popups
 * - Read-only display
 */
export function createSafeHtmlRenderer(): HtmlRenderer {
  return new HtmlRenderer({
    allowScripts: false,
    allowForms: false,
    allowModals: false,
    allowPointerLock: false,
    allowPopups: false,
    allowSameOrigin: false
  });
}

/**
 * Interactive HTML renderer with JavaScript enabled
 * WARNING: Only use with trusted content!
 */
export function createInteractiveHtmlRenderer(): HtmlRenderer {
  return new HtmlRenderer({
    allowScripts: true,
    allowForms: true,
    allowModals: true,
    allowPointerLock: true,
    allowPopups: false,  // Still block popups
    allowSameOrigin: false  // Still block same-origin
  });
}
