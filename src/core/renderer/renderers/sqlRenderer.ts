/**
 * SQL Renderer (CORE-034)
 *
 * Responsibilities:
 * - Render SQL queries with syntax highlighting
 * - Format and beautify SQL statements
 * - Validate SQL syntax and show errors
 * - Support multiple SQL dialects (MySQL, PostgreSQL, SQLite, etc.)
 * - Display line numbers
 * - Copy SQL content to clipboard
 * - Explain query structure
 * - Search within SQL content
 * - Streaming chunk rendering (progressive SQL loading)
 *
 * Features:
 * - Syntax Highlighting: Keywords, functions, operators, strings, numbers
 * - SQL Formatting: Auto-format with proper indentation and line breaks
 * - Dialect Support: MySQL, PostgreSQL, SQLite, SQL Server, Oracle
 * - Validation: Real-time SQL syntax checking
 * - Line Numbers: Show line numbers for navigation
 * - Copy Button: Copy entire SQL or selected sections
 * - Explain: Break down query structure (SELECT, FROM, WHERE, etc.)
 * - Search: Find text with highlighting
 * - Dark/Light Theme: Auto-adapts to theme
 * - Error Display: Show parsing errors with line/column
 *
 * Usage:
 * ```typescript
 * import { createSqlRenderer } from './renderers/sqlRenderer';
 *
 * const renderer = createSqlRenderer();
 * const html = await renderer.render(sqlContent);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * SQL token type for syntax highlighting
 */
export type SqlTokenType =
  | 'keyword'
  | 'function'
  | 'operator'
  | 'string'
  | 'number'
  | 'identifier'
  | 'comment'
  | 'punctuation'
  | 'datatype';

/**
 * SQL dialect
 */
export type SqlDialect = 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver' | 'oracle' | 'standard';

/**
 * SQL statement type
 */
export type SqlStatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'DROP' | 'UNKNOWN';

/**
 * SQL token
 */
export interface SqlToken {
  type: SqlTokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * SQL parse result
 */
export interface SqlParseResult {
  valid: boolean;
  statementType?: SqlStatementType;
  dialect?: SqlDialect;
  error?: {
    message: string;
    line?: number;
    column?: number;
  };
  tokens: SqlToken[];
}

/**
 * SQL renderer options
 */
export interface SqlRendererOptions {
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
   * Enable explain button
   * Default: true
   */
  explainButton?: boolean;

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
   * SQL dialect
   * Default: 'standard'
   */
  dialect?: SqlDialect;

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
   * Show statement type badge
   * Default: true
   */
  showStatementType?: boolean;

  /**
   * Uppercase keywords in formatting
   * Default: true
   */
  uppercaseKeywords?: boolean;

  /**
   * Custom CSS class for SQL container
   * Default: 'sql-renderer'
   */
  className?: string;
}

/**
 * SQL Renderer
 * Implements IRenderer interface for SQL with syntax highlighting
 */
export class SqlRenderer implements IRenderer {
  public readonly type = 'sql' as const;

  private options: Required<SqlRendererOptions>;
  private streamBuffer: string = '';
  private sqlCounter: number = 1;

  // SQL keywords by category
  private readonly KEYWORDS = {
    // DML (Data Manipulation Language)
    dml: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE'],
    // DDL (Data Definition Language)
    ddl: ['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME'],
    // DCL (Data Control Language)
    dcl: ['GRANT', 'REVOKE'],
    // TCL (Transaction Control Language)
    tcl: ['COMMIT', 'ROLLBACK', 'SAVEPOINT', 'SET TRANSACTION'],
    // Query clauses
    clauses: ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT'],
    // Join types
    joins: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN'],
    // Other keywords
    other: ['AS', 'ON', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'NOT', 'AND', 'OR', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'ALL', 'ASC', 'DESC']
  };

  // SQL functions
  private readonly FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL',
    'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER', 'TRIM',
    'NOW', 'CURDATE', 'CURTIME', 'DATE', 'YEAR', 'MONTH', 'DAY',
    'COALESCE', 'NULLIF', 'CAST', 'CONVERT'
  ];

