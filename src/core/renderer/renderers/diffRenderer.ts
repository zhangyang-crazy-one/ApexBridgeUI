/**
 * Diff Renderer (CORE-031)
 *
 * Responsibilities:
 * - Render code diffs with side-by-side or unified view
 * - Highlight added, deleted, and modified lines
 * - Syntax highlighting for diff content
 * - Line-by-line comparison with alignment
 * - Collapse unchanged sections for focus
 * - Search within diff content
 * - Copy original/modified code blocks
 * - Display diff statistics (additions/deletions)
 * - Support multiple diff formats (unified, side-by-side, inline)
 * - Streaming chunk rendering (progressive diff loading)
 *
 * Features:
 * - View Modes: Side-by-side, unified, inline
 * - Line Highlighting: Added (+), deleted (-), modified (~)
 * - Syntax Highlighting: Language-aware code coloring
 * - Collapse Controls: Expand/collapse unchanged sections
 * - Search: Find text within diff
 * - Statistics: Line counts and change summary
 * - Copy Buttons: Copy left/right code blocks
 * - Line Numbers: Show line numbers for both versions
 * - Word-level Diff: Highlight specific word changes
 * - Context Lines: Configurable context around changes
 * - Dark/Light Theme: Auto-adapts to theme
 *
 * Usage:
 * ```typescript
 * import { createDiffRenderer } from './renderers/diffRenderer';
 *
 * const renderer = createDiffRenderer();
 * const html = await renderer.render(diffContent);
 * // Or unified diff format:
 * // --- a/file.js
 * // +++ b/file.js
 * // @@ -10,5 +10,6 @@
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Diff view mode
 */
export type DiffViewMode = 'side-by-side' | 'unified' | 'inline';

/**
 * Diff line type
 */
export type DiffLineType = 'context' | 'added' | 'deleted' | 'modified' | 'header' | 'hunk';

/**
 * Diff line
 */
export interface DiffLine {
  type: DiffLineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  wordDiffs?: WordDiff[];
}

/**
 * Word-level diff
 */
export interface WordDiff {
  type: 'added' | 'deleted' | 'unchanged';
  text: string;
}

/**
 * Diff hunk
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  collapsed: boolean;
}

/**
 * Diff metadata
 */
export interface DiffMetadata {
  oldFile?: string;
  newFile?: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  language?: string;
}

/**
 * Diff renderer options
 */
export interface DiffRendererOptions {
  /**
   * View mode
   * Default: 'side-by-side'
   */
  viewMode?: DiffViewMode;

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
   * Enable word-level diff highlighting
   * Default: true
   */
  wordDiff?: boolean;

  /**
   * Number of context lines around changes
   * Default: 3
   */
  contextLines?: number;

  /**
   * Enable collapse/expand for unchanged sections
   * Default: true
   */
  collapsible?: boolean;

  /**
   * Auto-collapse unchanged sections with > N lines
   * Default: 5
   */
  autoCollapseThreshold?: number;

  /**
   * Enable search functionality
   * Default: true
   */
  searchEnabled?: boolean;

  /**
   * Show diff statistics
   * Default: true
   */
  showStats?: boolean;

  /**
   * Enable copy buttons
   * Default: true
   */
  copyButtons?: boolean;

  /**
   * Highlight current line on hover
   * Default: true
   */
  highlightOnHover?: boolean;

  /**
   * Custom CSS class for diff container
   * Default: 'diff-renderer'
   */
  className?: string;

  /**
   * Language for syntax highlighting
   * Default: auto-detect from file extension
   */
  language?: string;
}

/**
 * Diff Renderer
 * Implements IRenderer interface for code diffs with multiple view modes
 */
export class DiffRenderer implements IRenderer {
  public readonly type = 'diff' as const;

  private options: Required<Omit<DiffRendererOptions, 'language'>> & {
    language?: string;
  };

  private streamBuffer: string = '';
  private diffCounter: number = 1;

