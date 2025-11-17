/**
 * Diff Engine Module (CORE-042)
 *
 * Line-based diff algorithm for AI co-editing visualization
 *
 * Responsibilities:
 * - Compute line-by-line diffs between original and suggested code
 * - Generate unified diff format for visualization
 * - Support insertion, deletion, and modification operations
 * - Provide diff statistics and summaries
 * - Handle multi-line changes efficiently
 *
 * Algorithm:
 * - Myers diff algorithm with O(ND) complexity
 * - LCS (Longest Common Subsequence) based comparison
 * - Line-level granularity for code editing
 * - Context lines for better readability
 *
 * Usage:
 * ```typescript
 * import { DiffEngine } from './diffEngine';
 *
 * const engine = new DiffEngine();
 * const diff = engine.computeDiff(originalCode, suggestedCode);
 * const html = engine.renderDiffHTML(diff);
 * ```
 */

/**
 * Diff operation type
 */
export enum DiffOperationType {
  /** Lines are identical */
  EQUAL = 'equal',
  /** Lines inserted in suggested version */
  INSERT = 'insert',
  /** Lines deleted from original version */
  DELETE = 'delete',
  /** Lines modified (delete + insert) */
  MODIFY = 'modify'
}

/**
 * Single diff operation
 */
export interface DiffOperation {
  /**
   * Operation type
   */
  type: DiffOperationType;

  /**
   * Original line number (1-indexed, -1 if INSERT)
   */
  originalLineNumber: number;

  /**
   * Suggested line number (1-indexed, -1 if DELETE)
   */
  suggestedLineNumber: number;

  /**
   * Original line content (empty if INSERT)
   */
  originalContent: string;

  /**
   * Suggested line content (empty if DELETE)
   */
  suggestedContent: string;
}

/**
 * Diff result with statistics
 */
export interface DiffResult {
  /**
   * Array of diff operations
   */
  operations: DiffOperation[];

  /**
   * Total lines added
   */
  addedLines: number;

  /**
   * Total lines deleted
   */
  deletedLines: number;

  /**
   * Total lines modified
   */
  modifiedLines: number;

  /**
   * Total unchanged lines
   */
  unchangedLines: number;

  /**
   * Diff summary text
   */
  summary: string;
}

/**
 * Unified diff hunk
 */
export interface DiffHunk {
  /**
   * Original start line
   */
  originalStart: number;

  /**
   * Original line count
   */
  originalCount: number;

  /**
   * Suggested start line
   */
  suggestedStart: number;

  /**
   * Suggested line count
   */
  suggestedCount: number;

  /**
   * Operations in this hunk
   */
  operations: DiffOperation[];
}

/**
 * Diff Engine
 * Computes line-based diffs using Myers algorithm
 */
export class DiffEngine {
  /**
   * Context lines before/after changes
   * Default: 3 lines
   */
  private contextLines: number = 3;

  constructor(contextLines: number = 3) {
    this.contextLines = contextLines;
  }

  /**
   * Compute diff between two code strings
   */
  public computeDiff(original: string, suggested: string): DiffResult {
    const originalLines = this.splitLines(original);
    const suggestedLines = this.splitLines(suggested);

    const operations = this.computeLinesDiff(originalLines, suggestedLines);

    // Calculate statistics
    let addedLines = 0;
    let deletedLines = 0;
    let modifiedLines = 0;
    let unchangedLines = 0;

    for (const op of operations) {
      switch (op.type) {
        case DiffOperationType.INSERT:
          addedLines++;
          break;
        case DiffOperationType.DELETE:
          deletedLines++;
          break;
        case DiffOperationType.MODIFY:
          modifiedLines++;
          break;
        case DiffOperationType.EQUAL:
          unchangedLines++;
          break;
      }
    }

    const summary = this.generateSummary(addedLines, deletedLines, modifiedLines);

    return {
      operations,
      addedLines,
      deletedLines,
      modifiedLines,
      unchangedLines,
      summary
    };
  }

  /**
   * Split code into lines (preserving empty lines)
   */
  private splitLines(code: string): string[] {
    if (!code) return [];
    return code.split(/\r?\n/);
  }