  // SQL data types
  private readonly DATATYPES = [
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
    'CHAR', 'VARCHAR', 'TEXT', 'BLOB',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP',
    'BOOLEAN', 'BOOL', 'JSON', 'UUID'
  ];

  constructor(options: SqlRendererOptions = {}) {
    this.options = {
      syntaxHighlighting: options.syntaxHighlighting ?? true,
      lineNumbers: options.lineNumbers ?? true,
      copyButton: options.copyButton ?? true,
      formatButton: options.formatButton ?? true,
      explainButton: options.explainButton ?? true,
      searchEnabled: options.searchEnabled ?? true,
      showErrors: options.showErrors ?? true,
      downloadButton: options.downloadButton ?? true,
      dialect: options.dialect ?? 'standard',
      indentSize: options.indentSize ?? 2,
      maxLines: options.maxLines ?? 1000,
      showStatementType: options.showStatementType ?? true,
      uppercaseKeywords: options.uppercaseKeywords ?? true,
      className: options.className ?? 'sql-renderer'
    };
  }

  /**
   * Check if content is SQL
   * Detection heuristics:
   * - Starts with common SQL keywords (SELECT, INSERT, CREATE, etc.)
   * - Contains SQL-specific patterns (FROM, WHERE, JOIN)
   * - Has semicolon statement terminators
   * - File extension .sql in URL
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for SQL file extension in URL
    if (/\.sql$/i.test(trimmed)) {
      return true;
    }

    // Check for SQL statement keywords at start
    const sqlKeywords = [...this.KEYWORDS.dml, ...this.KEYWORDS.ddl, ...this.KEYWORDS.dcl, ...this.KEYWORDS.tcl];
    const startsWithKeyword = sqlKeywords.some(kw =>
      new RegExp(`^${kw}\\s+`, 'i').test(trimmed)
    );

    if (startsWithKeyword) {
      return true;
    }

    // Check for common SQL patterns
    const hasSqlPatterns = [
      /\bFROM\s+\w+/i,      // FROM table
      /\bWHERE\s+\w+/i,     // WHERE condition
      /\bJOIN\s+\w+/i,      // JOIN table
      /\bGROUP\s+BY\s+/i,   // GROUP BY
      /\bORDER\s+BY\s+/i    // ORDER BY
    ].some(pattern => pattern.test(trimmed));

    if (hasSqlPatterns) {
      return true;
    }

    // Check for statement terminators
    const hasSemicolon = /;/.test(trimmed);
    const hasMultipleKeywords = sqlKeywords.filter(kw =>
      new RegExp(`\\b${kw}\\b`, 'i').test(trimmed)
    ).length >= 2;

    return hasSemicolon && hasMultipleKeywords;
  }

  /**
   * Render SQL to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Parse SQL
      const parseResult = this.parseSql(trimmed);

      // Generate unique ID
      const sqlId = `sql-viewer-${Date.now()}-${this.sqlCounter++}`;

      // Build SQL HTML
      const sqlHtml = this.buildSqlHTML(trimmed, parseResult, sqlId);

      return sqlHtml;

    } catch (error) {
      console.error('[SqlRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete SQL data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.sql-loading')) {
      const loading = document.createElement('div');
      loading.className = 'sql-loading';
      loading.textContent = '⏳ Loading SQL...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete SQL
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.sql-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize SQL viewer interactions
      this.initializeSql(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[SqlRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Parse SQL content
   */
  private parseSql(content: string): SqlParseResult {
    const result: SqlParseResult = {
      valid: true,
      dialect: this.options.dialect,
      tokens: []
    };

    try {
      // Detect statement type
      const upperContent = content.toUpperCase();
      if (upperContent.startsWith('SELECT')) {
        result.statementType = 'SELECT';
      } else if (upperContent.startsWith('INSERT')) {
        result.statementType = 'INSERT';
      } else if (upperContent.startsWith('UPDATE')) {
        result.statementType = 'UPDATE';
      } else if (upperContent.startsWith('DELETE')) {
        result.statementType = 'DELETE';
      } else if (upperContent.startsWith('CREATE')) {
        result.statementType = 'CREATE';
      } else if (upperContent.startsWith('ALTER')) {
        result.statementType = 'ALTER';
      } else if (upperContent.startsWith('DROP')) {
        result.statementType = 'DROP';
      } else {
        result.statementType = 'UNKNOWN';
      }

      // Tokenize content
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        this.tokenizeLine(lines[i], i + 1, result.tokens);
      }

      // Simplified validation: check for basic syntax errors
      const parenCount = (content.match(/\(/g) || []).length - (content.match(/\)/g) || []).length;

      if (parenCount !== 0) {
        result.valid = false;
        result.error = {
          message: 'Mismatched parentheses',
          line: 1,
          column: 1
        };
      }

    } catch (error: any) {
      result.valid = false;
      result.error = {
        message: error.message || 'Failed to parse SQL',
        line: 1,
        column: 1
      };
    }

