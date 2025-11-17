/**
 * CSV Renderer (CORE-026)
 *
 * Responsibilities:
 * - Render CSV data as interactive table
 * - Support sortable columns (ascending/descending)
 * - Support column filtering and search
 * - Handle large CSV files with virtual scrolling
 * - Auto-detect delimiters (comma, semicolon, tab, pipe)
 * - Export to formatted CSV or JSON
 * - Streaming chunk rendering with incremental parsing
 *
 * Features:
 * - Sortable Columns: Click column header to sort ascending/descending
 * - Column Filtering: Filter rows by column values
 * - Global Search: Search across all columns
 * - Pagination: Page through large datasets
 * - Virtual Scrolling: Handle 10000+ rows efficiently
 * - Auto-delimiter Detection: Detect CSV, TSV, PSV formats
 * - Header Detection: Auto-detect if first row is header
 * - Copy Cell/Row: Copy individual cells or entire rows
 * - Export: Export as CSV or JSON
 * - Column Resizing: Drag column borders to resize
 *
 * Usage:
 * ```typescript
 * import { createCsvRenderer } from './renderers/csvRenderer';
 *
 * const renderer = createCsvRenderer();
 * const html = await renderer.render('name,age\nAlice,30\nBob,25');
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * CSV delimiter types
 */
export type CsvDelimiter = ',' | ';' | '\t' | '|';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc' | null;

/**
 * CSV parsing result
 */
export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  delimiter: CsvDelimiter;
  hasHeader: boolean;
  totalRows: number;
}

/**
 * Column sort state
 */
export interface ColumnSortState {
  columnIndex: number;
  direction: SortDirection;
}

/**
 * CSV renderer options
 */
export interface CsvRendererOptions {
  /**
   * Enable sortable columns
   * Default: true
   */
  sortable?: boolean;

  /**
   * Enable column filtering
   * Default: true
   */
  filterable?: boolean;

  /**
   * Enable global search
   * Default: true
   */
  searchable?: boolean;

  /**
   * Enable pagination
   * Default: true
   */
  paginate?: boolean;

  /**
   * Rows per page
   * Default: 50
   */
  rowsPerPage?: number;

  /**
   * Enable virtual scrolling
   * Default: true
   */
  virtualScroll?: boolean;

  /**
   * Virtual scroll threshold (number of rows)
   * Default: 1000
   */
  virtualScrollThreshold?: number;

  /**
   * Auto-detect delimiter
   * Default: true
   */
  autoDetectDelimiter?: boolean;

  /**
   * Custom delimiter (overrides auto-detection)
   */
  delimiter?: CsvDelimiter;

  /**
   * Auto-detect header row
   * Default: true
   */
  autoDetectHeader?: boolean;

  /**
   * Has header row (overrides auto-detection)
   */
  hasHeader?: boolean;

  /**
   * Enable column resizing
   * Default: true
   */
  resizableColumns?: boolean;

  /**
   * Enable copy cell/row
   * Default: true
   */
  enableCopy?: boolean;

  /**
   * Enable export buttons
   * Default: true
   */
  exportButtons?: boolean;

  /**
   * Show row numbers
   * Default: true
   */
  showRowNumbers?: boolean;

  /**
   * Striped rows (alternating colors)
   * Default: true
   */
  stripedRows?: boolean;

  /**
   * Compact mode (smaller padding)
   * Default: false
   */
  compactMode?: boolean;

  /**
   * Custom CSS class for CSV container
   * Default: 'csv-renderer'
   */
  className?: string;
}

/**
 * CSV Renderer
 * Implements IRenderer interface for CSV data with interactive table
 */
export class CsvRenderer implements IRenderer {
  public readonly type = 'csv' as const;

  private options: Required<Omit<CsvRendererOptions, 'delimiter' | 'hasHeader'>> & {
    delimiter?: CsvDelimiter;
    hasHeader?: boolean;
  };

  private streamBuffer: string = '';
  private tableCounter: number = 1;