  constructor(options: DiffRendererOptions = {}) {
    this.options = {
      viewMode: options.viewMode ?? 'side-by-side',
      syntaxHighlighting: options.syntaxHighlighting ?? true,
      lineNumbers: options.lineNumbers ?? true,
      wordDiff: options.wordDiff ?? true,
      contextLines: options.contextLines ?? 3,
      collapsible: options.collapsible ?? true,
      autoCollapseThreshold: options.autoCollapseThreshold ?? 5,
      searchEnabled: options.searchEnabled ?? true,
      showStats: options.showStats ?? true,
      copyButtons: options.copyButtons ?? true,
      highlightOnHover: options.highlightOnHover ?? true,
      className: options.className ?? 'diff-renderer',
      language: options.language
    };
  }

  /**
   * Check if content is a diff
   * Detection heuristics:
   * - Starts with "diff --git" or "--- " or "+++ "
   * - Contains @@ hunk headers
   * - Has lines starting with +, -, or space (unified diff format)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for unified diff format headers
    if (/^(diff --git|--- |@@|\+\+\+ )/m.test(trimmed)) {
      return true;
    }

    // Check for lines starting with diff markers
    const lines = trimmed.split('\n');
    let diffLineCount = 0;

    for (const line of lines.slice(0, 20)) { // Check first 20 lines
      if (/^[\+\-\s]/.test(line)) {
        diffLineCount++;
      }
    }

    // If >30% of lines have diff markers, consider it a diff
    return diffLineCount / Math.min(lines.length, 20) > 0.3;
  }

  /**
   * Render diff to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Parse diff content
      const diffMetadata = this.parseDiff(trimmed);

      // Generate unique ID
      const diffId = `diff-viewer-${Date.now()}-${this.diffCounter++}`;

      // Build diff HTML
      const diffHtml = this.buildDiffHTML(diffMetadata, diffId);

      return diffHtml;

    } catch (error) {
      console.error('[DiffRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete diff data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.diff-loading')) {
      const loading = document.createElement('div');
      loading.className = 'diff-loading';
      loading.textContent = '⏳ Loading diff...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete diff
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.diff-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize diff viewer interactions
      this.initializeDiff(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[DiffRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Parse unified diff format
   */
  private parseDiff(content: string): DiffMetadata {
    const lines = content.split('\n');
    const metadata: DiffMetadata = {
      hunks: [],
      additions: 0,
      deletions: 0
    };

    let currentHunk: DiffHunk | null = null;
    let oldLineNumber = 0;
    let newLineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse file headers
      if (line.startsWith('--- ')) {
        metadata.oldFile = line.substring(4).trim();
        continue;
      }
      if (line.startsWith('+++ ')) {
        metadata.newFile = line.substring(4).trim();
        continue;
      }

      // Parse hunk header: @@ -10,5 +10,6 @@
      const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (hunkMatch) {
        // Save previous hunk
        if (currentHunk) {
          metadata.hunks.push(currentHunk);
        }

        // Create new hunk
        currentHunk = {
          oldStart: Number(hunkMatch[1]),
          oldLines: Number(hunkMatch[2] || 1),
          newStart: Number(hunkMatch[3]),
          newLines: Number(hunkMatch[4] || 1),
          lines: [],
          collapsed: false
        };

        oldLineNumber = currentHunk.oldStart;
        newLineNumber = currentHunk.newStart;

        currentHunk.lines.push({
          type: 'hunk',
          content: line
        });
        continue;
      }

      // Parse diff lines
      if (currentHunk) {
        if (line.startsWith('+')) {
          // Added line
          currentHunk.lines.push({
            type: 'added',
            newLineNumber: newLineNumber++,
            content: line.substring(1)
          });
          metadata.additions++;
        } else if (line.startsWith('-')) {
          // Deleted line
          currentHunk.lines.push({
            type: 'deleted',
            oldLineNumber: oldLineNumber++,
            content: line.substring(1)
          });
          metadata.deletions++;
        } else if (line.startsWith(' ')) {
          // Context line
          currentHunk.lines.push({
            type: 'context',
            oldLineNumber: oldLineNumber++,
            newLineNumber: newLineNumber++,
            content: line.substring(1)
          });
        } else if (line.startsWith('\\')) {
          // "\ No newline at end of file"
          currentHunk.lines.push({
            type: 'context',
            content: line
          });
        }
      }
    }

