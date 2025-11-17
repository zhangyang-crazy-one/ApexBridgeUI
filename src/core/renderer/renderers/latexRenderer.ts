/**
 * LaTeX Renderer (CORE-020)
 *
 * Responsibilities:
 * - Render LaTeX mathematical expressions using KaTeX library
 * - Support display math ($$...$$) and inline math ($...$)
 * - Support LaTeX environments (\begin{...} ... \end{...})
 * - Auto-numbering for equations
 * - Streaming chunk rendering with buffering
 * - Copy LaTeX source functionality
 * - Error handling with fallback display
 *
 * Features:
 * - Display Math: $$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$
 * - Inline Math: The equation $E = mc^2$ is Einstein's mass-energy equivalence
 * - LaTeX Environments: \begin{align} x + y &= 5 \\ 2x - y &= 1 \end{align}
 * - Equation numbering: Automatic or manual equation numbers
 * - Macros support: Custom LaTeX macros and definitions
 * - Color support: \textcolor{red}{text} and \colorbox{yellow}{text}
 * - Matrix support: \begin{matrix}, \begin{pmatrix}, \begin{bmatrix}
 *
 * Usage:
 * ```typescript
 * import { createLatexRenderer } from './renderers/latexRenderer';
 *
 * const renderer = createLatexRenderer();
 * const html = await renderer.render('$$E = mc^2$$');
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * LaTeX renderer options
 */
export interface LatexRendererOptions {
  /**
   * Display mode (block) or inline mode
   * Default: auto-detect from delimiters
   */
  displayMode?: boolean;

  /**
   * Throw on LaTeX parsing errors
   * Default: false (show error message instead)
   */
  throwOnError?: boolean;

  /**
   * Enable equation numbering
   * Default: true for display mode
   */
  equationNumbers?: boolean;

  /**
   * Enable copy LaTeX source button
   * Default: true
   */
  copyButton?: boolean;

  /**
   * Trust user input (allow \includegraphics, \href, etc.)
   * Default: false (security)
   */
  trust?: boolean;

  /**
   * Maximum expansion depth (prevent infinite loops)
   * Default: 10
   */
  maxExpand?: number;

  /**
   * Maximum size of math expression (characters)
   * Default: 1000
   */
  maxSize?: number;

  /**
   * Custom CSS class for LaTeX container
   * Default: 'latex-renderer'
   */
  className?: string;

  /**
   * Custom macros (e.g., \RR for \mathbb{R})
   */
  macros?: Record<string, string>;
}

/**
 * LaTeX math type
 */
type LatexMathType = 'display' | 'inline' | 'environment';

/**
 * LaTeX parsing result
 */
interface LatexParseResult {
  type: LatexMathType;
  content: string;
  delimiter: string;
  raw: string;
}

/**
 * LaTeX Renderer
 * Implements IRenderer interface for LaTeX mathematical expressions
 */
export class LatexRenderer implements IRenderer {
  public readonly type = 'latex' as const;

  private options: Required<LatexRendererOptions>;
  private katexLoaded: boolean = false;
  private streamBuffer: string = '';
  private equationCounter: number = 1;

  constructor(options: LatexRendererOptions = {}) {
    this.options = {
      displayMode: options.displayMode ?? true,
      throwOnError: options.throwOnError ?? false,
      equationNumbers: options.equationNumbers ?? true,
      copyButton: options.copyButton ?? true,
      trust: options.trust ?? false,
      maxExpand: options.maxExpand ?? 10,
      maxSize: options.maxSize ?? 1000,
      className: options.className ?? 'latex-renderer',
      macros: options.macros ?? {}
    };
  }