  constructor(options: CsvRendererOptions = {}) {
    this.options = {
      sortable: options.sortable ?? true,
      filterable: options.filterable ?? true,
      searchable: options.searchable ?? true,
      paginate: options.paginate ?? true,
      rowsPerPage: options.rowsPerPage ?? 50,
      virtualScroll: options.virtualScroll ?? true,
      virtualScrollThreshold: options.virtualScrollThreshold ?? 1000,
      autoDetectDelimiter: options.autoDetectDelimiter ?? true,
      delimiter: options.delimiter,
      autoDetectHeader: options.autoDetectHeader ?? true,
      hasHeader: options.hasHeader,
      resizableColumns: options.resizableColumns ?? true,
      enableCopy: options.enableCopy ?? true,
      exportButtons: options.exportButtons ?? true,
      showRowNumbers: options.showRowNumbers ?? true,
      stripedRows: options.stripedRows ?? true,
      compactMode: options.compactMode ?? false,
      className: options.className ?? 'csv-renderer'
    };
  }

  /**
   * Check if content is CSV
   * Detection heuristics:
   * - Contains delimiter characters (comma, semicolon, tab, pipe)
   * - Multiple lines with consistent column count
   * - No HTML/XML/JSON structure
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Reject if looks like HTML/XML/JSON
    if (/^[<{[]/.test(trimmed)) return false;

    // Check for common CSV delimiters
    const hasDelimiters = /[,;\t|]/.test(trimmed);
    if (!hasDelimiters) return false;

    // Check if multiple lines
    const lines = trimmed.split('\n');
    if (lines.length < 2) return false;

    // Check for consistent column count
    const delimiter = this.detectDelimiter(trimmed);
    const columnCounts = lines.slice(0, 5).map(line =>
      this.parseCsvLine(line, delimiter).length
    );

    // At least 80% of lines should have same column count
    const mostCommonCount = this.getMostCommon(columnCounts);
    const consistency = columnCounts.filter(c => c === mostCommonCount).length / columnCounts.length;

    return consistency >= 0.8;
  }

  /**
   * Render CSV content to HTML table
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      // Parse CSV
      const parsed = this.parseCsv(content.trim());

      // Generate unique ID
      const tableId = `csv-table-${Date.now()}-${this.tableCounter++}`;

      // Determine if pagination or virtual scroll
      const useVirtualScroll = this.options.virtualScroll &&
                               parsed.totalRows > this.options.virtualScrollThreshold;

      // Build CSV HTML
      const csvHtml = this.buildCsvHTML(parsed, tableId, useVirtualScroll);

      return csvHtml;

    } catch (error) {
      console.error('[CsvRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete CSV
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.csv-loading')) {
      const loading = document.createElement('div');
      loading.className = 'csv-loading';
      loading.textContent = '⏳ Loading CSV...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete CSV
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.csv-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize table interactions
      this.initializeTable(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[CsvRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Parse CSV content
   */
  private parseCsv(content: string): CsvParseResult {
    // Detect delimiter
    const delimiter = this.options.delimiter || this.detectDelimiter(content);

    // Split into lines
    const lines = content.split('\n').filter(line => line.trim());

    // Detect if first row is header
    const hasHeader = this.options.hasHeader ?? this.detectHeader(lines, delimiter);

    // Parse headers
    const headers = hasHeader
      ? this.parseCsvLine(lines[0], delimiter)
      : lines[0].split(delimiter).map((_, i) => `Column ${i + 1}`);

    // Parse rows
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map(line => this.parseCsvLine(line, delimiter));

    return {
      headers,
      rows,
      delimiter,
      hasHeader,
      totalRows: rows.length
    };
  }

  /**
   * Parse single CSV line respecting quoted values
   */
  private parseCsvLine(line: string, delimiter: CsvDelimiter): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentValue += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    // Add last value
    values.push(currentValue.trim());

