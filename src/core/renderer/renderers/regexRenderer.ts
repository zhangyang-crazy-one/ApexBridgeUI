/**
 * Regex Tester Renderer (CORE-035)
 *
 * Responsibilities:
 * - Interactive regex pattern testing with live match highlighting
 * - Multi-line text input for testing regex against sample text
 * - Visual match highlighting with capture groups
 * - Regex flags support (g, i, m, s, u, y)
 * - Match statistics and group extraction
 * - Pattern validation and error display
 * - Common regex pattern library
 * - Export matches to JSON/CSV
 * - Regex syntax reference
 * - Streaming chunk rendering (progressive regex loading)
 *
 * Features:
 * - Live Matching: Real-time regex evaluation as you type
 * - Capture Groups: Visual display of groups with colors
 * - Match Highlighting: Yellow background for matches
 * - Statistics: Match count, group count, execution time
 * - Flags: Interactive checkboxes for g/i/m/s/u/y flags
 * - Pattern Library: Pre-built patterns (email, URL, phone, etc.)
 * - Error Display: Clear regex syntax error messages
 * - Export: Download matches as JSON or CSV
 * - Syntax Help: Inline regex syntax reference
 * - Dark/Light Theme: Auto-adapts to theme
 *
 * Usage:
 * ```typescript
 * import { createRegexRenderer } from './renderers/regexRenderer';
 *
 * const renderer = createRegexRenderer();
 * const html = await renderer.render(regexContent);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Regex match result
 */
export interface RegexMatch {
  index: number;
  length: number;
  value: string;
  groups: RegexGroup[];
}

/**
 * Regex capture group
 */
export interface RegexGroup {
  index: number;
  value: string;
  start: number;
  end: number;
}

/**
 * Regex test result
 */
export interface RegexTestResult {
  valid: boolean;
  pattern: string;
  flags: string;
  matches: RegexMatch[];
  error?: {
    message: string;
    position?: number;
  };
  executionTime?: number;
}

/**
 * Regex pattern template
 */
export interface RegexPattern {
  name: string;
  description: string;
  pattern: string;
  flags: string;
  example: string;
}

/**
 * Regex renderer options
 */
export interface RegexRendererOptions {
  /**
   * Enable live matching
   * Default: true
   */
  liveMatch?: boolean;

  /**
   * Enable capture group highlighting
   * Default: true
   */
  showGroups?: boolean;

  /**
   * Enable match statistics
   * Default: true
   */
  showStats?: boolean;

  /**
   * Enable pattern library
   * Default: true
   */
  patternLibrary?: boolean;

  /**
   * Enable syntax reference
   * Default: true
   */
  syntaxReference?: boolean;

  /**
   * Enable export buttons
   * Default: true
   */
  exportButtons?: boolean;

  /**
   * Debounce delay for live matching (ms)
   * Default: 300
   */
  debounceDelay?: number;

  /**
   * Max matches to display
   * Default: 100
   */
  maxMatches?: number;

  /**
   * Custom CSS class for regex container
   * Default: 'regex-renderer'
   */
  className?: string;
}

/**
 * Regex Tester Renderer
 * Implements IRenderer interface for interactive regex testing
 */
export class RegexRenderer implements IRenderer {
  public readonly type = 'regex' as const;

  private options: Required<RegexRendererOptions>;
  private streamBuffer: string = '';
  private regexCounter: number = 1;
  private debounceTimer: number | null = null;

