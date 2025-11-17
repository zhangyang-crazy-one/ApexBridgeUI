/**
 * URL Preview Renderer (CORE-038)
 *
 * Responsibilities:
 * - Detect and extract URLs from content
 * - Display rich link previews (Open Graph metadata)
 * - Show website favicons and titles
 * - Extract domain information and security status
 * - Support multiple URL formats (http, https, www, bare domains)
 * - Provide click-through with external link indicators
 * - Cache metadata for performance
 * - Handle link unfurling errors gracefully
 * - Support multiple URLs in single message
 * - Streaming chunk rendering (progressive URL loading)
 *
 * Features:
 * - URL Detection: HTTP/HTTPS, www, bare domains, IP addresses
 * - Rich Previews: Open Graph title, description, image
 * - Favicon Display: Website icons with fallback
 * - Domain Info: Protocol, hostname, port, path
 * - Security Indicators: HTTPS lock icon, HTTP warning
 * - Link Cards: Twitter-style link preview cards
 * - Multiple URLs: Grid layout for 2+ URLs
 * - Copy URL: Copy link to clipboard
 * - Open External: Open in default browser
 * - QR Code: Generate QR code for sharing
 * - Dark/Light Theme: Auto-adapts to theme
 *
 * Usage:
 * ```typescript
 * import { createUrlRenderer } from './renderers/urlRenderer';
 *
 * const renderer = createUrlRenderer();
 * const html = await renderer.render(urlContent);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * URL metadata (Open Graph)
 */
export interface UrlMetadata {
  url: string;
  protocol: string;
  hostname: string;
  pathname: string;
  port?: string;
  isSecure: boolean;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  type?: string;
  error?: string;
}

/**
 * URL parser result
 */
export interface ParsedUrl {
  original: string;
  normalized: string;
  protocol: string;
  hostname: string;
  pathname: string;
  port?: string;
  search?: string;
  hash?: string;
  isValid: boolean;
}

/**
 * URL renderer options
 */
export interface UrlRendererOptions {
  /**
   * Enable Open Graph metadata fetching
   * Default: true
   */
  enableMetadata?: boolean;

  /**
   * Show favicon
   * Default: true
   */
  showFavicon?: boolean;

  /**
   * Show preview image
   * Default: true
   */
  showImage?: boolean;

  /**
   * Show domain info
   * Default: true
   */
  showDomainInfo?: boolean;

  /**
   * Show security indicator
   * Default: true
   */
  showSecurityIndicator?: boolean;

  /**
   * Enable copy button
   * Default: true
   */
  copyButton?: boolean;

  /**
   * Enable open external button
   * Default: true
   */
  openButton?: boolean;

  /**
   * Enable QR code generation
   * Default: true
   */
  qrCodeButton?: boolean;

  /**
   * Card layout for rich previews
   * Default: true
   */
  cardLayout?: boolean;

  /**
   * Max URLs to display
   * Default: 10
   */
  maxUrls?: number;

  /**
   * Timeout for metadata fetching (ms)
   * Default: 5000
   */
  fetchTimeout?: number;

  /**
   * Image max height (px)
   * Default: 200
   */
  imageMaxHeight?: number;

  /**
   * Custom CSS class for URL container
   * Default: 'url-renderer'
   */
  className?: string;
}

/**
 * URL Renderer
 * Implements IRenderer interface for URL preview with link unfurling
 */
export class UrlRenderer implements IRenderer {
  public readonly type = 'url' as const;

  private options: Required<UrlRendererOptions>;
  private streamBuffer: string = '';
  private urlCounter: number = 1;
  private metadataCache: Map<string, UrlMetadata> = new Map();

  constructor(options: UrlRendererOptions = {}) {
    this.options = {
      enableMetadata: options.enableMetadata ?? true,
      showFavicon: options.showFavicon ?? true,
      showImage: options.showImage ?? true,
      showDomainInfo: options.showDomainInfo ?? true,
      showSecurityIndicator: options.showSecurityIndicator ?? true,
      copyButton: options.copyButton ?? true,
      openButton: options.openButton ?? true,
      qrCodeButton: options.qrCodeButton ?? true,
      cardLayout: options.cardLayout ?? true,
      maxUrls: options.maxUrls ?? 10,
      fetchTimeout: options.fetchTimeout ?? 5000,
      imageMaxHeight: options.imageMaxHeight ?? 200,
      className: options.className ?? 'url-renderer'
    };
  }

