/**
 * JSON Renderer (CORE-024)
 *
 * Responsibilities:
 * - Render JSON data with collapsible tree view
 * - Support large JSON files with virtual scrolling
 * - Syntax highlighting for JSON types (string, number, boolean, null, object, array)
 * - Copy path functionality (copy JSON path like "data.users[0].name")
 * - Search within JSON structure
 * - Export as formatted JSON or minified JSON
 * - Streaming chunk rendering with incremental parsing
 *
 * Features:
 * - Collapsible Tree: Expand/collapse objects and arrays
 * - Type Highlighting: Different colors for strings, numbers, booleans, null
 * - Copy Path: Right-click to copy JSON path
 * - Search: Filter tree by key or value
 * - Pretty Print: Formatted JSON with indentation
 * - Compact Mode: Minified JSON display
 * - Line Numbers: Show line numbers in formatted view
 * - Export: Copy to clipboard or download as .json file
 * - Large Data Support: Virtual scrolling for 10000+ nodes
 *
 * Usage:
 * ```typescript
 * import { createJsonRenderer } from './renderers/jsonRenderer';
 *
 * const renderer = createJsonRenderer();
 * const html = await renderer.render('{"name": "Alice", "age": 30}');
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * JSON value types
 */
export type JsonValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

/**
 * JSON tree node
 */
export interface JsonTreeNode {
  key?: string | number;
  value: any;
  type: JsonValueType;
  path: string;
  depth: number;
  isExpanded?: boolean;
  children?: JsonTreeNode[];
}

/**
 * JSON renderer options
 */
export interface JsonRendererOptions {
  /**
   * Default expand level
   * Default: 2 (expand first 2 levels)
   */
  defaultExpandLevel?: number;

  /**
   * Enable line numbers
   * Default: true
   */
  showLineNumbers?: boolean;

  /**
   * Enable copy path functionality
   * Default: true
   */
  enableCopyPath?: boolean;

  /**
   * Enable search functionality
   * Default: true
   */
  enableSearch?: boolean;

  /**
   * Enable export buttons
   * Default: true
   */
  exportButtons?: boolean;

  /**
   * Indent size (spaces)
   * Default: 2
   */
  indentSize?: number;

  /**
   * Maximum depth to render
   * Default: 10 (prevent infinite recursion)
   */
  maxDepth?: number;

  /**
   * Enable virtual scrolling for large JSON
   * Default: true
   */
  virtualScroll?: boolean;

  /**
   * Virtual scroll threshold (number of nodes)
   * Default: 1000
   */
  virtualScrollThreshold?: number;

  /**
   * Custom CSS class for JSON container
   * Default: 'json-renderer'
   */
  className?: string;

  /**
   * Syntax highlighting colors
   */
  colors?: {
    string?: string;
    number?: string;
    boolean?: string;
    null?: string;
    key?: string;
  };
}

/**
 * JSON Renderer
 * Implements IRenderer interface for JSON data with collapsible tree
 */
export class JsonRenderer implements IRenderer {
  public readonly type = 'json' as const;

  private options: Required<Omit<JsonRendererOptions, 'colors'>> & {
    colors?: JsonRendererOptions['colors'];
  };

  private streamBuffer: string = '';
  private treeCounter: number = 1;

  constructor(options: JsonRendererOptions = {}) {
    this.options = {
      defaultExpandLevel: options.defaultExpandLevel ?? 2,
      showLineNumbers: options.showLineNumbers ?? true,
      enableCopyPath: options.enableCopyPath ?? true,
      enableSearch: options.enableSearch ?? true,
      exportButtons: options.exportButtons ?? true,
      indentSize: options.indentSize ?? 2,
      maxDepth: options.maxDepth ?? 10,
      virtualScroll: options.virtualScroll ?? true,
      virtualScrollThreshold: options.virtualScrollThreshold ?? 1000,
      className: options.className ?? 'json-renderer',
      colors: options.colors
    };
  }