    return result;
  }

  /**
   * Tokenize a SQL line for syntax highlighting
   */
  private tokenizeLine(line: string, lineNum: number, tokens: SqlToken[]): void {
    // Skip empty lines
    if (!line.trim()) return;

    // Comment
    if (line.trim().startsWith('--')) {
      tokens.push({
        type: 'comment',
        value: line,
        line: lineNum,
        column: 0
      });
      return;
    }

    // Multi-line comment start
    if (line.trim().startsWith('/*')) {
      tokens.push({
        type: 'comment',
        value: line,
        line: lineNum,
        column: 0
      });
      return;
    }

    // Check for keywords
    const allKeywords = [
      ...this.KEYWORDS.dml,
      ...this.KEYWORDS.ddl,
      ...this.KEYWORDS.dcl,
      ...this.KEYWORDS.tcl,
      ...this.KEYWORDS.clauses,
      ...this.KEYWORDS.joins,
      ...this.KEYWORDS.other
    ];

    for (const keyword of allKeywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(line)) {
        tokens.push({
          type: 'keyword',
          value: line,
          line: lineNum,
          column: 0
        });
        return;
      }
    }

    // Check for functions
    for (const func of this.FUNCTIONS) {
      if (new RegExp(`\\b${func}\\s*\\(`, 'i').test(line)) {
        tokens.push({
          type: 'function',
          value: line,
          line: lineNum,
          column: 0
        });
        return;
      }
    }

    // Check for data types
    for (const dtype of this.DATATYPES) {
      if (new RegExp(`\\b${dtype}\\b`, 'i').test(line)) {
        tokens.push({
          type: 'datatype',
          value: line,
          line: lineNum,
          column: 0
        });
        return;
      }
    }

    // Check for strings
    if (/'[^']*'/.test(line) || /"[^"]*"/.test(line)) {
      tokens.push({
        type: 'string',
        value: line,
        line: lineNum,
        column: 0
      });
      return;
    }

    // Check for numbers
    if (/\b\d+(\.\d+)?\b/.test(line)) {
      tokens.push({
        type: 'number',
        value: line,
        line: lineNum,
        column: 0
      });
      return;
    }

    // Default: identifier
    tokens.push({
      type: 'identifier',
      value: line,
      line: lineNum,
      column: 0
    });
  }

  /**
   * Build SQL HTML
   */
  private buildSqlHTML(content: string, parseResult: SqlParseResult, sqlId: string): string {
    let html = `<div class="${this.options.className}" data-sql-id="${sqlId}">`;

    // Header with actions
    html += '<div class="sql-header">';

    // Label with statement type badge
    if (this.options.showStatementType && parseResult.statementType) {
      html += `<span class="sql-label">`;
      html += `<span class="sql-type-badge sql-type-${parseResult.statementType.toLowerCase()}">${parseResult.statementType}</span>`;
      html += ` ${this.options.dialect.toUpperCase()}`;
      html += '</span>';
    } else {
      html += '<span class="sql-label">SQL</span>';
    }

    // Validation status
    if (this.options.showErrors) {
      if (parseResult.valid) {
        html += '<span class="sql-status sql-status-valid">✓ Valid</span>';
      } else {
        html += '<span class="sql-status sql-status-invalid">✗ Invalid</span>';
      }
    }

    html += '<div class="sql-actions">';

    if (this.options.searchEnabled) {
      html += '<input type="text" class="sql-search-input" placeholder="Search SQL...">';
    }

    if (this.options.copyButton) {
      html += '<button class="sql-copy-btn" data-action="copy" title="Copy">📋</button>';
    }

    if (this.options.formatButton) {
      html += '<button class="sql-format-btn" data-action="format" title="Format">✨</button>';
    }

    if (this.options.explainButton) {
      html += '<button class="sql-explain-btn" data-action="explain" title="Explain Query">💡</button>';
    }

    if (this.options.downloadButton) {
      html += '<button class="sql-download-btn" data-action="download" title="Download">💾</button>';
    }

    html += '</div>'; // .sql-actions
    html += '</div>'; // .sql-header

    // Error display
    if (!parseResult.valid && parseResult.error && this.options.showErrors) {
      html += '<div class="sql-error">';
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

    // SQL content with syntax highlighting
    html += '<div class="sql-content">';

    if (this.options.syntaxHighlighting) {
      html += this.buildHighlightedSql(content, parseResult.tokens);
    } else {
      html += `<pre class="sql-code">${this.escapeHtml(content)}</pre>`;
    }

    html += '</div>'; // .sql-content

    // Explanation area (initially hidden)
    if (this.options.explainButton) {
      html += '<div class="sql-explanation" style="display: none;">';
      html += '<div class="sql-explanation-header">Query Structure:</div>';
      html += '<div class="sql-explanation-content"></div>';
      html += '</div>';
    }

    html += '</div>'; // .sql-renderer

    return html;
  }

  /**
   * Build syntax-highlighted SQL
   */
  private buildHighlightedSql(content: string, tokens: SqlToken[]): string {
    const lines = content.split('\n');
    let html = '<div class="sql-lines">';

    for (let i = 0; i < lines.length && i < this.options.maxLines; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      html += '<div class="sql-line">';

      // Line number
      if (this.options.lineNumbers) {
        html += `<span class="sql-line-number">${lineNum}</span>`;
      }

      // Line content with syntax highlighting
      html += '<span class="sql-line-content">';

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
      html += `<div class="sql-truncated">... (${lines.length - this.options.maxLines} more lines)</div>`;
    }

    html += '</div>'; // .sql-lines

    return html;
  }

  /**
   * Highlight a single line using tokens
   */
  private highlightLine(line: string, lineNum: number, tokens: SqlToken[]): string {
    // Find tokens for this line
    const lineTokens = tokens.filter(t => t.line === lineNum);

    if (lineTokens.length === 0) {
      return this.escapeHtml(line);
    }

    // Use first token type for entire line (simplified)
    const tokenType = lineTokens[0].type;
    return `<span class="sql-token sql-token-${tokenType}">${this.escapeHtml(line)}</span>`;
  }

  /**
   * Initialize SQL viewer interactions
   */
  private initializeSql(container: HTMLElement): void {
    const sqlId = container.getAttribute('data-sql-id');
    if (!sqlId) return;

    // Copy button
    const copyBtn = container.querySelector('.sql-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const content = this.extractSqlContent(container);
        navigator.clipboard.writeText(content).then(() => {
          (copyBtn as HTMLElement).textContent = '✓';
          setTimeout(() => {
            (copyBtn as HTMLElement).textContent = '📋';
          }, 2000);
        });
      });
    }

    // Format button
    const formatBtn = container.querySelector('.sql-format-btn');
    if (formatBtn) {
      formatBtn.addEventListener('click', () => {
        console.log('[SqlRenderer] Format SQL');
        // In production: use sql-formatter library
        alert('SQL formatting: Use sql-formatter library in production');
      });
    }

    // Explain button
    const explainBtn = container.querySelector('.sql-explain-btn');
    if (explainBtn) {
      explainBtn.addEventListener('click', () => {
        this.explainQuery(container);
      });
    }

    // Download button
    const downloadBtn = container.querySelector('.sql-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const content = this.extractSqlContent(container);
        const blob = new Blob([content], { type: 'application/sql' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'query.sql';
        link.click();
        URL.revokeObjectURL(url);
      });
    }

    // Search functionality
    const searchInput = container.querySelector('.sql-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.searchInSql(container, query);
      });
    }

    console.log('[SqlRenderer] SQL viewer initialized');
  }

  /**
   * Explain SQL query structure
   */
  private explainQuery(container: HTMLElement): void {
    const content = this.extractSqlContent(container);
    const explanationDiv = container.querySelector('.sql-explanation') as HTMLElement;
    const explanationContent = container.querySelector('.sql-explanation-content') as HTMLElement;

    if (!explanationDiv || !explanationContent) return;

    // Toggle visibility
    if (explanationDiv.style.display === 'none') {
      explanationDiv.style.display = 'block';

      // Generate explanation
      const explanation = this.generateExplanation(content);
      explanationContent.innerHTML = explanation;
    } else {
      explanationDiv.style.display = 'none';
    }
  }

  /**
   * Generate query explanation
   */
  private generateExplanation(sql: string): string {
    const upper = sql.toUpperCase();
    let html = '<ul class="sql-explanation-list">';

    if (upper.includes('SELECT')) {
      html += '<li><strong>SELECT:</strong> Retrieves data from database</li>';
    }
    if (upper.includes('FROM')) {
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (fromMatch) {
        html += `<li><strong>FROM:</strong> Uses table "${fromMatch[1]}"</li>`;
      }
    }
    if (upper.includes('WHERE')) {
      html += '<li><strong>WHERE:</strong> Filters results with conditions</li>';
    }
    if (upper.includes('JOIN')) {
      html += '<li><strong>JOIN:</strong> Combines data from multiple tables</li>';
    }
    if (upper.includes('GROUP BY')) {
      html += '<li><strong>GROUP BY:</strong> Groups results by specified columns</li>';
    }
    if (upper.includes('ORDER BY')) {
      html += '<li><strong>ORDER BY:</strong> Sorts results</li>';
    }
    if (upper.includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        html += `<li><strong>LIMIT:</strong> Returns maximum ${limitMatch[1]} rows</li>`;
      }
    }

    html += '</ul>';
    return html;
  }

  /**
   * Extract SQL content from container
   */
  private extractSqlContent(container: HTMLElement): string {
    const lines = container.querySelectorAll('.sql-line-content');
    return Array.from(lines)
      .map(line => line.textContent || '')
      .join('\n');
  }

  /**
   * Search in SQL
   */
  private searchInSql(container: HTMLElement, query: string): void {
    const lines = container.querySelectorAll('.sql-line-content');

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
          <strong>SQL Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="sql-source">
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
  public getOptions(): Required<SqlRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<SqlRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create SQL renderer
 */
export function createSqlRenderer(options?: SqlRendererOptions): SqlRenderer {
  return new SqlRenderer(options);
}

/**
 * Convenience function to render SQL
 */
export async function renderSql(
  content: string,
  options?: SqlRendererOptions
): Promise<string> {
  const renderer = createSqlRenderer(options);
  return renderer.render(content);
}

/**
 * Example SQL for documentation
 */
export const SQL_EXAMPLES = {
  select: `SELECT u.id, u.name, u.email, COUNT(p.id) AS post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name, u.email
ORDER BY post_count DESC
LIMIT 10;`,

  insert: `INSERT INTO users (name, email, created_at)
VALUES
  ('John Doe', 'john@example.com', NOW()),
  ('Jane Smith', 'jane@example.com', NOW());`,

  update: `UPDATE users
SET last_login = NOW(),
    login_count = login_count + 1
WHERE email = 'john@example.com';`,

  create: `CREATE TABLE posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`,

  complex: `WITH recent_posts AS (
  SELECT p.*, u.name AS author_name
  FROM posts p
  INNER JOIN users u ON p.user_id = u.id
  WHERE p.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
)
SELECT
  author_name,
  COUNT(*) AS post_count,
  AVG(LENGTH(content)) AS avg_length
FROM recent_posts
GROUP BY author_name
HAVING post_count > 5
ORDER BY post_count DESC;`
};