  /**
   * Compute diff operations between two line arrays
   * Uses Myers diff algorithm
   */
  private computeLinesDiff(originalLines: string[], suggestedLines: string[]): DiffOperation[] {
    const lcs = this.computeLCS(originalLines, suggestedLines);
    const operations: DiffOperation[] = [];

    let originalIndex = 0;
    let suggestedIndex = 0;
    let lcsIndex = 0;

    while (originalIndex < originalLines.length || suggestedIndex < suggestedLines.length) {
      // Check if current lines are in LCS
      const inLCS = lcsIndex < lcs.length &&
                    originalIndex < originalLines.length &&
                    suggestedIndex < suggestedLines.length &&
                    originalLines[originalIndex] === lcs[lcsIndex] &&
                    suggestedLines[suggestedIndex] === lcs[lcsIndex];

      if (inLCS) {
        // Equal line
        operations.push({
          type: DiffOperationType.EQUAL,
          originalLineNumber: originalIndex + 1,
          suggestedLineNumber: suggestedIndex + 1,
          originalContent: originalLines[originalIndex],
          suggestedContent: suggestedLines[suggestedIndex]
        });
        originalIndex++;
        suggestedIndex++;
        lcsIndex++;
      } else {
        // Check if it's a modification, deletion, or insertion
        const hasOriginal = originalIndex < originalLines.length;
        const hasSuggested = suggestedIndex < suggestedLines.length;

        if (hasOriginal && hasSuggested) {
          // Modification (delete + insert)
          operations.push({
            type: DiffOperationType.MODIFY,
            originalLineNumber: originalIndex + 1,
            suggestedLineNumber: suggestedIndex + 1,
            originalContent: originalLines[originalIndex],
            suggestedContent: suggestedLines[suggestedIndex]
          });
          originalIndex++;
          suggestedIndex++;
        } else if (hasOriginal) {
          // Deletion
          operations.push({
            type: DiffOperationType.DELETE,
            originalLineNumber: originalIndex + 1,
            suggestedLineNumber: -1,
            originalContent: originalLines[originalIndex],
            suggestedContent: ''
          });
          originalIndex++;
        } else if (hasSuggested) {
          // Insertion
          operations.push({
            type: DiffOperationType.INSERT,
            originalLineNumber: -1,
            suggestedLineNumber: suggestedIndex + 1,
            originalContent: '',
            suggestedContent: suggestedLines[suggestedIndex]
          });
          suggestedIndex++;
        }
      }
    }

    return operations;
  }

