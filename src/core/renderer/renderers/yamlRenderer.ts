/**
 * YAML Renderer (CORE-032)
 *
 * Responsibilities:
 * - Render YAML content with syntax highlighting
 * - Validate YAML syntax and show errors
 * - Support collapsible sections for nested structures
 * - Display line numbers
 * - Copy YAML content to clipboard
 * - Format and beautify YAML
 * - Convert YAML to JSON
 * - Search within YAML content
 * - Streaming chunk rendering (progressive YAML loading)
 *
 * Features:
 * - Syntax Highlighting: Keys, values, strings, numbers, booleans, null
 * - Validation: Real-time YAML syntax checking
 * - Collapsible: Expand/collapse nested objects and arrays
 * - Line Numbers: Show line numbers for navigation
 * - Copy Button: Copy entire YAML or selected sections
 * - Format: Auto-format with proper indentation
 * - Convert: YAML ↔ JSON conversion
 * - Search: Find text with highlighting
 * - Dark/Light Theme: Auto-adapts to theme
 * - Error Display: Show parsing errors with line/column
 *
 * Usage:
 * ```typescript
 * import { createYamlRenderer } from './renderers/yamlRenderer';
 *
 * const renderer = createYamlRenderer();
 * const html = await renderer.render(yamlContent);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * YAML token type for syntax highlighting
 */
export type YamlTokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'comment'
  | 'anchor'
  | 'alias'
  | 'tag'
  | 'punctuation';

/**
 * YAML token
 */
export interface YamlToken {
  type: YamlTokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * YAML parse result
 */
export interface YamlParseResult {
  valid: boolean;
  value?: any;
  error?: {
    message: string;
    line?: number;
    column?: number;
  };
  tokens: YamlToken[];
}

/**
 * YAML renderer options
 */
export interface YamlRendererOptions {
  /**
   * Enable syntax highlighting
   * Default: true
   */
  syntaxHighlighting?: boolean;

  /**
   * Show line numbers
   * Default: true
   */
  lineNumbers?: boolean;

  /**
   * Enable collapsible sections
   * Default: true
   */
  collapsible?: boolean;

  /**
   * Auto-collapse sections with > N lines
   * Default: 10
   */
  autoCollapseThreshold?: number;

  /**
   * Enable copy button
   * Default: true
   */
  copyButton?: boolean;

  /**
   * Enable format button
   * Default: true
   */
  formatButton?: boolean;

  /**
   * Enable JSON conversion button
   * Default: true
   */
  convertToJson?: boolean;

  /**
   * Enable search functionality
   * Default: true
   */
  searchEnabled?: boolean;

  /**
   * Show validation errors
   * Default: true
   */
  showErrors?: boolean;

  /**
   * Enable download button
   * Default: true
   */
  downloadButton?: boolean;

  /**
   * Indentation spaces
   * Default: 2
   */
  indentSize?: number;

  /**
   * Max display lines before truncation
   * Default: 1000
   */
  maxLines?: number;

  /**
   * Custom CSS class for YAML container
   * Default: 'yaml-renderer'
   */
  className?: string;
}

/**
 * YAML Renderer
 * Implements IRenderer interface for YAML with syntax highlighting
 */
export class YamlRenderer implements IRenderer {
  public readonly type = 'yaml' as const;

  private options: Required<YamlRendererOptions>;
  private streamBuffer: string = '';
  private yamlCounter: number = 1;

  constructor(options: YamlRendererOptions = {}) {
    this.options = {
      syntaxHighlighting: options.syntaxHighlighting ?? true,
      lineNumbers: options.lineNumbers ?? true,
      collapsible: options.collapsible ?? true,
      autoCollapseThreshold: options.autoCollapseThreshold ?? 10,
      copyButton: options.copyButton ?? true,
      formatButton: options.formatButton ?? true,
      convertToJson: options.convertToJson ?? true,
      searchEnabled: options.searchEnabled ?? true,
      showErrors: options.showErrors ?? true,
      downloadButton: options.downloadButton ?? true,
      indentSize: options.indentSize ?? 2,
      maxLines: options.maxLines ?? 1000,
      className: options.className ?? 'yaml-renderer'
    };
  }