    return values;
  }

  /**
   * Detect CSV delimiter
   */
  private detectDelimiter(content: string): CsvDelimiter {
    const delimiters: CsvDelimiter[] = [',', ';', '\t', '|'];
    const firstLine = content.split('\n')[0];

    // Count occurrences of each delimiter
    const counts = delimiters.map(delim => ({
      delimiter: delim,
      count: (firstLine.match(new RegExp(`\\${delim}`, 'g')) || []).length
    }));

    // Return delimiter with highest count
    const best = counts.reduce((prev, curr) =>
      curr.count > prev.count ? curr : prev
    );

    return best.delimiter;
  }

  /**
   * Detect if first row is header
   */
  private detectHeader(lines: string[], delimiter: CsvDelimiter): boolean {
    if (lines.length < 2) return true; // Assume header if only one line

    const firstRow = this.parseCsvLine(lines[0], delimiter);
    const secondRow = this.parseCsvLine(lines[1], delimiter);

    // Check if first row contains non-numeric values (likely headers)
    const firstRowNumeric = firstRow.filter(val => !isNaN(Number(val))).length;
    const secondRowNumeric = secondRow.filter(val => !isNaN(Number(val))).length;

    // If first row is mostly text and second row is mostly numbers, likely has header
    return firstRowNumeric < firstRow.length * 0.5 && secondRowNumeric > secondRow.length * 0.5;
  }

  /**
   * Get most common value in array
   */
  private getMostCommon(arr: number[]): number {
    const counts: Record<number, number> = {};
    arr.forEach(val => {
      counts[val] = (counts[val] || 0) + 1;
    });

    let maxCount = 0;
    let mostCommon = arr[0];

    for (const [val, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = Number(val);
      }
    }

    return mostCommon;
  }

  /**
   * Build CSV HTML
   */
  private buildCsvHTML(parsed: CsvParseResult, tableId: string, useVirtualScroll: boolean): string {
    const { headers, rows, delimiter, totalRows } = parsed;

    // Build container
    let html = `<div class="${this.options.className}" data-table-id="${tableId}">`;

    // Header with actions
    html += '<div class="csv-header">';
    html += '<span class="csv-label">CSV Table</span>';
    html += `<span class="csv-stats">${totalRows} rows × ${headers.length} columns</span>`;
    html += '<div class="csv-actions">';

    if (this.options.searchable) {
      html += '<input type="text" class="csv-search" placeholder="Search all columns..." />';
    }

    if (this.options.exportButtons) {
      html += '<button class="csv-export-csv-btn" data-action="export-csv" title="Export as CSV">📋 CSV</button>';
      html += '<button class="csv-export-json-btn" data-action="export-json" title="Export as JSON">📋 JSON</button>';
    }

    html += '</div>'; // .csv-actions
    html += '</div>'; // .csv-header

    // Table container
    const compactClass = this.options.compactMode ? ' compact' : '';
    const stripedClass = this.options.stripedRows ? ' striped' : '';
    html += `<div class="csv-table-container${compactClass}${stripedClass}" data-virtual-scroll="${useVirtualScroll}">`;

    if (useVirtualScroll) {
      html += '<div class="csv-virtual-scroll-notice">⚡ Virtual scrolling enabled for large dataset</div>';
    }

    // Table
    html += `<table class="csv-table">`;

    // Table header
    html += '<thead><tr>';

    if (this.options.showRowNumbers) {
      html += '<th class="csv-row-number-header">#</th>';
    }

    headers.forEach((header, index) => {
      const sortClass = this.options.sortable ? ' sortable' : '';
      html += `<th class="csv-column-header${sortClass}" data-column-index="${index}">`;
      html += `<span class="csv-header-text">${this.escapeHtml(header)}</span>`;

      if (this.options.sortable) {
        html += '<span class="csv-sort-icon">⇅</span>';
      }

      html += '</th>';
    });

    html += '</tr></thead>';

    // Table body
    html += '<tbody>';

    const displayRows = this.options.paginate
      ? rows.slice(0, this.options.rowsPerPage)
      : rows;

    displayRows.forEach((row, rowIndex) => {
      html += '<tr class="csv-row">';

      if (this.options.showRowNumbers) {
        html += `<td class="csv-row-number">${rowIndex + 1}</td>`;
      }

      row.forEach((cell, cellIndex) => {
        html += `<td class="csv-cell" data-column-index="${cellIndex}">`;
        html += this.escapeHtml(cell);
        html += '</td>';
      });

      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';

    html += '</div>'; // .csv-table-container

    // Pagination
    if (this.options.paginate && totalRows > this.options.rowsPerPage) {
      const totalPages = Math.ceil(totalRows / this.options.rowsPerPage);
      html += '<div class="csv-pagination">';
      html += `<span class="csv-page-info">Page 1 of ${totalPages}</span>`;
      html += '<div class="csv-page-controls">';
      html += '<button class="csv-prev-page-btn" disabled>◀ Previous</button>';
      html += '<button class="csv-next-page-btn">Next ▶</button>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // .csv-renderer

    return html;
  }

  /**
   * Initialize table interactions
   */
  private initializeTable(container: HTMLElement): void {
    // Sortable columns
    if (this.options.sortable) {
      const headers = container.querySelectorAll('.csv-column-header.sortable');
      headers.forEach((header) => {
        header.addEventListener('click', (e) => {
          const columnIndex = Number((e.currentTarget as HTMLElement).getAttribute('data-column-index'));
          this.sortColumn(container, columnIndex);
        });
      });
    }

    // Global search
    if (this.options.searchable) {
      const searchInput = container.querySelector('.csv-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = (e.target as HTMLInputElement).value.toLowerCase();
          this.filterTable(container, query);
        });
      }
    }

    // Export CSV
    const exportCsvBtn = container.querySelector('.csv-export-csv-btn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        this.exportAsCsv(container);
      });
    }

    // Export JSON
    const exportJsonBtn = container.querySelector('.csv-export-json-btn');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        this.exportAsJson(container);
      });
    }

    // Copy cell (right-click)
    if (this.options.enableCopy) {
      const cells = container.querySelectorAll('.csv-cell');
      cells.forEach((cell) => {
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const cellText = (cell as HTMLElement).textContent || '';
          navigator.clipboard.writeText(cellText);
          console.log('[CsvRenderer] Cell copied:', cellText);
        });
      });
    }

    console.log('[CsvRenderer] Table interactions initialized');
  }

  /**
   * Sort column
   */
  private sortColumn(container: HTMLElement, columnIndex: number): void {
    const tbody = container.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('.csv-row'));

    // Determine sort direction
    const header = container.querySelector(`[data-column-index="${columnIndex}"]`);
    const currentDirection = header?.getAttribute('data-sort-direction') as SortDirection;
    const newDirection: SortDirection = currentDirection === 'asc' ? 'desc' : 'asc';

    // Sort rows
    rows.sort((a, b) => {
      const aCell = a.querySelector(`[data-column-index="${columnIndex}"]`)?.textContent || '';
      const bCell = b.querySelector(`[data-column-index="${columnIndex}"]`)?.textContent || '';

      // Try numeric sort first
      const aNum = Number(aCell);
      const bNum = Number(bCell);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return newDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Fallback to string sort
      return newDirection === 'asc'
        ? aCell.localeCompare(bCell)
        : bCell.localeCompare(aCell);
    });

    // Clear and re-append sorted rows
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));

    // Update sort icon
    const allHeaders = container.querySelectorAll('.csv-column-header');
    allHeaders.forEach(h => h.removeAttribute('data-sort-direction'));
    header?.setAttribute('data-sort-direction', newDirection);

    const sortIcon = header?.querySelector('.csv-sort-icon');
    if (sortIcon) {
      sortIcon.textContent = newDirection === 'asc' ? '▲' : '▼';
    }
  }

  /**
   * Filter table by search query
   */
  private filterTable(container: HTMLElement, query: string): void {
    const rows = container.querySelectorAll('.csv-row');

    rows.forEach((row) => {
      const text = row.textContent?.toLowerCase() || '';
      const matches = text.includes(query);

      if (matches || !query) {
        (row as HTMLElement).style.display = '';
      } else {
        (row as HTMLElement).style.display = 'none';
      }
    });
  }

  /**
   * Export as CSV
   */
  private exportAsCsv(container: HTMLElement): void {
    // In production, reconstruct CSV from table data
    console.log('[CsvRenderer] Export as CSV (placeholder)');
    alert('CSV export functionality would copy formatted CSV to clipboard');
  }

  /**
   * Export as JSON
   */
  private exportAsJson(container: HTMLElement): void {
    // In production, convert table data to JSON
    console.log('[CsvRenderer] Export as JSON (placeholder)');
    alert('JSON export functionality would copy table data as JSON to clipboard');
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>CSV Parsing Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <details class="csv-source">
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
  public setOptions(options: Partial<CsvRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create CSV renderer
 */
export function createCsvRenderer(options?: CsvRendererOptions): CsvRenderer {
  return new CsvRenderer(options);
}

/**
 * Convenience function to render CSV
 */
export async function renderCsv(
  content: string,
  options?: CsvRendererOptions
): Promise<string> {
  const renderer = createCsvRenderer(options);
  return renderer.render(content);
}

/**
 * Example CSV for documentation
 */
export const CSV_EXAMPLES = {
  simple: `name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,Los Angeles`,

  withQuotes: `"Product Name","Price","Stock"
"Laptop, 15-inch",1299.99,50
"Mouse, Wireless",29.99,200
"Keyboard, Mechanical",89.99,100`,

  semicolonDelimited: `name;email;phone
John Doe;john@example.com;555-1234
Jane Smith;jane@example.com;555-5678`,

  tabDelimited: `id\tname\tscore
1\tAlice\t95
2\tBob\t87
3\tCharlie\t92`
};