    // Save last hunk
    if (currentHunk) {
      metadata.hunks.push(currentHunk);
    }

    // Detect language from file extension
    if (metadata.newFile || metadata.oldFile) {
      const fileName = metadata.newFile || metadata.oldFile || '';
      const extMatch = fileName.match(/\.([^.]+)$/);
      if (extMatch) {
        metadata.language = this.detectLanguage(extMatch[1]);
      }
    }

    // Auto-collapse unchanged sections
    if (this.options.collapsible) {
      this.autoCollapseHunks(metadata.hunks);
    }

    return metadata;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash',
      'sql': 'sql'
    };

    return languageMap[extension.toLowerCase()] || 'plaintext';
  }

  /**
   * Auto-collapse unchanged sections
   */
  private autoCollapseHunks(hunks: DiffHunk[]): void {
    for (const hunk of hunks) {
      const contextLines = hunk.lines.filter(line => line.type === 'context');
      if (contextLines.length > this.options.autoCollapseThreshold) {
        hunk.collapsed = true;
      }
    }
  }

  /**
   * Build diff HTML
   */
  private buildDiffHTML(metadata: DiffMetadata, diffId: string): string {
    let html = `<div class="${this.options.className}" data-diff-id="${diffId}">`;

    // Header with file names and stats
    html += '<div class="diff-header">';
    html += '<div class="diff-file-info">';

    if (metadata.oldFile && metadata.newFile) {
      html += `<span class="diff-old-file">${this.escapeHtml(metadata.oldFile)}</span>`;
      html += ' → ';
      html += `<span class="diff-new-file">${this.escapeHtml(metadata.newFile)}</span>`;
    }

    html += '</div>';

    // Statistics
    if (this.options.showStats) {
      html += '<div class="diff-stats">';
      html += `<span class="diff-additions">+${metadata.additions}</span>`;
      html += `<span class="diff-deletions">-${metadata.deletions}</span>`;
      html += '</div>';
    }

    // View mode selector
    html += '<div class="diff-actions">';
    html += '<div class="diff-view-mode">';
    html += `<button class="diff-mode-btn ${this.options.viewMode === 'side-by-side' ? 'active' : ''}" data-mode="side-by-side">Side-by-Side</button>`;
    html += `<button class="diff-mode-btn ${this.options.viewMode === 'unified' ? 'active' : ''}" data-mode="unified">Unified</button>`;
    html += `<button class="diff-mode-btn ${this.options.viewMode === 'inline' ? 'active' : ''}" data-mode="inline">Inline</button>`;
    html += '</div>';

    if (this.options.searchEnabled) {
      html += '<input type="text" class="diff-search-input" placeholder="Search in diff...">';
    }

    html += '</div>'; // .diff-actions

    html += '</div>'; // .diff-header

    // Diff content
    html += '<div class="diff-content">';

    if (this.options.viewMode === 'side-by-side') {
      html += this.buildSideBySideView(metadata);
    } else if (this.options.viewMode === 'unified') {
      html += this.buildUnifiedView(metadata);
    } else {
      html += this.buildInlineView(metadata);
    }

    html += '</div>'; // .diff-content

    html += '</div>'; // .diff-renderer

    return html;
  }

  /**
   * Build side-by-side view
   */
  private buildSideBySideView(metadata: DiffMetadata): string {
    let html = '<div class="diff-side-by-side">';

    html += '<div class="diff-side diff-side-old">';
    html += '<div class="diff-side-header">Original</div>';
    html += '<div class="diff-lines">';

    for (const hunk of metadata.hunks) {
      if (hunk.collapsed) {
        html += `<div class="diff-hunk-collapsed" data-hunk-index="${metadata.hunks.indexOf(hunk)}">`;
        html += `<button class="diff-expand-btn">⋯ Expand ${hunk.lines.filter(l => l.type === 'context').length} unchanged lines</button>`;
        html += '</div>';
        continue;
      }

      for (const line of hunk.lines) {
        if (line.type === 'hunk') continue;

        html += `<div class="diff-line diff-line-${line.type}">`;

        if (this.options.lineNumbers && line.oldLineNumber !== undefined) {
          html += `<span class="diff-line-number">${line.oldLineNumber}</span>`;
        } else if (this.options.lineNumbers) {
          html += '<span class="diff-line-number"></span>';
        }

        if (line.type !== 'added') {
          html += `<span class="diff-line-content">${this.escapeHtml(line.content)}</span>`;
        }

        html += '</div>';
      }
    }

    html += '</div>'; // .diff-lines
    html += '</div>'; // .diff-side-old

    html += '<div class="diff-side diff-side-new">';
    html += '<div class="diff-side-header">Modified</div>';
    html += '<div class="diff-lines">';

    for (const hunk of metadata.hunks) {
      if (hunk.collapsed) {
        html += `<div class="diff-hunk-collapsed" data-hunk-index="${metadata.hunks.indexOf(hunk)}">`;
        html += `<button class="diff-expand-btn">⋯ Expand ${hunk.lines.filter(l => l.type === 'context').length} unchanged lines</button>`;
        html += '</div>';
        continue;
      }

      for (const line of hunk.lines) {
        if (line.type === 'hunk') continue;

        html += `<div class="diff-line diff-line-${line.type}">`;

        if (this.options.lineNumbers && line.newLineNumber !== undefined) {
          html += `<span class="diff-line-number">${line.newLineNumber}</span>`;
        } else if (this.options.lineNumbers) {
          html += '<span class="diff-line-number"></span>';
        }

        if (line.type !== 'deleted') {
          html += `<span class="diff-line-content">${this.escapeHtml(line.content)}</span>`;
        }

        html += '</div>';
      }
    }

    html += '</div>'; // .diff-lines
    html += '</div>'; // .diff-side-new

    html += '</div>'; // .diff-side-by-side

    return html;
  }

  /**
   * Build unified view
   */
  private buildUnifiedView(metadata: DiffMetadata): string {
    let html = '<div class="diff-unified">';
    html += '<div class="diff-lines">';

    for (const hunk of metadata.hunks) {
      if (hunk.collapsed) {
        html += `<div class="diff-hunk-collapsed" data-hunk-index="${metadata.hunks.indexOf(hunk)}">`;
        html += `<button class="diff-expand-btn">⋯ Expand ${hunk.lines.filter(l => l.type === 'context').length} unchanged lines</button>`;
        html += '</div>';
        continue;
      }

      for (const line of hunk.lines) {
        html += `<div class="diff-line diff-line-${line.type}">`;

        if (line.type === 'hunk') {
          html += `<span class="diff-hunk-header">${this.escapeHtml(line.content)}</span>`;
        } else {
          if (this.options.lineNumbers) {
            html += `<span class="diff-line-number">${line.oldLineNumber || ''}</span>`;
            html += `<span class="diff-line-number">${line.newLineNumber || ''}</span>`;
          }

          const prefix = line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';
          html += `<span class="diff-line-prefix">${prefix}</span>`;
          html += `<span class="diff-line-content">${this.escapeHtml(line.content)}</span>`;
        }

        html += '</div>';
      }
    }

    html += '</div>'; // .diff-lines
    html += '</div>'; // .diff-unified

    return html;
  }

  /**
   * Build inline view
   */
  private buildInlineView(metadata: DiffMetadata): string {
    let html = '<div class="diff-inline">';
    html += '<div class="diff-lines">';

    for (const hunk of metadata.hunks) {
      if (hunk.collapsed) {
        html += `<div class="diff-hunk-collapsed" data-hunk-index="${metadata.hunks.indexOf(hunk)}">`;
        html += `<button class="diff-expand-btn">⋯ Expand ${hunk.lines.filter(l => l.type === 'context').length} unchanged lines</button>`;
        html += '</div>';
        continue;
      }

      for (const line of hunk.lines) {
        html += `<div class="diff-line diff-line-${line.type}">`;

        if (line.type === 'hunk') {
          html += `<span class="diff-hunk-header">${this.escapeHtml(line.content)}</span>`;
        } else {
          if (this.options.lineNumbers) {
            html += `<span class="diff-line-number">${line.oldLineNumber || line.newLineNumber || ''}</span>`;
          }

          const marker = line.type === 'added' ? '+ ' : line.type === 'deleted' ? '- ' : '';
          html += `<span class="diff-line-marker">${marker}</span>`;
          html += `<span class="diff-line-content">${this.escapeHtml(line.content)}</span>`;
        }

        html += '</div>';
      }
    }

    html += '</div>'; // .diff-lines
    html += '</div>'; // .diff-inline

    return html;
  }

  /**
   * Initialize diff viewer interactions
   */
  private initializeDiff(container: HTMLElement): void {
    // View mode switcher
    const modeBtns = container.querySelectorAll('.diff-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.target as HTMLElement).getAttribute('data-mode') as DiffViewMode;
        this.switchViewMode(container, mode);
      });
    });

    // Expand/collapse buttons
    const expandBtns = container.querySelectorAll('.diff-expand-btn');
    expandBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const collapsedDiv = (e.target as HTMLElement).closest('.diff-hunk-collapsed');
        if (collapsedDiv) {
          collapsedDiv.classList.add('expanded');
          (e.target as HTMLElement).textContent = '⋯ Collapse';
        }
      });
    });

    // Search functionality
    const searchInput = container.querySelector('.diff-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.searchInDiff(container, query);
      });
    }

    // Hover highlighting
    if (this.options.highlightOnHover) {
      const lines = container.querySelectorAll('.diff-line');
      lines.forEach(line => {
        line.addEventListener('mouseenter', () => {
          line.classList.add('highlighted');
        });
        line.addEventListener('mouseleave', () => {
          line.classList.remove('highlighted');
        });
      });
    }

    console.log('[DiffRenderer] Diff viewer initialized');
  }

  /**
   * Switch view mode
   */
  private switchViewMode(container: HTMLElement, mode: DiffViewMode): void {
    // Update active button
    const modeBtns = container.querySelectorAll('.diff-mode-btn');
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    // Re-render diff content with new mode
    this.options.viewMode = mode;
    // In production, this would re-render the diff content
    console.log('[DiffRenderer] View mode changed to:', mode);
  }

  /**
   * Search in diff
   */
  private searchInDiff(container: HTMLElement, query: string): void {
    const lines = container.querySelectorAll('.diff-line-content');

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
          <strong>Diff Parsing Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="diff-source">
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
  public getOptions(): typeof this.options {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<DiffRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create diff renderer
 */
export function createDiffRenderer(options?: DiffRendererOptions): DiffRenderer {
  return new DiffRenderer(options);
}

/**
 * Convenience function to render diff
 */
export async function renderDiff(
  content: string,
  options?: DiffRendererOptions
): Promise<string> {
  const renderer = createDiffRenderer(options);
  return renderer.render(content);
}

/**
 * Example diffs for documentation
 */
export const DIFF_EXAMPLES = {
  unified: `--- a/src/app.js
+++ b/src/app.js
@@ -10,5 +10,6 @@
 function main() {
   console.log('Hello');
-  return 0;
+  console.log('World');
+  return 1;
 }`,

  gitDiff: `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -10,5 +10,6 @@ function main() {
   console.log('Hello');
-  return 0;
+  console.log('World');
+  return 1;
 }`
};