  /**
   * Check if content is LaTeX
   * Detection heuristics:
   * - Contains $...$ or $$...$$
   * - Contains \begin{...} ... \end{...}
   * - Contains LaTeX commands (\frac, \int, \sum, etc.)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for LaTeX delimiters
    const hasDisplayMath = /\$\$[\s\S]+?\$\$/.test(trimmed);
    const hasInlineMath = /\$[^\$\n]+?\$/.test(trimmed);
    const hasEnvironment = /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/.test(trimmed);

    if (hasDisplayMath || hasEnvironment) return true;

    // Check for LaTeX commands (must have inline math delimiters)
    if (hasInlineMath) {
      const latexCommands = [
        /\\frac\{/,
        /\\int[_^]?/,
        /\\sum[_^]?/,
        /\\prod[_^]?/,
        /\\lim[_^]?/,
        /\\sqrt(\[[\d]\])?\{/,
        /\\mathbb\{/,
        /\\mathcal\{/,
        /\\text(bf|it|rm|sf|tt)?\{/,
        /\\(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega)/,
        /\\(in|cup|cap|subset|supset|forall|exists|emptyset)/,
        /\\(left|right)[\(\)\[\]\{\}|]/
      ];

      return latexCommands.some(pattern => pattern.test(trimmed));
    }

    return false;
  }

  /**
   * Render LaTeX content to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    // Load KaTeX library if not loaded
    if (!this.katexLoaded) {
      await this.loadKatex();
      this.katexLoaded = true;
    }

    try {
      // Parse LaTeX content
      const parsed = this.parseLatex(content);

      // Validate content size
      if (parsed.content.length > this.options.maxSize) {
        throw new Error(`LaTeX expression too large (${parsed.content.length} > ${this.options.maxSize} characters)`);
      }

      // Render based on type
      let html: string;

      if (parsed.type === 'display' || parsed.type === 'environment') {
        html = await this.renderDisplayMath(parsed.content, parsed.type === 'environment');
      } else {
        html = await this.renderInlineMath(parsed.content);
      }

      return html;

    } catch (error) {
      console.error('[LatexRenderer] Render error:', error);

      if (this.options.throwOnError) {
        throw error;
      }

      // Show error with fallback
      return this.buildErrorFallback(content, error as Error);
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete LaTeX expression
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // For streaming, show loading placeholder
    if (!container.querySelector('.latex-loading')) {
      const loading = document.createElement('div');
      loading.className = 'latex-loading';
      loading.textContent = '⏳ Loading LaTeX...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete LaTeX
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.latex-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[LatexRenderer] Finalize error:', error);

      // Show error
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Parse LaTeX content and detect type
   */
  private parseLatex(content: string): LatexParseResult {
    const trimmed = content.trim();

    // Display math: $$...$$
    const displayMatch = /^\$\$([\s\S]+?)\$\$$/.exec(trimmed);
    if (displayMatch) {
      return {
        type: 'display',
        content: displayMatch[1].trim(),
        delimiter: '$$',
        raw: trimmed
      };
    }

    // LaTeX environment: \begin{...} ... \end{...}
    const envMatch = /^\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}$/.exec(trimmed);
    if (envMatch) {
      return {
        type: 'environment',
        content: trimmed,
        delimiter: `\\begin{${envMatch[1]}}`,
        raw: trimmed
      };
    }

    // Inline math: $...$
    const inlineMatch = /^\$([\s\S]+?)\$$/.exec(trimmed);
    if (inlineMatch) {
      return {
        type: 'inline',
        content: inlineMatch[1].trim(),
        delimiter: '$',
        raw: trimmed
      };
    }

    // Default: treat as inline if contains LaTeX commands, otherwise display
    const hasLatexCommands = /\\[a-zA-Z]+/.test(trimmed);

