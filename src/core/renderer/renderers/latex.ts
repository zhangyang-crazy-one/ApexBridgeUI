/**
 * LaTeX Math Renderer using KaTeX
 *
 * Phase 6: US3-006 - LaTeX renderer using KaTeX (priority 6)
 *
 * Supports mathematical expressions in multiple formats:
 * - Inline math: $...$
 * - Display math: $$...$$
 * - LaTeX environments: \[...\], \(...\), \begin{equation}...\end{equation}, \begin{align}...\end{align}
 *
 * Features:
 * - Fast rendering via KaTeX (faster than MathJax)
 * - High-quality typesetting
 * - Automatic equation numbering (optional)
 * - Copy LaTeX source button
 * - Error handling with fallback to source
 * - Responsive scaling
 */

/**
 * LaTeX expression types
 */
type LatexMode = 'inline' | 'display' | 'equation' | 'align';

/**
 * Detect LaTeX expression mode from content
 */
function detectLatexMode(content: string): LatexMode {
  // Display math: $$...$$
  if (content.match(/^\$\$.+\$\$$/s)) {
    return 'display';
  }

  // Inline math: $...$
  if (content.match(/^\$.+\$$/s)) {
    return 'inline';
  }

  // Display math: \[...\]
  if (content.match(/^\\\[.+\\\]$/s)) {
    return 'display';
  }

  // Inline math: \(...\)
  if (content.match(/^\\\(.+\\\)$/s)) {
    return 'inline';
  }

  // Equation environment
  if (content.match(/\\begin\{equation\}/)) {
    return 'equation';
  }

  // Align environment
  if (content.match(/\\begin\{align\}/)) {
    return 'align';
  }

  // Default to display mode for unrecognized LaTeX
  return 'display';
}

/**
 * Extract LaTeX source from delimiters
 */
function extractLatexSource(content: string, mode: LatexMode): string {
  let source = content.trim();

  switch (mode) {
    case 'inline':
      // Remove $ ... $ or \( ... \)
      source = source.replace(/^\$/, '').replace(/\$$/, '');
      source = source.replace(/^\\\(/, '').replace(/\\\)$/, '');
      break;

    case 'display':
      // Remove $$ ... $$ or \[ ... \]
      source = source.replace(/^\$\$/, '').replace(/\$\$$/, '');
      source = source.replace(/^\\\[/, '').replace(/\\\]$/, '');
      break;

    case 'equation':
    case 'align':
      // Keep environment markers for KaTeX
      break;
  }

  return source.trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate copy button for LaTeX source
 */
function generateCopyButton(source: string): string {
  const escapedSource = escapeHtml(source).replace(/'/g, '&#39;');

  return `
    <button
      class="latex-copy-button"
      onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(source)}'))"
      title="Copy LaTeX source"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M10.5 1.5h-8v11h8v-11z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M13.5 4.5v11h-8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    </button>
  `;
}

/**
 * Render LaTeX math expression with KaTeX
 * Lazy-loads KaTeX library on first use
 */
export async function renderLatex(content: string): Promise<string> {
  // Detect LaTeX mode
  const mode = detectLatexMode(content);

  // Extract LaTeX source
  const source = extractLatexSource(content, mode);

  // Determine display mode
  const displayMode = mode === 'display' || mode === 'equation' || mode === 'align';

  try {
    // Lazy load KaTeX
    const katex = await loadKatex();

    // Render with KaTeX
    const renderedHtml = katex.renderToString(source, {
      displayMode,
      throwOnError: false, // Don't throw errors, display them instead
      errorColor: '#d32f2f',
      strict: false, // Allow some non-standard LaTeX
      trust: false, // Don't trust user input (security)
      macros: {
        // Common macros
        '\\RR': '\\mathbb{R}',
        '\\NN': '\\mathbb{N}',
        '\\ZZ': '\\mathbb{Z}',
        '\\QQ': '\\mathbb{Q}',
        '\\CC': '\\mathbb{C}',
      },
    });

    // Wrap in container with mode-specific styling
    const containerClass = displayMode ? 'latex-display' : 'latex-inline';

    return `
      <div class="latex-container ${containerClass}">
        <div class="latex-content">
          ${renderedHtml}
        </div>
        ${displayMode ? generateCopyButton(source) : ''}
      </div>
    `;
  } catch (error) {
    console.error('[LatexRenderer] KaTeX rendering failed:', error);

    // Fallback: display source with error message
    return `
      <div class="latex-container latex-error">
        <div class="latex-error-message">
          <strong>LaTeX Error:</strong> ${escapeHtml((error as Error).message)}
        </div>
        <pre class="latex-source">${escapeHtml(source)}</pre>
        ${generateCopyButton(source)}
      </div>
    `;
  }
}

/**
 * KaTeX lazy loader
 * Loads KaTeX from CDN on first use
 */
let katexLoaded = false;
let katexLoadPromise: Promise<any> | null = null;

async function loadKatex(): Promise<any> {
  if (katexLoaded && (window as any).katex) {
    return (window as any).katex;
  }

  if (katexLoadPromise) {
    return katexLoadPromise;
  }

  katexLoadPromise = new Promise((resolve, reject) => {
    // Load KaTeX CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    link.integrity = 'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    // Load KaTeX script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    script.integrity = 'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8';
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      // Load auto-render extension for finding LaTeX in text
      const autoRenderScript = document.createElement('script');
      autoRenderScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
      autoRenderScript.integrity = 'sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05';
      autoRenderScript.crossOrigin = 'anonymous';

      autoRenderScript.onload = () => {
        katexLoaded = true;
        console.log('[LatexRenderer] KaTeX loaded successfully');
        resolve((window as any).katex);
      };

      autoRenderScript.onerror = () => {
        console.warn('[LatexRenderer] Failed to load KaTeX auto-render extension');
        // Still resolve with base katex (auto-render is optional)
        katexLoaded = true;
        resolve((window as any).katex);
      };

      document.head.appendChild(autoRenderScript);
    };

    script.onerror = () => {
      console.error('[LatexRenderer] Failed to load KaTeX from CDN');
      reject(new Error('Failed to load KaTeX'));
    };

    document.head.appendChild(script);
  });

  return katexLoadPromise;
}

/**
 * Render multiple LaTeX expressions in mixed content
 * Finds and replaces all LaTeX expressions in text
 */
export async function renderLatexInText(text: string): Promise<string> {
  // This function can be used to find and render LaTeX within larger text blocks
  // Example use case: markdown with inline LaTeX

  const katex = await loadKatex();

  // Use KaTeX auto-render if available
  if ((window as any).renderMathInElement) {
    const container = document.createElement('div');
    container.innerHTML = escapeHtml(text);

    (window as any).renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });

    return container.innerHTML;
  }

  // Fallback: manual regex replacement
  let result = text;

  // Replace display math $$...$$
  result = result.replace(/\$\$([^\$]+)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { displayMode: true });
    } catch {
      return `$$${math}$$`;
    }
  });

  // Replace inline math $...$
  result = result.replace(/\$([^\$]+)\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { displayMode: false });
    } catch {
      return `$${math}$`;
    }
  });

  return result;
}