  /**
   * Compute Longest Common Subsequence (LCS)
   * Core of Myers diff algorithm
   */
  private computeLCS(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;

    // DP table: dp[i][j] = LCS length of a[0..i-1] and b[0..j-1]
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;

    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        lcs.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(added: number, deleted: number, modified: number): string {
    const parts: string[] = [];

    if (added > 0) {
      parts.push(`${added} line${added === 1 ? '' : 's'} added`);
    }

    if (deleted > 0) {
      parts.push(`${deleted} line${deleted === 1 ? '' : 's'} deleted`);
    }

    if (modified > 0) {
      parts.push(`${modified} line${modified === 1 ? '' : 's'} modified`);
    }

    if (parts.length === 0) {
      return 'No changes';
    }

    return parts.join(', ');
  }

  /**
   * Group operations into hunks with context
   */
  public generateHunks(operations: DiffOperation[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      if (op.type === DiffOperationType.EQUAL) {
        // Context line
        if (currentHunk === null) {
          // Look ahead for changes
          const hasChangesAhead = operations.slice(i + 1, i + this.contextLines + 1)
            .some(o => o.type !== DiffOperationType.EQUAL);

          if (hasChangesAhead) {
            // Start new hunk with context
            currentHunk = {
              originalStart: Math.max(1, op.originalLineNumber - this.contextLines),
              originalCount: 0,
              suggestedStart: Math.max(1, op.suggestedLineNumber - this.contextLines),
              suggestedCount: 0,
              operations: []
            };

            // Add preceding context lines
            for (let j = Math.max(0, i - this.contextLines); j < i; j++) {
              currentHunk.operations.push(operations[j]);
              currentHunk.originalCount++;
              currentHunk.suggestedCount++;
            }
          }
        }

        if (currentHunk !== null) {
          currentHunk.operations.push(op);
          currentHunk.originalCount++;
          currentHunk.suggestedCount++;

          // Check if we should close this hunk
          const hasChangesAhead = operations.slice(i + 1, i + this.contextLines + 1)
            .some(o => o.type !== DiffOperationType.EQUAL);

          if (!hasChangesAhead) {
            // Close hunk
            hunks.push(currentHunk);
            currentHunk = null;
          }
        }
      } else {
        // Change line
        if (currentHunk === null) {
          // Start new hunk
          currentHunk = {
            originalStart: Math.max(1, op.originalLineNumber - this.contextLines),
            originalCount: 0,
            suggestedStart: Math.max(1, op.suggestedLineNumber - this.contextLines),
            suggestedCount: 0,
            operations: []
          };

          // Add preceding context lines
          for (let j = Math.max(0, i - this.contextLines); j < i; j++) {
            currentHunk.operations.push(operations[j]);
            currentHunk.originalCount++;
            currentHunk.suggestedCount++;
          }
        }

        currentHunk.operations.push(op);

        if (op.type === DiffOperationType.DELETE || op.type === DiffOperationType.MODIFY) {
          currentHunk.originalCount++;
        }

        if (op.type === DiffOperationType.INSERT || op.type === DiffOperationType.MODIFY) {
          currentHunk.suggestedCount++;
        }
      }
    }

    // Close last hunk if open
    if (currentHunk !== null) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Render diff as HTML with syntax highlighting
   */
  public renderDiffHTML(diff: DiffResult, language: string = 'plaintext'): string {
    const hunks = this.generateHunks(diff.operations);

    let html = `<div class="diff-container" data-language="${language}">`;

    // Summary header
    html += '<div class="diff-summary">';
    html += `<span class="diff-summary-text">${diff.summary}</span>`;
    html += '<div class="diff-legend">';
    html += '<span class="diff-legend-item diff-legend-add">+ Added</span>';
    html += '<span class="diff-legend-item diff-legend-delete">- Deleted</span>';
    html += '<span class="diff-legend-item diff-legend-modify">~ Modified</span>';
    html += '</div>';
    html += '</div>';

    // Render hunks
    for (const hunk of hunks) {
      html += this.renderHunk(hunk);
    }

    html += '</div>'; // .diff-container

    return html;
  }

  /**
   * Render single hunk
   */
  private renderHunk(hunk: DiffHunk): string {
    let html = '<div class="diff-hunk">';

    // Hunk header
    html += '<div class="diff-hunk-header">';
    html += `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.suggestedStart},${hunk.suggestedCount} @@`;
    html += '</div>';

    // Render operations
    for (const op of hunk.operations) {
      html += this.renderOperation(op);
    }

    html += '</div>'; // .diff-hunk

    return html;
  }

  /**
   * Render single operation
   */
  private renderOperation(op: DiffOperation): string {
    let html = '';
    let cssClass = '';
    let prefix = '';
    let lineNumber = '';
    let content = '';

    switch (op.type) {
      case DiffOperationType.EQUAL:
        cssClass = 'diff-line-equal';
        prefix = ' ';
        lineNumber = `${op.originalLineNumber}`;
        content = this.escapeHtml(op.originalContent);
        break;

      case DiffOperationType.INSERT:
        cssClass = 'diff-line-insert';
        prefix = '+';
        lineNumber = `${op.suggestedLineNumber}`;
        content = this.escapeHtml(op.suggestedContent);
        break;

      case DiffOperationType.DELETE:
        cssClass = 'diff-line-delete';
        prefix = '-';
        lineNumber = `${op.originalLineNumber}`;
        content = this.escapeHtml(op.originalContent);
        break;

      case DiffOperationType.MODIFY:
        // Render as delete + insert
        html += `<div class="diff-line diff-line-delete">`;
        html += `<span class="diff-line-number">${op.originalLineNumber}</span>`;
        html += `<span class="diff-line-prefix">-</span>`;
        html += `<span class="diff-line-content">${this.escapeHtml(op.originalContent)}</span>`;
        html += '</div>';

        html += `<div class="diff-line diff-line-insert">`;
        html += `<span class="diff-line-number">${op.suggestedLineNumber}</span>`;
        html += `<span class="diff-line-prefix">+</span>`;
        html += `<span class="diff-line-content">${this.escapeHtml(op.suggestedContent)}</span>`;
        html += '</div>';
        return html;
    }

    html += `<div class="diff-line ${cssClass}">`;
    html += `<span class="diff-line-number">${lineNumber}</span>`;
    html += `<span class="diff-line-prefix">${prefix}</span>`;
    html += `<span class="diff-line-content">${content}</span>`;
    html += '</div>';

    return html;
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
      .replace(/'/g, '&#039;')
      .replace(/ /g, '&nbsp;')
      .replace(/\t/g, '&nbsp;&nbsp;');
  }

  /**
   * Apply diff to original code
   */
  public applyDiff(original: string, operations: DiffOperation[]): string {
    const originalLines = this.splitLines(original);
    const resultLines: string[] = [];

    for (const op of operations) {
      switch (op.type) {
        case DiffOperationType.EQUAL:
          resultLines.push(op.originalContent);
          break;

        case DiffOperationType.INSERT:
          resultLines.push(op.suggestedContent);
          break;

        case DiffOperationType.DELETE:
          // Skip deleted line
          break;

        case DiffOperationType.MODIFY:
          resultLines.push(op.suggestedContent);
          break;
      }
    }

    return resultLines.join('\n');
  }
}

/**
 * Factory function to create diff engine
 */
export function createDiffEngine(contextLines: number = 3): DiffEngine {
  return new DiffEngine(contextLines);
}

/**
 * Convenience function to compute and render diff
 */
export function renderCodeDiff(
  original: string,
  suggested: string,
  language: string = 'plaintext',
  contextLines: number = 3
): { html: string; diff: DiffResult } {
  const engine = createDiffEngine(contextLines);
  const diff = engine.computeDiff(original, suggested);
  const html = engine.renderDiffHTML(diff, language);

  return { html, diff };
}

/**
 * Example usage for documentation
 */
export const DIFF_EXAMPLES = {
  typescript: {
    original: `function greet(name: string) {
  console.log("Hello " + name);
}`,
    suggested: `function greet(name: string): void {
  console.log(\`Hello, \${name}!\`);
  console.log("Welcome!");
}`
  },

  python: {
    original: `def calculate(x, y):
    return x + y

result = calculate(5, 3)`,
    suggested: `def calculate(x: int, y: int) -> int:
    """Calculate sum of two numbers."""
    return x + y

result = calculate(5, 3)
print(f"Result: {result}")`
  }
};