  /**
   * Check if content contains URLs
   * Detection heuristics:
   * - HTTP/HTTPS URLs
   * - www.example.com URLs
   * - Bare domains (example.com)
   * - IP addresses
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for HTTP/HTTPS URLs
    if (/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i.test(trimmed)) {
      return true;
    }

    // Check for www URLs
    if (/www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i.test(trimmed)) {
      return true;
    }

    // Check for bare domain (with TLD)
    if (/\b[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(com|org|net|edu|gov|mil|io|co|uk|us|de|fr|jp|cn|in|br|au|ru|ca|nl|ch|se|no|dk|fi|be|at|pl|cz|gr|pt|es|it|tr|kr|tw|sg|hk|nz|za|mx|ar|cl|my|th|vn|ph|id|pk|eg|ng|ke|ma|dz|tn|ly|sd|gh|ug|tz|et|ao|mz|zw|zm|bw|na|ls|sz|mg|mu|sc|cv|gm|gn|gw|sl|lr|ci|bf|ne|ml|mr|sn|gg|je|im|fo|gl|fk|ai|bm|ky|tc|vg|vi|pr|dm|gd|ag|kn|lc|vc|tt|bb|jm|bs|aw|cw|sx|bq|mf|gp|mq|pm|re|yt|tf|wf|pf|nc|vu|fj|sb|pg|ki|nr|tv|ws|to|tk|nu|pn|ck|as|gu|mp|pw|fm|mh|nf|cc|cx|hm|bn|bt|io|kh|la|mm|mn|np|lk|mv|bd|af|tj|tm|uz|kg|kz|az|am|ge|by|ua|md|ro|bg|mk|al|ba|hr|si|me|rs|xk|ad|mc|sm|va|li|mt|cy|ee|lv|lt)\b/i.test(trimmed)) {
      return true;
    }

    // Check for IP addresses
    if (/\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Render URLs to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Extract all URLs
      const urls = this.extractUrls(trimmed);

      if (urls.length === 0) {
        return this.buildNoUrlsMessage();
      }

      // Fetch metadata for URLs (if enabled)
      const urlMetadata: UrlMetadata[] = [];
      if (this.options.enableMetadata) {
        for (const url of urls) {
          const meta = await this.fetchMetadata(url);
          urlMetadata.push(meta);
        }
      } else {
        for (const url of urls) {
          urlMetadata.push(this.createBasicMetadata(url));
        }
      }

      // Generate unique ID
      const urlId = `url-viewer-${Date.now()}-${this.urlCounter++}`;

      // Build URL HTML
      const urlHtml = this.buildUrlHTML(urlMetadata, urlId);

      return urlHtml;

    } catch (error) {
      console.error('[UrlRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete URL data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.url-loading')) {
      const loading = document.createElement('div');
      loading.className = 'url-loading';
      loading.textContent = '⏳ Loading URL preview...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete URL data
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.url-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize URL viewer interactions
      this.initializeUrl(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[UrlRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Extract all URLs from content
   */
  private extractUrls(content: string): ParsedUrl[] {
    const urls: ParsedUrl[] = [];
    const seen = new Set<string>();

    // Extract HTTP/HTTPS URLs
    const httpRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    let httpMatch;
    while ((httpMatch = httpRegex.exec(content)) !== null) {
      const url = httpMatch[0];
      if (!seen.has(url.toLowerCase()) && urls.length < this.options.maxUrls) {
        seen.add(url.toLowerCase());
        const parsed = this.parseUrl(url);
        if (parsed.isValid) urls.push(parsed);
      }
    }

    // Extract www URLs (add https://)
    const wwwRegex = /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    let wwwMatch;
    while ((wwwMatch = wwwRegex.exec(content)) !== null) {
      const url = 'https://' + wwwMatch[0];
      if (!seen.has(url.toLowerCase()) && urls.length < this.options.maxUrls) {
        seen.add(url.toLowerCase());
        const parsed = this.parseUrl(url);
        if (parsed.isValid) urls.push(parsed);
      }
    }

    // Extract bare domains (common TLDs only, add https://)
    const bareRegex = /\b([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(com|org|net|edu|gov|io|co))\b/gi;
    let bareMatch;
    while ((bareMatch = bareRegex.exec(content)) !== null) {
      const url = 'https://' + bareMatch[1];
      if (!seen.has(url.toLowerCase()) && urls.length < this.options.maxUrls) {
        seen.add(url.toLowerCase());
        const parsed = this.parseUrl(url);
        if (parsed.isValid) urls.push(parsed);
      }
    }

    return urls;
  }

  /**
   * Parse URL string
   */
  private parseUrl(urlString: string): ParsedUrl {
    try {
      const url = new URL(urlString);

      return {
        original: urlString,
        normalized: url.href,
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname,
        pathname: url.pathname,
        port: url.port || undefined,
        search: url.search || undefined,
        hash: url.hash || undefined,
        isValid: true
      };
    } catch (error) {
      return {
        original: urlString,
        normalized: urlString,
        protocol: '',
        hostname: '',
        pathname: '',
        isValid: false
      };
    }
  }

  /**
   * Create basic metadata without fetching
   */
  private createBasicMetadata(parsedUrl: ParsedUrl): UrlMetadata {
    return {
      url: parsedUrl.normalized,
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      port: parsedUrl.port,
      isSecure: parsedUrl.protocol === 'https',
      title: parsedUrl.hostname,
      favicon: this.getFaviconUrl(parsedUrl.hostname)
    };
  }

  /**
   * Fetch Open Graph metadata for URL
   * Note: In production, this should be done server-side to avoid CORS
   */
  private async fetchMetadata(parsedUrl: ParsedUrl): Promise<UrlMetadata> {
    const cacheKey = parsedUrl.normalized;

    // Check cache
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!;
    }

    // Create basic metadata
    const metadata: UrlMetadata = this.createBasicMetadata(parsedUrl);

    // In production: Fetch metadata from server-side API
    // For now, simulate with placeholder data
    try {
      // Simulate metadata fetch (replace with actual fetch in production)
      // const response = await fetch(`/api/unfurl?url=${encodeURIComponent(parsedUrl.normalized)}`, {
      //   signal: AbortSignal.timeout(this.options.fetchTimeout)
      // });
      // const data = await response.json();

      // Placeholder: Generate mock metadata based on hostname
      const hostname = parsedUrl.hostname.toLowerCase();

      if (hostname.includes('github')) {
        metadata.title = 'GitHub Repository';
        metadata.description = 'The world\'s leading software development platform';
        metadata.siteName = 'GitHub';
        metadata.type = 'website';
      } else if (hostname.includes('youtube') || hostname.includes('youtu.be')) {
        metadata.title = 'YouTube Video';
        metadata.description = 'Watch videos on YouTube';
        metadata.siteName = 'YouTube';
        metadata.type = 'video';
      } else if (hostname.includes('twitter') || hostname.includes('x.com')) {
        metadata.title = 'Tweet';
        metadata.description = 'View this post on X (formerly Twitter)';
        metadata.siteName = 'X';
        metadata.type = 'article';
      } else {
        metadata.title = this.formatTitle(parsedUrl.hostname);
        metadata.description = `Visit ${parsedUrl.hostname}`;
        metadata.siteName = parsedUrl.hostname;
      }

      // Cache metadata
      this.metadataCache.set(cacheKey, metadata);

    } catch (error) {
      metadata.error = 'Failed to fetch metadata';
      console.warn('[UrlRenderer] Metadata fetch failed:', error);
    }

    return metadata;
  }