  // Common regex patterns
  private readonly PATTERN_LIBRARY: RegexPattern[] = [
    {
      name: 'Email',
      description: 'Standard email address',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      flags: 'g',
      example: 'user@example.com'
    },
    {
      name: 'URL',
      description: 'HTTP/HTTPS URLs',
      pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)',
      flags: 'g',
      example: 'https://example.com/path'
    },
    {
      name: 'Phone (US)',
      description: 'US phone number formats',
      pattern: '(\\+?1[-.]?)?\\(?([0-9]{3})\\)?[-.]?([0-9]{3})[-.]?([0-9]{4})',
      flags: 'g',
      example: '+1-555-123-4567'
    },
    {
      name: 'Date (YYYY-MM-DD)',
      description: 'ISO 8601 date format',
      pattern: '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])',
      flags: 'g',
      example: '2025-11-04'
    },
    {
      name: 'IPv4 Address',
      description: 'IPv4 address validation',
      pattern: '\\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
      flags: 'g',
      example: '192.168.1.1'
    },
    {
      name: 'Hex Color',
      description: 'Hexadecimal color codes',
      pattern: '#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\\b',
      flags: 'gi',
      example: '#FF5733'
    },
    {
      name: 'Credit Card',
      description: 'Credit card number (basic)',
      pattern: '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b',
      flags: 'g',
      example: '1234-5678-9012-3456'
    },
    {
      name: 'HTML Tag',
      description: 'HTML opening/closing tags',
      pattern: '<\\/?[a-z][a-z0-9]*[^<>]*>',
      flags: 'gi',
      example: '<div class="container">'
    }
  ];

  constructor(options: RegexRendererOptions = {}) {
    this.options = {
      liveMatch: options.liveMatch ?? true,
      showGroups: options.showGroups ?? true,
      showStats: options.showStats ?? true,
      patternLibrary: options.patternLibrary ?? true,
      syntaxReference: options.syntaxReference ?? true,
      exportButtons: options.exportButtons ?? true,
      debounceDelay: options.debounceDelay ?? 300,
      maxMatches: options.maxMatches ?? 100,
      className: options.className ?? 'regex-renderer'
    };
  }

  /**
   * Check if content is a regex pattern
   * Detection heuristics:
   * - Starts with / and ends with /flags
   * - Contains regex-specific patterns ([], (), \d, \w, etc.)
   * - Has regex flags (g, i, m, s, u, y)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for regex literal format: /pattern/flags
    if (/^\/.*\/[gimsuvy]*$/.test(trimmed)) {
      return true;
    }

    // Check for regex-specific patterns
    const regexPatterns = [
      /\[.*\]/,           // Character class []
      /\(.*\)/,           // Capturing group ()
      /\\[dDwWsS]/,       // Character class shorthand
      /\.\*/,             // .* wildcard
      /\.\+/,             // .+ wildcard
      /\{\\d+,?\\d*\}/,   // Quantifier {n,m}
      /\^|\$/,            // Anchors ^ $
      /\|/                // Alternation |
    ];

    const hasRegexPattern = regexPatterns.some(pattern => pattern.test(trimmed));

    // If has regex patterns and is short (< 200 chars), likely a regex
    return hasRegexPattern && trimmed.length < 200;
  }

  /**
   * Render regex to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Parse regex pattern and flags
      const { pattern, flags } = this.parseRegex(trimmed);

      // Generate unique ID
      const regexId = `regex-tester-${Date.now()}-${this.regexCounter++}`;

      // Build regex HTML
      const regexHtml = this.buildRegexHTML(pattern, flags, regexId);

      return regexHtml;

    } catch (error) {
      console.error('[RegexRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete regex data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.regex-loading')) {
      const loading = document.createElement('div');
      loading.className = 'regex-loading';
      loading.textContent = '⏳ Loading regex tester...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete regex
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.regex-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize regex tester interactions
      this.initializeRegex(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[RegexRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Parse regex pattern and flags from string
   */
  private parseRegex(content: string): { pattern: string; flags: string } {
    // Check for /pattern/flags format
    const regexMatch = content.match(/^\/(.*)\/([gimsuvy]*)$/);

    if (regexMatch) {
      return {
        pattern: regexMatch[1],
        flags: regexMatch[2]
      };
    }

    // Otherwise, treat entire content as pattern
    return {
      pattern: content,
      flags: ''
    };
  }

  /**
   * Test regex against text
   */
  private testRegex(pattern: string, flags: string, text: string): RegexTestResult {
    const result: RegexTestResult = {
      valid: true,
      pattern,
      flags,
      matches: []
    };

    const startTime = performance.now();

    try {
      // Create regex
      const regex = new RegExp(pattern, flags);

      // Find all matches
      if (flags.includes('g')) {
        // Global flag: find all matches
        let match;
        while ((match = regex.exec(text)) !== null && result.matches.length < this.options.maxMatches) {
          result.matches.push(this.extractMatch(match));

          // Prevent infinite loop for zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        // No global flag: find first match only
        const match = regex.exec(text);
        if (match) {
          result.matches.push(this.extractMatch(match));
        }
      }

      result.executionTime = performance.now() - startTime;

    } catch (error: any) {
      result.valid = false;
      result.error = {
        message: error.message || 'Invalid regex pattern'
      };
    }

    return result;
  }

  /**
   * Extract match and capture groups
   */
  private extractMatch(match: RegExpExecArray): RegexMatch {
    const groups: RegexGroup[] = [];

    // Extract capture groups (skip index 0 which is full match)
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        groups.push({
          index: i,
          value: match[i],
          start: match.index,
          end: match.index + match[i].length
        });
      }
    }

    return {
      index: match.index,
      length: match[0].length,
      value: match[0],
      groups
    };
  }

  /**
   * Build regex HTML
   */
  private buildRegexHTML(pattern: string, flags: string, regexId: string): string {
    let html = `<div class="${this.options.className}" data-regex-id="${regexId}">`;

    // Header
    html += '<div class="regex-header">';
    html += '<span class="regex-label">Regex Tester</span>';
    html += '</div>';

    // Pattern input section
    html += '<div class="regex-pattern-section">';
    html += '<div class="regex-pattern-input-group">';
    html += '<label class="regex-label-text">Pattern:</label>';
    html += '<div class="regex-pattern-wrapper">';
    html += '<span class="regex-slash">/</span>';
    html += `<input type="text" class="regex-pattern-input" value="${this.escapeHtml(pattern)}" placeholder="Enter regex pattern...">`;
    html += '<span class="regex-slash">/</span>';
    html += '</div>';
    html += '</div>';

    // Flags checkboxes
    html += '<div class="regex-flags-group">';
    html += '<label class="regex-label-text">Flags:</label>';
    html += '<div class="regex-flags">';

    const flagDefs = [
      { flag: 'g', label: 'Global', description: 'Find all matches' },
      { flag: 'i', label: 'Ignore Case', description: 'Case-insensitive' },
      { flag: 'm', label: 'Multiline', description: '^/$ match line breaks' },
      { flag: 's', label: 'Dot All', description: '. matches newlines' },
      { flag: 'u', label: 'Unicode', description: 'Unicode mode' },
      { flag: 'y', label: 'Sticky', description: 'Match from lastIndex' }
    ];

    for (const { flag, label, description } of flagDefs) {
      const checked = flags.includes(flag) ? 'checked' : '';
      html += `<label class="regex-flag-checkbox" title="${description}">`;
      html += `<input type="checkbox" value="${flag}" ${checked}>`;
      html += `<span>${flag}</span> ${label}`;
      html += '</label>';
    }

    html += '</div>'; // .regex-flags
    html += '</div>'; // .regex-flags-group
    html += '</div>'; // .regex-pattern-section

    // Test text input section
    html += '<div class="regex-test-section">';
    html += '<label class="regex-label-text">Test Text:</label>';
    html += '<textarea class="regex-test-input" rows="6" placeholder="Enter text to test against regex..."></textarea>';
    html += '</div>';

    // Statistics section
    if (this.options.showStats) {
      html += '<div class="regex-stats" style="display: none;">';
      html += '<div class="regex-stat"><strong>Matches:</strong> <span class="regex-match-count">0</span></div>';
      html += '<div class="regex-stat"><strong>Execution Time:</strong> <span class="regex-execution-time">0ms</span></div>';
      html += '</div>';
    }

    // Error display
    html += '<div class="regex-error" style="display: none;"></div>';

    // Matches display section
    html += '<div class="regex-matches-section" style="display: none;">';
    html += '<div class="regex-matches-header">';
    html += '<span class="regex-label-text">Matches:</span>';

    if (this.options.exportButtons) {
      html += '<div class="regex-export-buttons">';
      html += '<button class="regex-export-json" title="Export as JSON">Export JSON</button>';
      html += '<button class="regex-export-csv" title="Export as CSV">Export CSV</button>';
      html += '</div>';
    }

    html += '</div>'; // .regex-matches-header
    html += '<div class="regex-matches-container"></div>';
    html += '</div>'; // .regex-matches-section

    // Pattern library
    if (this.options.patternLibrary) {
      html += '<div class="regex-library-section">';
      html += '<details>';
      html += '<summary class="regex-label-text">Pattern Library</summary>';
      html += '<div class="regex-library-grid">';

      for (const pattern of this.PATTERN_LIBRARY) {
        html += '<div class="regex-library-item" data-pattern="' + this.escapeHtml(pattern.pattern) + '" data-flags="' + pattern.flags + '">';
        html += `<div class="regex-library-name">${this.escapeHtml(pattern.name)}</div>`;
        html += `<div class="regex-library-desc">${this.escapeHtml(pattern.description)}</div>`;
        html += `<code class="regex-library-pattern">/${this.escapeHtml(pattern.pattern)}/${pattern.flags}</code>`;
        html += `<div class="regex-library-example">Example: ${this.escapeHtml(pattern.example)}</div>`;
        html += '</div>';
      }

      html += '</div>'; // .regex-library-grid
      html += '</details>';
      html += '</div>'; // .regex-library-section
    }

    // Syntax reference
    if (this.options.syntaxReference) {
      html += '<div class="regex-reference-section">';
      html += '<details>';
      html += '<summary class="regex-label-text">Syntax Reference</summary>';
      html += '<div class="regex-reference-grid">';

      const syntaxRef = [
        { symbol: '.', desc: 'Any character except newline' },
        { symbol: '\\d', desc: 'Digit (0-9)' },
        { symbol: '\\D', desc: 'Non-digit' },
        { symbol: '\\w', desc: 'Word character (a-z, A-Z, 0-9, _)' },
        { symbol: '\\W', desc: 'Non-word character' },
        { symbol: '\\s', desc: 'Whitespace' },
        { symbol: '\\S', desc: 'Non-whitespace' },
        { symbol: '^', desc: 'Start of string/line' },
        { symbol: '$', desc: 'End of string/line' },
        { symbol: '*', desc: '0 or more (greedy)' },
        { symbol: '+', desc: '1 or more (greedy)' },
        { symbol: '?', desc: '0 or 1 (optional)' },
        { symbol: '{n}', desc: 'Exactly n times' },
        { symbol: '{n,}', desc: 'n or more times' },
        { symbol: '{n,m}', desc: 'Between n and m times' },
        { symbol: '[abc]', desc: 'Character class (a or b or c)' },
        { symbol: '[^abc]', desc: 'Negated class (not a, b, or c)' },
        { symbol: '(abc)', desc: 'Capturing group' },
        { symbol: '(?:abc)', desc: 'Non-capturing group' },
        { symbol: 'a|b', desc: 'Alternation (a or b)' }
      ];

      for (const { symbol, desc } of syntaxRef) {
        html += '<div class="regex-reference-item">';
        html += `<code class="regex-reference-symbol">${this.escapeHtml(symbol)}</code>`;
        html += `<span class="regex-reference-desc">${this.escapeHtml(desc)}</span>`;
        html += '</div>';
      }

      html += '</div>'; // .regex-reference-grid
      html += '</details>';
      html += '</div>'; // .regex-reference-section
    }

    html += '</div>'; // .regex-renderer

    return html;
  }

  /**
   * Build highlighted text with matches
   */
  private buildHighlightedText(text: string, matches: RegexMatch[]): string {
    if (matches.length === 0) {
      return this.escapeHtml(text);
    }

    let html = '';
    let lastIndex = 0;

    // Sort matches by index
    const sortedMatches = matches.sort((a, b) => a.index - b.index);

    for (const match of sortedMatches) {
      // Add text before match
      if (match.index > lastIndex) {
        html += this.escapeHtml(text.substring(lastIndex, match.index));
      }

      // Add highlighted match
      html += '<mark class="regex-match">';

      if (this.options.showGroups && match.groups.length > 0) {
        // Highlight capture groups with different colors
        let groupLastIndex = match.index;

        for (const group of match.groups) {
          // Add text before group
          if (group.start > groupLastIndex) {
            html += this.escapeHtml(text.substring(groupLastIndex, group.start));
          }

          // Add highlighted group
          const groupColor = this.getGroupColor(group.index);
          html += `<span class="regex-group" style="border-bottom: 2px solid ${groupColor};" title="Group ${group.index}">`;
          html += this.escapeHtml(group.value);
          html += '</span>';

          groupLastIndex = group.end;
        }

        // Add remaining match text after last group
        if (groupLastIndex < match.index + match.length) {
          html += this.escapeHtml(text.substring(groupLastIndex, match.index + match.length));
        }
      } else {
        html += this.escapeHtml(match.value);
      }

      html += '</mark>';

      lastIndex = match.index + match.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      html += this.escapeHtml(text.substring(lastIndex));
    }

    return html;
  }

  /**
   * Get color for capture group
   */
  private getGroupColor(groupIndex: number): string {
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Orange
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2'  // Sky blue
    ];

    return colors[(groupIndex - 1) % colors.length];
  }

  /**
   * Initialize regex tester interactions
   */
  private initializeRegex(container: HTMLElement): void {
    const patternInput = container.querySelector('.regex-pattern-input') as HTMLInputElement;
    const testInput = container.querySelector('.regex-test-input') as HTMLTextAreaElement;
    const flagCheckboxes = container.querySelectorAll('.regex-flag-checkbox input') as NodeListOf<HTMLInputElement>;
    const statsDiv = container.querySelector('.regex-stats') as HTMLElement;
    const errorDiv = container.querySelector('.regex-error') as HTMLElement;
    const matchesSection = container.querySelector('.regex-matches-section') as HTMLElement;
    const matchesContainer = container.querySelector('.regex-matches-container') as HTMLElement;

    if (!patternInput || !testInput) return;

    // Live matching function
    const performMatch = () => {
      const pattern = patternInput.value;
      const text = testInput.value;
      const flags = Array.from(flagCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .join('');

      if (!pattern || !text) {
        matchesSection.style.display = 'none';
        statsDiv.style.display = 'none';
        errorDiv.style.display = 'none';
        return;
      }

      // Test regex
      const result = this.testRegex(pattern, flags, text);

      if (!result.valid) {
        // Show error
        errorDiv.textContent = `Error: ${result.error?.message}`;
        errorDiv.style.display = 'block';
        matchesSection.style.display = 'none';
        statsDiv.style.display = 'none';
        return;
      }

      // Hide error
      errorDiv.style.display = 'none';

      // Show statistics
      if (this.options.showStats) {
        const matchCount = container.querySelector('.regex-match-count') as HTMLElement;
        const executionTime = container.querySelector('.regex-execution-time') as HTMLElement;

        if (matchCount) matchCount.textContent = String(result.matches.length);
        if (executionTime) executionTime.textContent = `${result.executionTime?.toFixed(2)}ms`;

        statsDiv.style.display = 'flex';
      }

      // Display matches
      if (result.matches.length > 0) {
        matchesSection.style.display = 'block';

        // Build highlighted text
        const highlightedText = this.buildHighlightedText(text, result.matches);
        matchesContainer.innerHTML = `<pre class="regex-highlighted-text">${highlightedText}</pre>`;

        // Build matches list
        let matchesListHtml = '<div class="regex-matches-list">';
        for (let i = 0; i < result.matches.length; i++) {
          const match = result.matches[i];
          matchesListHtml += `<div class="regex-match-item">`;
          matchesListHtml += `<div class="regex-match-header">Match ${i + 1} at position ${match.index}</div>`;
          matchesListHtml += `<div class="regex-match-value"><code>${this.escapeHtml(match.value)}</code></div>`;

          if (match.groups.length > 0) {
            matchesListHtml += '<div class="regex-match-groups">';
            for (const group of match.groups) {
              const groupColor = this.getGroupColor(group.index);
              matchesListHtml += `<div class="regex-match-group" style="border-left: 3px solid ${groupColor};">`;
              matchesListHtml += `<strong>Group ${group.index}:</strong> <code>${this.escapeHtml(group.value)}</code>`;
              matchesListHtml += '</div>';
            }
            matchesListHtml += '</div>';
          }

          matchesListHtml += '</div>';
        }
        matchesListHtml += '</div>';

        matchesContainer.innerHTML += matchesListHtml;
      } else {
        matchesSection.style.display = 'none';
      }
    };

    // Debounced live matching
    const debouncedMatch = () => {
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = window.setTimeout(() => {
        performMatch();
        this.debounceTimer = null;
      }, this.options.debounceDelay);
    };

    // Event listeners
    if (this.options.liveMatch) {
      patternInput.addEventListener('input', debouncedMatch);
      testInput.addEventListener('input', debouncedMatch);
      flagCheckboxes.forEach(cb => {
        cb.addEventListener('change', debouncedMatch);
      });
    }

    // Pattern library click
    if (this.options.patternLibrary) {
      const libraryItems = container.querySelectorAll('.regex-library-item');
      libraryItems.forEach(item => {
        item.addEventListener('click', () => {
          const pattern = item.getAttribute('data-pattern') || '';
          const flags = item.getAttribute('data-flags') || '';

          patternInput.value = pattern;

          // Update flag checkboxes
          flagCheckboxes.forEach(cb => {
            cb.checked = flags.includes(cb.value);
          });

          performMatch();
        });
      });
    }

    // Export buttons
    if (this.options.exportButtons) {
      const exportJsonBtn = container.querySelector('.regex-export-json');
      const exportCsvBtn = container.querySelector('.regex-export-csv');

      if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
          this.exportMatches(container, 'json');
        });
      }

      if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
          this.exportMatches(container, 'csv');
        });
      }
    }

    console.log('[RegexRenderer] Regex tester initialized');
  }

  /**
   * Export matches to file
   */
  private exportMatches(container: HTMLElement, format: 'json' | 'csv'): void {
    const patternInput = container.querySelector('.regex-pattern-input') as HTMLInputElement;
    const testInput = container.querySelector('.regex-test-input') as HTMLTextAreaElement;
    const flagCheckboxes = container.querySelectorAll('.regex-flag-checkbox input') as NodeListOf<HTMLInputElement>;

    const pattern = patternInput.value;
    const text = testInput.value;
    const flags = Array.from(flagCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value)
      .join('');

    const result = this.testRegex(pattern, flags, text);

    if (!result.valid || result.matches.length === 0) {
      alert('No matches to export');
      return;
    }

    let content: string;
    let mimeType: string;
    let filename: string;

    if (format === 'json') {
      content = JSON.stringify({
        pattern: result.pattern,
        flags: result.flags,
        matches: result.matches,
        executionTime: result.executionTime
      }, null, 2);
      mimeType = 'application/json';
      filename = 'regex-matches.json';
    } else {
      // CSV format
      const lines = ['Index,Value,Groups'];
      for (const match of result.matches) {
        const groups = match.groups.map(g => g.value).join(';');
        lines.push(`${match.index},"${match.value.replace(/"/g, '""')}","${groups}"`);
      }
      content = lines.join('\n');
      mimeType = 'text/csv';
      filename = 'regex-matches.csv';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>Regex Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="regex-source">
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
  public getOptions(): Required<RegexRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<RegexRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create regex renderer
 */
export function createRegexRenderer(options?: RegexRendererOptions): RegexRenderer {
  return new RegexRenderer(options);
}

/**
 * Convenience function to render regex
 */
export async function renderRegex(
  content: string,
  options?: RegexRendererOptions
): Promise<string> {
  const renderer = createRegexRenderer(options);
  return renderer.render(content);
}

/**
 * Example regex patterns for documentation
 */
export const REGEX_EXAMPLES = {
  simple: '/hello/gi',

  email: '/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g',

  url: '/https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/gi',

  groups: '/(\\d{3})-(\\d{3})-(\\d{4})/g',

  date: '/\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/g'
};