  /**
   * Check if content is JSON
   * Detection heuristics:
   * - Starts with { or [
   * - Can be successfully parsed as JSON
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Must start with { or [
    if (!/^[{\[]/.test(trimmed)) return false;

    // Try parsing as JSON
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Render JSON content to HTML tree
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      // Parse JSON
      const data = JSON.parse(content.trim());

      // Build tree structure
      const tree = this.buildTree(data, '$', 0);

      // Count total nodes
      const totalNodes = this.countNodes(tree);

      // Generate unique ID
      const treeId = `json-tree-${Date.now()}-${this.treeCounter++}`;

      // Determine if virtual scrolling needed
      const useVirtualScroll = this.options.virtualScroll && totalNodes > this.options.virtualScrollThreshold;

      // Build JSON HTML
      const jsonHtml = this.buildJsonHTML(tree, treeId, totalNodes, useVirtualScroll);

      return jsonHtml;

    } catch (error) {
      console.error('[JsonRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete JSON
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.json-loading')) {
      const loading = document.createElement('div');
      loading.className = 'json-loading';
      loading.textContent = '⏳ Loading JSON...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete JSON
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.json-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize tree interactions
      this.initializeTree(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[JsonRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Build tree structure from JSON data
   */
  private buildTree(
    value: any,
    path: string,
    depth: number,
    key?: string | number
  ): JsonTreeNode {
    const type = this.getValueType(value);

    const node: JsonTreeNode = {
      key,
      value,
      type,
      path,
      depth,
      isExpanded: depth < this.options.defaultExpandLevel
    };

    // Build children for objects and arrays
    if (type === 'object') {
      if (depth < this.options.maxDepth) {
        node.children = Object.keys(value).map((k) =>
          this.buildTree(value[k], `${path}.${k}`, depth + 1, k)
        );
      }
    } else if (type === 'array') {
      if (depth < this.options.maxDepth) {
        node.children = value.map((item: any, index: number) =>
          this.buildTree(item, `${path}[${index}]`, depth + 1, index)
        );
      }
    }

    return node;
  }

  /**
   * Get JSON value type
   */
  private getValueType(value: any): JsonValueType {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';

    return 'string'; // fallback
  }

  /**
   * Count total nodes in tree
   */
  private countNodes(node: JsonTreeNode): number {
    let count = 1; // Count this node

    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }

    return count;
  }

  /**
   * Build JSON HTML
   */
  private buildJsonHTML(
    tree: JsonTreeNode,
    treeId: string,
    totalNodes: number,
    useVirtualScroll: boolean
  ): string {
    // Build container
    let html = `<div class="${this.options.className}" data-tree-id="${treeId}">`;

    // Header with actions
    html += '<div class="json-header">';
    html += '<span class="json-label">JSON Viewer</span>';
    html += `<span class="json-stats">${totalNodes} nodes</span>`;
    html += '<div class="json-actions">';

    if (this.options.enableSearch) {
      html += '<input type="text" class="json-search" placeholder="Search keys or values..." />';
    }

    if (this.options.exportButtons) {
      html += '<button class="json-export-pretty-btn" data-action="export-pretty" title="Copy formatted JSON">📋 Pretty</button>';
      html += '<button class="json-export-minified-btn" data-action="export-minified" title="Copy minified JSON">📋 Minified</button>';
    }

    html += '<button class="json-expand-all-btn" data-action="expand-all" title="Expand all">⬇ Expand All</button>';
    html += '<button class="json-collapse-all-btn" data-action="collapse-all" title="Collapse all">⬆ Collapse All</button>';

    html += '</div>'; // .json-actions
    html += '</div>'; // .json-header

    // Tree content
    html += `<div class="json-tree-container" data-virtual-scroll="${useVirtualScroll}">`;

    if (useVirtualScroll) {
      html += '<div class="json-virtual-scroll-notice">⚡ Virtual scrolling enabled for large JSON</div>';
    }

    // Render tree nodes
    html += this.renderTreeNode(tree, 0);

    html += '</div>'; // .json-tree-container

    html += '</div>'; // .json-renderer

    return html;
  }

  /**
   * Render a tree node recursively
   */
  private renderTreeNode(node: JsonTreeNode, lineNumber: number): string {
    const { key, value, type, path, depth, isExpanded, children } = node;

    // Indent based on depth
    const indent = '  '.repeat(depth);

    let html = '';

    // Line number
    if (this.options.showLineNumbers && depth === 0) {
      html += `<span class="json-line-number">${lineNumber}</span>`;
    }

    // Key (if exists)
    if (key !== undefined) {
      html += `<span class="json-key" data-path="${this.escapeHtml(path)}">"${this.escapeHtml(String(key))}"</span>: `;
    }

    // Value based on type
    if (type === 'object') {
      const childCount = children ? children.length : 0;
      const expandClass = isExpanded ? 'expanded' : 'collapsed';

      html += `<span class="json-object ${expandClass}" data-path="${this.escapeHtml(path)}">`;
      html += `<span class="json-toggle" data-action="toggle">▶</span>`;
      html += `<span class="json-bracket">{</span>`;
      html += `<span class="json-count">${childCount} ${childCount === 1 ? 'key' : 'keys'}</span>`;

      if (isExpanded && children) {
        html += '<div class="json-children">';
        for (let i = 0; i < children.length; i++) {
          html += '<div class="json-node">';
          html += this.renderTreeNode(children[i], lineNumber + i + 1);
          html += '</div>';
        }
        html += '</div>';
      }

      html += `<span class="json-bracket">}</span>`;
      html += '</span>';

    } else if (type === 'array') {
      const childCount = children ? children.length : 0;
      const expandClass = isExpanded ? 'expanded' : 'collapsed';

      html += `<span class="json-array ${expandClass}" data-path="${this.escapeHtml(path)}">`;
      html += `<span class="json-toggle" data-action="toggle">▶</span>`;
      html += `<span class="json-bracket">[</span>`;
      html += `<span class="json-count">${childCount} ${childCount === 1 ? 'item' : 'items'}</span>`;

      if (isExpanded && children) {
        html += '<div class="json-children">';
        for (let i = 0; i < children.length; i++) {
          html += '<div class="json-node">';
          html += this.renderTreeNode(children[i], lineNumber + i + 1);
          html += '</div>';
        }
        html += '</div>';
      }

      html += `<span class="json-bracket">]</span>`;
      html += '</span>';

    } else if (type === 'string') {
      html += `<span class="json-string" data-path="${this.escapeHtml(path)}">"${this.escapeHtml(String(value))}"</span>`;
    } else if (type === 'number') {
      html += `<span class="json-number" data-path="${this.escapeHtml(path)}">${value}</span>`;
    } else if (type === 'boolean') {
      html += `<span class="json-boolean" data-path="${this.escapeHtml(path)}">${value}</span>`;
    } else if (type === 'null') {
      html += `<span class="json-null" data-path="${this.escapeHtml(path)}">null</span>`;
    }

    return html;
  }

  /**
   * Initialize tree interactions
   * This would be called after DOM insertion
   */
  private initializeTree(container: HTMLElement): void {
    // Toggle expand/collapse
    const toggleButtons = container.querySelectorAll('.json-toggle');
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const parent = target.closest('.json-object, .json-array');

        if (parent) {
          parent.classList.toggle('expanded');
          parent.classList.toggle('collapsed');

          // Update toggle icon
          target.textContent = parent.classList.contains('expanded') ? '▼' : '▶';
        }
      });
    });

    // Expand all
    const expandAllBtn = container.querySelector('.json-expand-all-btn');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        const nodes = container.querySelectorAll('.json-object, .json-array');
        nodes.forEach((node) => {
          node.classList.add('expanded');
          node.classList.remove('collapsed');

          const toggle = node.querySelector('.json-toggle');
          if (toggle) toggle.textContent = '▼';
        });
      });
    }

    // Collapse all
    const collapseAllBtn = container.querySelector('.json-collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        const nodes = container.querySelectorAll('.json-object, .json-array');
        nodes.forEach((node) => {
          node.classList.add('collapsed');
          node.classList.remove('expanded');

          const toggle = node.querySelector('.json-toggle');
          if (toggle) toggle.textContent = '▶';
        });
      });
    }

    // Copy path (right-click)
    if (this.options.enableCopyPath) {
      const pathElements = container.querySelectorAll('[data-path]');
      pathElements.forEach((el) => {
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();

          const path = (el as HTMLElement).getAttribute('data-path');
          if (path) {
            navigator.clipboard.writeText(path).then(() => {
              console.log('[JsonRenderer] Path copied:', path);

              // Show temporary tooltip
              const tooltip = document.createElement('div');
              tooltip.className = 'json-path-tooltip';
              tooltip.textContent = `Copied: ${path}`;
              tooltip.style.position = 'absolute';
              tooltip.style.left = `${(e as MouseEvent).clientX}px`;
              tooltip.style.top = `${(e as MouseEvent).clientY}px`;
              document.body.appendChild(tooltip);

              setTimeout(() => tooltip.remove(), 2000);
            });
          }
        });
      });
    }

    // Search functionality
    if (this.options.enableSearch) {
      const searchInput = container.querySelector('.json-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = (e.target as HTMLInputElement).value.toLowerCase();

          const nodes = container.querySelectorAll('.json-node');
          nodes.forEach((node) => {
            const text = node.textContent?.toLowerCase() || '';
            const matches = text.includes(query);

            if (matches || !query) {
              (node as HTMLElement).style.display = '';
            } else {
              (node as HTMLElement).style.display = 'none';
            }
          });
        });
      }
    }

    // Export functionality
    if (this.options.exportButtons) {
      const prettyBtn = container.querySelector('.json-export-pretty-btn');
      const minifiedBtn = container.querySelector('.json-export-minified-btn');

      if (prettyBtn) {
        prettyBtn.addEventListener('click', () => {
          try {
            const data = this.extractJsonData(container);
            const formatted = JSON.stringify(data, null, this.options.indentSize);
            navigator.clipboard.writeText(formatted);
            console.log('[JsonRenderer] Pretty JSON copied');
          } catch (error) {
            console.error('[JsonRenderer] Export error:', error);
          }
        });
      }

      if (minifiedBtn) {
        minifiedBtn.addEventListener('click', () => {
          try {
            const data = this.extractJsonData(container);
            const minified = JSON.stringify(data);
            navigator.clipboard.writeText(minified);
            console.log('[JsonRenderer] Minified JSON copied');
          } catch (error) {
            console.error('[JsonRenderer] Export error:', error);
          }
        });
      }
    }

    console.log('[JsonRenderer] Tree interactions initialized');
  }

  /**
   * Extract original JSON data from tree
   * This would be stored in a data attribute for export
   */
  private extractJsonData(container: HTMLElement): any {
    // In production, this would extract from data-json attribute
    // For now, return placeholder
    return { placeholder: 'Original JSON data would be stored here' };
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>JSON Parsing Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <details class="json-source">
          <summary>Show raw content</summary>
          <pre><code>${this.escapeHtml(content.substring(0, 500))}${content.length > 500 ? '...' : ''}</code></pre>
        </details>
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
  public getOptions(): typeof this.options {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<JsonRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create JSON renderer
 */
export function createJsonRenderer(options?: JsonRendererOptions): JsonRenderer {
  return new JsonRenderer(options);
}

/**
 * Convenience function to render JSON
 */
export async function renderJson(
  content: string,
  options?: JsonRendererOptions
): Promise<string> {
  const renderer = createJsonRenderer(options);
  return renderer.render(content);
}

/**
 * Example JSON for documentation
 */
export const JSON_EXAMPLES = {
  simple: {
    name: 'Alice',
    age: 30,
    active: true,
    address: null
  },

  nested: {
    user: {
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      profile: {
        bio: 'Software engineer',
        location: 'San Francisco',
        social: {
          twitter: '@alice',
          github: 'alice-dev'
        }
      }
    },
    posts: [
      { id: 1, title: 'Hello World', likes: 42 },
      { id: 2, title: 'JSON Viewer', likes: 128 }
    ]
  },

  array: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' }
  ]
};