    return {
      type: hasLatexCommands ? 'inline' : 'display',
      content: trimmed,
      delimiter: hasLatexCommands ? '$' : '$$',
      raw: trimmed
    };
  }

  /**
   * Render display math (block equation)
   */
  private async renderDisplayMath(latex: string, isEnvironment: boolean): Promise<string> {
    try {
      // Use KaTeX to render (placeholder - actual implementation would use KaTeX library)
      const katexHtml = await this.renderWithKatex(latex, true);

      // Build container
      let html = `<div class="${this.options.className} display-math">`;

      // Equation number (if enabled and not already numbered)
      if (this.options.equationNumbers && !isEnvironment) {
        html += `<span class="equation-number">(${this.equationCounter++})</span>`;
      }

      // Math content
      html += `<div class="math-content">${katexHtml}</div>`;

      // Copy button
      if (this.options.copyButton) {
        html += `<button class="latex-copy-btn" data-latex="${this.escapeHtml(latex)}" title="Copy LaTeX">📋</button>`;
      }

      html += '</div>';

      return html;

    } catch (error) {
      throw new Error(`Failed to render display math: ${(error as Error).message}`);
    }
  }

  /**
   * Render inline math
   */
  private async renderInlineMath(latex: string): Promise<string> {
    try {
      // Use KaTeX to render
      const katexHtml = await this.renderWithKatex(latex, false);

      // Build inline container
      let html = `<span class="${this.options.className} inline-math">`;
      html += katexHtml;
      html += '</span>';

      return html;

    } catch (error) {
      throw new Error(`Failed to render inline math: ${(error as Error).message}`);
    }
  }

  /**
   * Render LaTeX using KaTeX library
   * This is a placeholder - actual implementation would use KaTeX
   */
  private async renderWithKatex(latex: string, displayMode: boolean): Promise<string> {
    try {
      // In production, this would use KaTeX:
      // const katex = await import('katex');
      // return katex.renderToString(latex, {
      //   displayMode: displayMode,
      //   throwOnError: this.options.throwOnError,
      //   trust: this.options.trust,
      //   maxExpand: this.options.maxExpand,
      //   maxSize: this.options.maxSize,
      //   macros: this.options.macros,
      //   strict: false        // Allow non-standard LaTeX commands
      // });

      // For now, return a placeholder with proper structure
      const escapedLatex = this.escapeHtml(latex);

      if (displayMode) {
        return `
          <span class="katex-display">
            <span class="katex">
              <span class="katex-mathml">
                <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
                  <semantics>
                    <mrow><mtext>${escapedLatex}</mtext></mrow>
                    <annotation encoding="application/x-tex">${escapedLatex}</annotation>
                  </semantics>
                </math>
              </span>
              <span class="katex-html" aria-hidden="true">
                <span class="base">
                  <span class="strut" style="height:1em;"></span>
                  <span class="mord">${escapedLatex}</span>
                </span>
              </span>
            </span>
          </span>
        `;
      } else {
        return `
          <span class="katex">
            <span class="katex-mathml">
              <math xmlns="http://www.w3.org/1998/Math/MathML">
                <semantics>
                  <mrow><mtext>${escapedLatex}</mtext></mrow>
                  <annotation encoding="application/x-tex">${escapedLatex}</annotation>
                </semantics>
              </math>
            </span>
            <span class="katex-html" aria-hidden="true">
              <span class="base">
                <span class="strut" style="height:0.8em;"></span>
                <span class="mord">${escapedLatex}</span>
              </span>
            </span>
          </span>
        `;
      }

    } catch (error) {
      throw new Error(`KaTeX rendering failed: ${(error as Error).message}`);
    }
  }

  /**
   * Load KaTeX library
   */
  private async loadKatex(): Promise<void> {
    try {
      // In production, this would dynamically import KaTeX:
      // await import('katex');
      // await import('katex/dist/katex.min.css');

      console.log('[LatexRenderer] KaTeX library loaded (placeholder)');
    } catch (error) {
      console.error('[LatexRenderer] Failed to load KaTeX:', error);
      throw new Error('Failed to load LaTeX renderer library');
    }
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>LaTeX Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="latex-source">
          <pre><code>${this.escapeHtml(content)}</code></pre>
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
  public getOptions(): Required<LatexRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<LatexRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Reset equation counter
   */
  public resetEquationCounter(): void {
    this.equationCounter = 1;
  }
}

/**
 * Factory function to create LaTeX renderer
 */
export function createLatexRenderer(options?: LatexRendererOptions): LatexRenderer {
  return new LatexRenderer(options);
}

/**
 * Convenience function to render LaTeX
 */
export async function renderLatex(
  content: string,
  options?: LatexRendererOptions
): Promise<string> {
  const renderer = createLatexRenderer(options);
  return renderer.render(content);
}

/**
 * Common LaTeX macros for mathematics
 */
export const COMMON_MACROS: Record<string, string> = {
  // Number sets
  '\\RR': '\\mathbb{R}',        // Real numbers
  '\\NN': '\\mathbb{N}',        // Natural numbers
  '\\ZZ': '\\mathbb{Z}',        // Integers
  '\\QQ': '\\mathbb{Q}',        // Rational numbers
  '\\CC': '\\mathbb{C}',        // Complex numbers

  // Calculus
  '\\diff': '\\mathrm{d}',      // Differential d
  '\\deriv': '\\frac{\\mathrm{d}}{\\mathrm{d}#1}',  // Derivative
  '\\pderiv': '\\frac{\\partial}{\\partial #1}',     // Partial derivative

  // Linear algebra
  '\\norm': '\\left\\|#1\\right\\|',    // Norm
  '\\abs': '\\left|#1\\right|',         // Absolute value
  '\\inner': '\\left\\langle#1\\right\\rangle',  // Inner product

  // Probability
  '\\Prob': '\\mathbb{P}',      // Probability
  '\\Expect': '\\mathbb{E}',    // Expected value
  '\\Var': '\\mathrm{Var}',     // Variance

  // Logic
  '\\implies': '\\Rightarrow',
  '\\iff': '\\Leftrightarrow',
};