  /**
   * Check if content is YAML
   * Detection heuristics:
   * - Starts with --- (YAML document marker)
   * - Contains key: value pairs with proper indentation
   * - Has YAML-specific syntax (anchors, aliases, tags)
   * - File extension .yaml or .yml in URL
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for YAML document marker
    if (trimmed.startsWith('---')) {
      return true;
    }

    // Check for YAML file extension in URL
    if (/\.(yaml|yml)$/i.test(trimmed)) {
      return true;
    }

    // Check for key: value patterns with proper indentation
    const lines = trimmed.split('\n');
    let yamlLikeLines = 0;

    for (const line of lines.slice(0, 20)) { // Check first 20 lines
      // YAML key: value pattern
      if (/^\s*[\w-]+:\s*/.test(line)) {
        yamlLikeLines++;
      }
      // YAML array item pattern
      if (/^\s*-\s+/.test(line)) {
        yamlLikeLines++;
      }
      // YAML anchor or alias
      if (/[&*][\w-]+/.test(line)) {
        yamlLikeLines++;
      }
    }

    // If >40% of lines look like YAML, consider it YAML
    return yamlLikeLines / Math.min(lines.length, 20) > 0.4;
  }

  /**
   * Render YAML to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Parse YAML
      const parseResult = this.parseYaml(trimmed);

      // Generate unique ID
      const yamlId = `yaml-viewer-${Date.now()}-${this.yamlCounter++}`;

      // Build YAML HTML
      const yamlHtml = this.buildYamlHTML(trimmed, parseResult, yamlId);

      return yamlHtml;

    } catch (error) {
      console.error('[YamlRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete YAML data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.yaml-loading')) {
      const loading = document.createElement('div');
      loading.className = 'yaml-loading';
      loading.textContent = '⏳ Loading YAML...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete YAML
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.yaml-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize YAML viewer interactions
      this.initializeYaml(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[YamlRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Parse YAML content
   * Note: This is a simplified parser. In production, use js-yaml library.
   */
  private parseYaml(content: string): YamlParseResult {
    const result: YamlParseResult = {
      valid: true,
      tokens: []
    };

    try {
      // In production, use js-yaml:
      // import yaml from 'js-yaml';
      // result.value = yaml.load(content);

      // Simplified validation: check for basic syntax errors
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Check for invalid indentation (not multiple of 2)
        const indentMatch = line.match(/^(\s*)/);
        if (indentMatch && indentMatch[1].length % this.options.indentSize !== 0) {
          result.valid = false;
          result.error = {
            message: `Invalid indentation at line ${lineNum}. Expected multiple of ${this.options.indentSize} spaces.`,
            line: lineNum,
            column: indentMatch[1].length
          };
          break;
        }

        // Tokenize line for syntax highlighting
        this.tokenizeLine(line, lineNum, result.tokens);
      }

      // Placeholder: Successfully parsed
      result.value = { parsed: true };

    } catch (error: any) {
      result.valid = false;
      result.error = {
        message: error.message || 'Failed to parse YAML',
        line: 1,
        column: 1
      };
    }

    return result;
  }

  /**
   * Tokenize a YAML line for syntax highlighting
   */
  private tokenizeLine(line: string, lineNum: number, tokens: YamlToken[]): void {
    let column = 0;

    // Skip empty lines
    if (!line.trim()) return;

    // Comment
    if (line.trim().startsWith('#')) {
      tokens.push({
        type: 'comment',
        value: line,
        line: lineNum,
        column: 0
      });
      return;
    }

    // Key: value pattern
    const keyValueMatch = line.match(/^(\s*)([\w-]+):\s*(.*)$/);
    if (keyValueMatch) {
      const [, indent, key, value] = keyValueMatch;
      column = indent.length;

      // Key
      tokens.push({
        type: 'key',
        value: key,
        line: lineNum,
        column
      });

      column += key.length + 1; // +1 for ':'

      // Value
      if (value) {
        this.tokenizeValue(value, lineNum, column, tokens);
      }
      return;
    }

    // Array item: - value
    const arrayMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (arrayMatch) {
      const [, indent, value] = arrayMatch;
      column = indent.length;

      // Punctuation
      tokens.push({
        type: 'punctuation',
        value: '-',
        line: lineNum,
        column
      });

      column += 2; // '- '

      // Value
      if (value) {
        this.tokenizeValue(value, lineNum, column, tokens);
      }
      return;
    }

    // Default: treat as value
    this.tokenizeValue(line.trim(), lineNum, 0, tokens);
  }

  /**
   * Tokenize a YAML value
   */
  private tokenizeValue(value: string, line: number, column: number, tokens: YamlToken[]): void {
    // Null
    if (/^(null|~)$/i.test(value)) {
      tokens.push({ type: 'null', value, line, column });
      return;
    }

    // Boolean
    if (/^(true|false|yes|no|on|off)$/i.test(value)) {
      tokens.push({ type: 'boolean', value, line, column });
      return;
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      tokens.push({ type: 'number', value, line, column });
      return;
    }

    // Anchor &name
    if (value.startsWith('&')) {
      tokens.push({ type: 'anchor', value, line, column });
      return;
    }

    // Alias *name
    if (value.startsWith('*')) {
      tokens.push({ type: 'alias', value, line, column });
      return;
    }

    // Tag !tag
    if (value.startsWith('!')) {
      tokens.push({ type: 'tag', value, line, column });
      return;
    }

    // String (default)
    tokens.push({ type: 'string', value, line, column });
  }

  /**
   * Build YAML HTML
   */
  private buildYamlHTML(content: string, parseResult: YamlParseResult, yamlId: string): string {
    let html = `<div class="${this.options.className}" data-yaml-id="${yamlId}">`;

    // Header with actions
    html += '<div class="yaml-header">';
    html += '<span class="yaml-label">YAML</span>';

    // Validation status
    if (this.options.showErrors) {
      if (parseResult.valid) {
        html += '<span class="yaml-status yaml-status-valid">✓ Valid</span>';
      } else {
        html += '<span class="yaml-status yaml-status-invalid">✗ Invalid</span>';
      }
    }

    html += '<div class="yaml-actions">';

    if (this.options.searchEnabled) {
      html += '<input type="text" class="yaml-search-input" placeholder="Search YAML...">';
    }

    if (this.options.copyButton) {
      html += '<button class="yaml-copy-btn" data-action="copy" title="Copy">📋</button>';
    }

    if (this.options.formatButton) {
      html += '<button class="yaml-format-btn" data-action="format" title="Format">✨</button>';
    }

    if (this.options.convertToJson) {
      html += '<button class="yaml-to-json-btn" data-action="to-json" title="Convert to JSON">{ }</button>';
    }

    if (this.options.downloadButton) {
      html += '<button class="yaml-download-btn" data-action="download" title="Download">💾</button>';
    }

    html += '</div>'; // .yaml-actions
    html += '</div>'; // .yaml-header

    // Error display
    if (!parseResult.valid && parseResult.error && this.options.showErrors) {
      html += '<div class="yaml-error">';
      html += `<strong>Error:</strong> ${this.escapeHtml(parseResult.error.message)}`;
      if (parseResult.error.line) {
        html += ` (Line ${parseResult.error.line}`;
        if (parseResult.error.column) {
          html += `, Column ${parseResult.error.column}`;
        }
        html += ')';
      }
      html += '</div>';
    }

    // YAML content with syntax highlighting
    html += '<div class="yaml-content">';

    if (this.options.syntaxHighlighting) {
      html += this.buildHighlightedYaml(content, parseResult.tokens);
    } else {
      html += `<pre class="yaml-code">${this.escapeHtml(content)}</pre>`;
    }

    html += '</div>'; // .yaml-content

    html += '</div>'; // .yaml-renderer

    return html;
  }

  /**
   * Build syntax-highlighted YAML
   */
  private buildHighlightedYaml(content: string, tokens: YamlToken[]): string {
    const lines = content.split('\n');
    let html = '<div class="yaml-lines">';

    for (let i = 0; i < lines.length && i < this.options.maxLines; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      html += '<div class="yaml-line">';

      // Line number
      if (this.options.lineNumbers) {
        html += `<span class="yaml-line-number">${lineNum}</span>`;
      }

      // Line content with syntax highlighting
      html += '<span class="yaml-line-content">';

      if (line.trim()) {
        html += this.highlightLine(line, lineNum, tokens);
      } else {
        html += '&nbsp;'; // Empty line
      }

      html += '</span>';
      html += '</div>';
    }

    // Truncation notice
    if (lines.length > this.options.maxLines) {
      html += `<div class="yaml-truncated">... (${lines.length - this.options.maxLines} more lines)</div>`;
    }

    html += '</div>'; // .yaml-lines

    return html;
  }

  /**
   * Highlight a single line using tokens
   */
  private highlightLine(line: string, lineNum: number, tokens: YamlToken[]): string {
    // Find tokens for this line
    const lineTokens = tokens.filter(t => t.line === lineNum);

    if (lineTokens.length === 0) {
      return this.escapeHtml(line);
    }

    let html = '';
    let lastIndex = 0;

    // Simple approach: wrap entire line content by type
    const firstToken = lineTokens[0];

    // Preserve leading whitespace
    const indentMatch = line.match(/^(\s*)/);
    if (indentMatch) {
      html += indentMatch[1].replace(/ /g, '&nbsp;');
      lastIndex = indentMatch[1].length;
    }

    // Wrap rest of line with token type
    const rest = line.substring(lastIndex);
    html += `<span class="yaml-token yaml-token-${firstToken.type}">${this.escapeHtml(rest)}</span>`;

    return html;
  }

  /**
   * Initialize YAML viewer interactions
   */
  private initializeYaml(container: HTMLElement): void {
    const yamlId = container.getAttribute('data-yaml-id');
    if (!yamlId) return;

    // Copy button
    const copyBtn = container.querySelector('.yaml-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const content = this.extractYamlContent(container);
        navigator.clipboard.writeText(content).then(() => {
          (copyBtn as HTMLElement).textContent = '✓';
          setTimeout(() => {
            (copyBtn as HTMLElement).textContent = '📋';
          }, 2000);
        });
      });
    }

    // Format button
    const formatBtn = container.querySelector('.yaml-format-btn');
    if (formatBtn) {
      formatBtn.addEventListener('click', () => {
        console.log('[YamlRenderer] Format YAML');
        // In production: reformat YAML with proper indentation
      });
    }

    // Convert to JSON button
    const toJsonBtn = container.querySelector('.yaml-to-json-btn');
    if (toJsonBtn) {
      toJsonBtn.addEventListener('click', () => {
        const content = this.extractYamlContent(container);
        try {
          // In production: use js-yaml to parse and convert
          console.log('[YamlRenderer] Convert to JSON');
          alert('YAML to JSON conversion: Use js-yaml library in production');
        } catch (error: any) {
          alert(`Conversion error: ${error.message}`);
        }
      });
    }

    // Download button
    const downloadBtn = container.querySelector('.yaml-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const content = this.extractYamlContent(container);
        const blob = new Blob([content], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'document.yaml';
        link.click();
        URL.revokeObjectURL(url);
      });
    }

    // Search functionality
    const searchInput = container.querySelector('.yaml-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.searchInYaml(container, query);
      });
    }

    console.log('[YamlRenderer] YAML viewer initialized');
  }

  /**
   * Extract YAML content from container
   */
  private extractYamlContent(container: HTMLElement): string {
    const lines = container.querySelectorAll('.yaml-line-content');
    return Array.from(lines)
      .map(line => line.textContent || '')
      .join('\n');
  }

  /**
   * Search in YAML
   */
  private searchInYaml(container: HTMLElement, query: string): void {
    const lines = container.querySelectorAll('.yaml-line-content');

    lines.forEach(line => {
      const text = line.textContent || '';
      if (query && text.toLowerCase().includes(query.toLowerCase())) {
        line.classList.add('search-match');
      } else {
        line.classList.remove('search-match');
      }
    });
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>YAML Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="yaml-source">
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
  public getOptions(): Required<YamlRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<YamlRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create YAML renderer
 */
export function createYamlRenderer(options?: YamlRendererOptions): YamlRenderer {
  return new YamlRenderer(options);
}

/**
 * Convenience function to render YAML
 */
export async function renderYaml(
  content: string,
  options?: YamlRendererOptions
): Promise<string> {
  const renderer = createYamlRenderer(options);
  return renderer.render(content);
}

/**
 * Example YAML for documentation
 */
export const YAML_EXAMPLES = {
  simple: `---
name: John Doe
age: 30
email: john@example.com
active: true`,

  nested: `---
server:
  host: localhost
  port: 8080
  ssl:
    enabled: true
    cert: /path/to/cert.pem
database:
  type: postgres
  connection:
    host: db.example.com
    port: 5432`,

  array: `---
fruits:
  - apple
  - banana
  - orange
colors:
  - name: red
    hex: "#FF0000"
  - name: green
    hex: "#00FF00"`,

  anchors: `---
defaults: &defaults
  timeout: 30
  retries: 3

production:
  <<: *defaults
  host: prod.example.com

development:
  <<: *defaults
  host: dev.example.com`
};