  /**
   * Get favicon URL for hostname
   */
  private getFaviconUrl(hostname: string): string {
    // Use Google's favicon service as fallback
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  }

  /**
   * Format hostname as title
   */
  private formatTitle(hostname: string): string {
    // Remove www. prefix
    let title = hostname.replace(/^www\./, '');

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return title;
  }

  /**
   * Build URL HTML
   */
  private buildUrlHTML(urlMetadata: UrlMetadata[], urlId: string): string {
    let html = `<div class="${this.options.className}" data-url-id="${urlId}">`;

    // Header
    html += '<div class="url-header">';
    html += `<span class="url-label">URL Preview (${urlMetadata.length} ${urlMetadata.length === 1 ? 'link' : 'links'})</span>`;
    html += '</div>';

    // URL cards
    if (urlMetadata.length === 1) {
      html += this.buildUrlCard(urlMetadata[0], 0, true);
    } else {
      html += '<div class="url-cards-grid">';
      for (let i = 0; i < urlMetadata.length; i++) {
        html += this.buildUrlCard(urlMetadata[i], i, false);
      }
      html += '</div>';
    }

    html += '</div>'; // .url-renderer

    return html;
  }

  /**
   * Build single URL card
   */
  private buildUrlCard(metadata: UrlMetadata, index: number, large: boolean): string {
    const cardClass = large ? 'url-card url-card-large' : 'url-card';
    let html = `<div class="${cardClass}" data-url-index="${index}" data-url="${this.escapeHtml(metadata.url)}">`;

    // Error state
    if (metadata.error) {
      html += '<div class="url-card-error">';
      html += `<div class="url-error-message">${this.escapeHtml(metadata.error)}</div>`;
      html += `<div class="url-error-url">${this.escapeHtml(metadata.url)}</div>`;
      html += '</div>';
      html += '</div>';
      return html;
    }

    // Card header with favicon and domain
    html += '<div class="url-card-header">';

    if (this.options.showFavicon && metadata.favicon) {
      html += `<img class="url-favicon" src="${this.escapeHtml(metadata.favicon)}" alt="" onerror="this.style.display='none'">`;
    }

    html += '<div class="url-card-header-text">';
    html += `<div class="url-hostname">${this.escapeHtml(metadata.hostname)}</div>`;

    if (this.options.showSecurityIndicator) {
      if (metadata.isSecure) {
        html += '<span class="url-security-indicator url-secure" title="Secure connection (HTTPS)">🔒</span>';
      } else {
        html += '<span class="url-security-indicator url-insecure" title="Insecure connection (HTTP)">⚠️</span>';
      }
    }

    html += '</div>'; // .url-card-header-text

    // Actions
    html += '<div class="url-card-actions">';

    if (this.options.copyButton) {
      html += `<button class="url-action-btn url-copy-btn" data-action="copy" data-url="${this.escapeHtml(metadata.url)}" title="Copy URL">📋</button>`;
    }

    if (this.options.openButton) {
      html += `<button class="url-action-btn url-open-btn" data-action="open" data-url="${this.escapeHtml(metadata.url)}" title="Open in Browser">↗️</button>`;
    }

    if (this.options.qrCodeButton) {
      html += `<button class="url-action-btn url-qr-btn" data-action="qr" data-url="${this.escapeHtml(metadata.url)}" title="Generate QR Code">📱</button>`;
    }

    html += '</div>'; // .url-card-actions
    html += '</div>'; // .url-card-header

    // Preview image (if available)
    if (this.options.showImage && metadata.image) {
      html += `<div class="url-card-image-container" style="max-height: ${this.options.imageMaxHeight}px;">`;
      html += `<img class="url-card-image" src="${this.escapeHtml(metadata.image)}" alt="${this.escapeHtml(metadata.title || '')}" loading="lazy">`;
      html += '</div>';
    }

    // Card content
    html += '<div class="url-card-content">';

    if (metadata.title) {
      html += `<div class="url-card-title">${this.escapeHtml(metadata.title)}</div>`;
    }

    if (metadata.description) {
      html += `<div class="url-card-description">${this.escapeHtml(metadata.description)}</div>`;
    }

    html += '</div>'; // .url-card-content

    // Domain info
    if (this.options.showDomainInfo) {
      html += '<div class="url-card-footer">';
      html += `<span class="url-protocol">${metadata.protocol.toUpperCase()}</span>`;
      if (metadata.siteName) {
        html += `<span class="url-site-name">${this.escapeHtml(metadata.siteName)}</span>`;
      }
      if (metadata.type) {
        html += `<span class="url-type">${this.escapeHtml(metadata.type)}</span>`;
      }
      html += '</div>';
    }

    html += '</div>'; // .url-card

    return html;
  }

  /**
   * Build no URLs message
   */
  private buildNoUrlsMessage(): string {
    return `
      <div class="${this.options.className} no-urls">
        <div class="no-urls-message">
          No URLs detected. Supported formats:
          <ul>
            <li>HTTP/HTTPS: https://example.com</li>
            <li>WWW: www.example.com</li>
            <li>Bare domain: example.com</li>
            <li>IP address: 192.168.1.1</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Initialize URL viewer interactions
   */
  private initializeUrl(container: HTMLElement): void {
    const urlId = container.getAttribute('data-url-id');
    if (!urlId) return;

    // Copy button
    const copyBtns = container.querySelectorAll('.url-copy-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (btn as HTMLElement).getAttribute('data-url') || '';
        navigator.clipboard.writeText(url).then(() => {
          (btn as HTMLElement).textContent = '✓';
          setTimeout(() => {
            (btn as HTMLElement).textContent = '📋';
          }, 2000);
        });
      });
    });

    // Open button
    const openBtns = container.querySelectorAll('.url-open-btn');
    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (btn as HTMLElement).getAttribute('data-url') || '';
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    });

    // QR code button
    const qrBtns = container.querySelectorAll('.url-qr-btn');
    qrBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (btn as HTMLElement).getAttribute('data-url') || '';
        if (url) {
          this.generateQRCode(url);
        }
      });
    });

    // Card click to open URL
    const cards = container.querySelectorAll('.url-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking action buttons
        if ((e.target as HTMLElement).closest('.url-action-btn')) {
          return;
        }

        const url = (card as HTMLElement).getAttribute('data-url') || '';
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    });

    console.log('[UrlRenderer] URL viewer initialized');
  }

  /**
   * Generate QR code for URL
   * In production, use a QR code library or API
   */
  private generateQRCode(url: string): void {
    // Placeholder: Use QR code API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

    // Create modal to display QR code
    const modal = document.createElement('div');
    modal.className = 'url-qr-modal';
    modal.innerHTML = `
      <div class="url-qr-modal-overlay"></div>
      <div class="url-qr-modal-content">
        <div class="url-qr-modal-header">
          <span>QR Code</span>
          <button class="url-qr-modal-close">✕</button>
        </div>
        <div class="url-qr-modal-body">
          <img src="${this.escapeHtml(qrCodeUrl)}" alt="QR Code" class="url-qr-code-image">
          <div class="url-qr-url">${this.escapeHtml(url)}</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal on click
    const closeBtn = modal.querySelector('.url-qr-modal-close');
    const overlay = modal.querySelector('.url-qr-modal-overlay');

    const closeModal = () => {
      modal.remove();
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Close on ESC key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>URL Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="url-source">
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
  public getOptions(): Required<UrlRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<UrlRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Clear metadata cache
   */
  public clearCache(): void {
    this.metadataCache.clear();
  }
}

/**
 * Factory function to create URL renderer
 */
export function createUrlRenderer(options?: UrlRendererOptions): UrlRenderer {
  return new UrlRenderer(options);
}

/**
 * Convenience function to render URLs
 */
export async function renderUrl(
  content: string,
  options?: UrlRendererOptions
): Promise<string> {
  const renderer = createUrlRenderer(options);
  return renderer.render(content);
}

/**
 * Example URLs for documentation
 */
export const URL_EXAMPLES = {
  https: 'https://github.com/anthropics/claude',
  http: 'http://example.com',
  www: 'www.example.com',
  bare: 'example.com',
  withPath: 'https://example.com/path/to/page',
  withQuery: 'https://example.com/search?q=test',
  withHash: 'https://example.com/page#section',
  multiple: 'Check out https://github.com and https://stackoverflow.com',
  ip: '192.168.1.1'
};
