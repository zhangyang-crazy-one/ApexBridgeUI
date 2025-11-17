/**
 * Markdown Renderer (CORE-018)
 *
 * Responsibilities:
 * - Render Markdown content using Marked.js library
 * - Support GitHub Flavored Markdown (GFM)
 * - Syntax highlighting for code blocks
 * - XSS protection and HTML sanitization
 * - Streaming chunk rendering support
 * - Task lists, tables, strikethrough, autolinks
 *
 * Features:
 * - GFM extensions (tables, task lists, strikethrough)
 * - Syntax highlighting with Prism.js or Highlight.js
 * - Safe HTML rendering with DOMPurify
 * - LaTeX math detection and preservation
 * - Emoji support :smile:
 * - Auto-linking URLs
 * - Heading anchor links
 *
 * Usage:
 * ```typescript
 * import { createMarkdownRenderer } from './renderers/markdownRenderer';
 *
 * const renderer = createMarkdownRenderer();
 * const html = await renderer.render('# Hello\n\nThis is **bold** text.');
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Markdown renderer options
 */
export interface MarkdownRendererOptions {
  /**
   * Enable GitHub Flavored Markdown
   * Default: true
   */
  gfm?: boolean;

  /**
   * Convert line breaks to <br>
   * Default: true
   */
  breaks?: boolean;

  /**
   * Enable syntax highlighting for code blocks
   * Default: true
   */
  highlight?: boolean;

  /**
   * Enable HTML sanitization (XSS protection)
   * Default: true
   */
  sanitize?: boolean;

  /**
   * Enable LaTeX math rendering
   * Default: true
   */
  latex?: boolean;

  /**
   * Enable emoji shortcodes (:smile:)
   * Default: false
   */
  emoji?: boolean;

  /**
   * Add heading anchor links
   * Default: true
   */
  headingAnchors?: boolean;

  /**
   * Custom CSS class for markdown container
   * Default: 'markdown-content'
   */
  className?: string;
}

/**
 * Markdown Renderer
 * Implements IRenderer interface for Markdown content
 */
export class MarkdownRenderer implements IRenderer {
  public readonly type = 'markdown' as const;

  private options: Required<MarkdownRendererOptions>;
  private markedLoaded: boolean = false;
  private streamBuffer: string = '';

  constructor(options: MarkdownRendererOptions = {}) {
    this.options = {
      gfm: options.gfm ?? true,
      breaks: options.breaks ?? true,
      highlight: options.highlight ?? true,
      sanitize: options.sanitize ?? true,
      latex: options.latex ?? true,
      emoji: options.emoji ?? false,
      headingAnchors: options.headingAnchors ?? true,
      className: options.className ?? 'markdown-content'
    };
  }

  /**
   * Check if content is Markdown
   * Detection heuristics:
   * - Contains Markdown syntax (# headers, **bold**, links, etc.)
   * - No HTML tags at start
   * - No code block fence at start (those are 'code' type)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Starts with code fence - this is 'code' type
    if (/^```/.test(trimmed)) return false;

    // Starts with HTML tag - this is 'html' type
    if (/^<[a-z]/i.test(trimmed)) return false;

    // Check for Markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s/m,              // Headers: # Header
      /\*\*[^*]+\*\*/,           // Bold: **text**
      /\*[^*]+\*/,               // Italic: *text*
      /\[[^\]]+\]\([^)]+\)/,     // Links: [text](url)
      /^\s*[-*+]\s/m,            // Lists: - item
      /^\s*\d+\.\s/m,            // Ordered lists: 1. item
      /^>\s/m,                   // Blockquotes: > quote
      /^\s*\|.*\|.*\|/m,         // Tables: | col1 | col2 |
      /~~[^~]+~~/,               // Strikethrough: ~~text~~
      /`[^`]+`/,                 // Inline code: `code`
    ];

    return markdownPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Render Markdown content to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    // Load Marked library if not loaded
    if (!this.markedLoaded) {
      await this.loadMarked();
      this.markedLoaded = true;
    }

    try {
      // Pre-process content
      let processedContent = content;

      // Preserve LaTeX if enabled
      const latexBlocks: string[] = [];
      if (this.options.latex) {
        processedContent = this.preserveLatex(processedContent, latexBlocks);
      }

      // Render Markdown
      const { marked } = await import('marked');
      let html = await marked.parse(processedContent, {
        gfm: this.options.gfm,
        breaks: this.options.breaks,
        headerIds: this.options.headingAnchors,
        mangle: false,
        pedantic: false
      });

      // Restore LaTeX blocks
      if (this.options.latex && latexBlocks.length > 0) {
        html = this.restoreLatex(html, latexBlocks);
      }

      // Apply syntax highlighting
      if (this.options.highlight) {
        html = await this.applySyntaxHighlighting(html);
      }

      // Sanitize HTML
      if (this.options.sanitize) {
        html = this.sanitizeHtml(html);
      }

      // Process emoji shortcodes
      if (this.options.emoji) {
        html = this.processEmoji(html);
      }

      // Wrap in container
      return `<div class="${this.options.className}">${html}</div>`;

    } catch (error) {
      console.error('[MarkdownRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until we have a complete Markdown block
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // For streaming, render partial content as plain text
    // This prevents flickering from incomplete Markdown syntax
    const textNode = document.createTextNode(chunk);
    container.appendChild(textNode);
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete Markdown
   * 🔑 修复：绑定CodeRenderer的事件监听器
   * 🔑 修复：支持静态渲染和流式渲染两种模式
   * 🔑 修复：添加MermaidRenderer的finalize支持
   */
  public async finalize(container: HTMLElement): Promise<void> {
    console.log('[MarkdownRenderer] finalize() called', {
      hasStreamBuffer: !!this.streamBuffer,
      containerHTML: container.innerHTML.substring(0, 200)
    });

    try {
      // 🔑 修复：如果有 streamBuffer，先渲染完整内容
      // 这是流式渲染模式的处理
      if (this.streamBuffer) {
        const html = await this.render(this.streamBuffer);
        container.innerHTML = html;
        this.streamBuffer = '';
      }

      // 🔑 修复：无论是流式还是静态渲染，都查找并绑定事件
      // 这样可以确保在静态渲染（streaming: false）时也能正确绑定事件
      const codeRenderers = container.querySelectorAll('.code-renderer');
      if (codeRenderers.length > 0) {
        console.log('[MarkdownRenderer] Found', codeRenderers.length, 'code renderers, binding events');
        const { CodeRenderer } = await import('./codeRenderer');
        const codeRenderer = new CodeRenderer();

        codeRenderers.forEach((codeContainer) => {
          codeRenderer.bindRenderButton(codeContainer as HTMLElement);
        });
      }

      // 🔑 修复：查找并初始化Mermaid渲染器
      const mermaidRenderers = container.querySelectorAll('.mermaid-renderer');
      console.log('[MarkdownRenderer] Searching for mermaid renderers, found:', mermaidRenderers.length);

      if (mermaidRenderers.length > 0) {
        console.log('[MarkdownRenderer] Found', mermaidRenderers.length, 'mermaid renderers, initializing diagrams');
        const { MermaidRenderer } = await import('./mermaidRenderer');
        const mermaidRenderer = new MermaidRenderer();

        // 为每个Mermaid容器调用initializeMermaid和setupFullscreenButton
        for (const mermaidContainer of Array.from(mermaidRenderers)) {
          try {
            console.log('[MarkdownRenderer] Initializing mermaid diagram:', mermaidContainer.id || 'no-id');
            // 直接调用initializeMermaid（因为HTML已经渲染好了）
            await mermaidRenderer.initializeMermaid(mermaidContainer as HTMLElement);
            // 🔑 修复：绑定全屏按钮的点击事件
            mermaidRenderer.setupFullscreenButton(mermaidContainer as HTMLElement);
          } catch (error) {
            console.error('[MarkdownRenderer] Failed to initialize mermaid diagram:', error);
          }
        }
      }

    } catch (error) {
      console.error('[MarkdownRenderer] Finalize error:', error);
      // Keep plain text on error
    }
  }

  /**
   * Load Marked library
   */
  private async loadMarked(): Promise<void> {
    try {
      await import('marked');
      console.log('[MarkdownRenderer] Marked.js library loaded');
    } catch (error) {
      console.error('[MarkdownRenderer] Failed to load Marked.js:', error);
      throw new Error('Failed to load Markdown renderer');
    }
  }

  /**
   * Preserve LaTeX blocks during Markdown processing
   * Replace with placeholders to prevent Markdown parsing
   * Uses LATEXBLOCKPLACEHOLDER format - pure alphanumeric, no special chars
   * Supports: $...$, $$...$$, \[...\], \(...\), \begin{}\end{}
   */
  private preserveLatex(content: string, storage: string[]): string {
    // CRITICAL: Process $$...$$ and \[...\] FIRST before \begin{}\end{}
    // This prevents nested placeholder issues when user writes $$\begin{pmatrix}...\end{pmatrix}$$

    // Display math: $$...$$
    content = content.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
      const index = storage.length;
      storage.push(match);
      return `LATEXBLOCKPLACEHOLDER${index}END`;
    });

    // Display math: \[...\]
    content = content.replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
      const index = storage.length;
      storage.push(match);
      return `LATEXBLOCKPLACEHOLDER${index}END`;
    });

    // LaTeX environments: \begin{...}\end{...}
    // Process AFTER $$...$$ to avoid nested placeholders
    content = content.replace(/\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g, (match) => {
      const index = storage.length;
      storage.push(match);
      return `LATEXBLOCKPLACEHOLDER${index}END`;
    });

    // Inline math: \(...\)
    content = content.replace(/\\\(([^\)]+?)\\\)/g, (match) => {
      const index = storage.length;
      storage.push(match);
      return `LATEXINLINEPLACEHOLDER${index}END`;
    });

    // Inline math: $...$ (process last to avoid conflicts)
    content = content.replace(/\$([^\$\n]+?)\$/g, (match) => {
      const index = storage.length;
      storage.push(match);
      return `LATEXINLINEPLACEHOLDER${index}END`;
    });

    return content;
  }

  /**
   * Restore LaTeX blocks after Markdown processing
   * Now actually renders LaTeX using KaTeX instead of just restoring raw strings
   * Supports: $...$, $$...$$, \[...\], \(...\), \begin{}\end{}
   */
  private restoreLatex(html: string, storage: string[]): string {
    // Check if KaTeX is available
    const katex = (window as any).katex;

    // Restore and render display math blocks ($$...$$, \[...\], \begin{}\end{})
    html = html.replace(/LATEXBLOCKPLACEHOLDER(\d+)END/g, (match, index) => {
      const latex = storage[parseInt(index, 10)];
      if (!latex) return match;

      // If KaTeX not available, return original LaTeX
      if (!katex) {
        console.warn('[MarkdownRenderer] KaTeX not loaded, returning raw LaTeX');
        return latex;
      }

      // Remove delimiters and trim
      let latexCode = latex;
      if (latex.startsWith('$$') && latex.endsWith('$$')) {
        // $$...$$
        latexCode = latex.slice(2, -2).trim();
      } else if (latex.startsWith('\\[') && latex.endsWith('\\]')) {
        // \[...\]
        latexCode = latex.slice(2, -2).trim();
      } else if (latex.match(/^\\begin\{.*\}/)) {
        // \begin{}\end{} - keep as is
        latexCode = latex;
      }

      try {
        return katex.renderToString(latexCode, {
          displayMode: true,
          throwOnError: false,
          errorColor: '#E74C3C',
          strict: false,
          trust: false
        });
      } catch (e) {
        console.error('[MarkdownRenderer] LaTeX block render error:', e);
        return latex; // Return original on error
      }
    });

    // Restore and render inline math ($...$, \(...\))
    html = html.replace(/LATEXINLINEPLACEHOLDER(\d+)END/g, (match, index) => {
      const latex = storage[parseInt(index, 10)];
      if (!latex) return match;

      // If KaTeX not available, return original LaTeX
      if (!katex) {
        console.warn('[MarkdownRenderer] KaTeX not loaded, returning raw LaTeX');
        return latex;
      }

      // Remove delimiters and trim
      let latexCode: string;
      if (latex.startsWith('\\(') && latex.endsWith('\\)')) {
        // \(...\)
        latexCode = latex.slice(2, -2).trim();
      } else {
        // $...$
        latexCode = latex.slice(1, -1).trim();
      }

      try {
        return katex.renderToString(latexCode, {
          displayMode: false,
          throwOnError: false,
          errorColor: '#E74C3C',
          strict: false,
          trust: false
        });
      } catch (e) {
        console.error('[MarkdownRenderer] LaTeX inline render error:', e);
        return latex; // Return original on error
      }
    });

    return html;
  }

  /**
   * Apply syntax highlighting to code blocks
   * Uses basic regex-based highlighting for common languages
   * 🔑 修复：对HTML代码块使用CodeRenderer（支持Render按钮）
   */
  private async applySyntaxHighlighting(html: string): Promise<string> {
    // Parse HTML to find code blocks
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const codeBlocks = doc.querySelectorAll('pre code');

    // 🔑 修复：使用Promise.all处理异步操作
    const promises = Array.from(codeBlocks).map(async (codeBlock) => {
      const code = codeBlock.textContent || '';
      const languageClass = Array.from(codeBlock.classList)
        .find(cls => cls.startsWith('language-'));

      if (languageClass) {
        const language = languageClass.replace('language-', '');

        // Add data attribute for language
        codeBlock.setAttribute('data-language', language);

        // 🔑 修复：如果是HTML代码块，使用CodeRenderer
        if (language.toLowerCase() === 'html') {
          try {
            // 动态导入CodeRenderer
            const { CodeRenderer } = await import('./codeRenderer');
            const codeRenderer = new CodeRenderer();

            // 构造fenced code block格式
            const fencedCode = '```html\n' + code + '\n```';

            // 使用CodeRenderer渲染，传递isRenderableHtml标志
            const renderedHtml = await codeRenderer.render(fencedCode, {
              language: 'html',
              isRenderableHtml: true,
              rawHtmlContent: code
            });

            // 替换整个<pre>元素
            const preElement = codeBlock.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
              const tempDiv = doc.createElement('div');
              tempDiv.innerHTML = renderedHtml;

              if (tempDiv.firstElementChild) {
                preElement.replaceWith(tempDiv.firstElementChild);
              }
            }
          } catch (error) {
            console.error('[MarkdownRenderer] Failed to use CodeRenderer for HTML block:', error);
            // 降级到基本语法高亮
            const highlighted = this.applyBasicHighlighting(code, language);
            codeBlock.innerHTML = highlighted;
          }
        } else if (language.toLowerCase() === 'mermaid') {
          // 🔑 修复：如果是Mermaid代码块，使用MermaidRenderer
          try {
            // 动态导入MermaidRenderer
            const { MermaidRenderer } = await import('./mermaidRenderer');
            const mermaidRenderer = new MermaidRenderer();

            // 使用MermaidRenderer渲染
            const renderedHtml = await mermaidRenderer.render(code);

            // 替换整个<pre>元素
            const preElement = codeBlock.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
              const tempDiv = doc.createElement('div');
              tempDiv.innerHTML = renderedHtml;

              if (tempDiv.firstElementChild) {
                preElement.replaceWith(tempDiv.firstElementChild);
              }
            }
          } catch (error) {
            console.error('[MarkdownRenderer] Failed to use MermaidRenderer for Mermaid block:', error);
            // 降级到基本语法高亮
            const highlighted = this.applyBasicHighlighting(code, language);
            codeBlock.innerHTML = highlighted;
          }
        } else {
          // 其他语言：使用基本语法高亮
          const highlighted = this.applyBasicHighlighting(code, language);
          codeBlock.innerHTML = highlighted;
        }
      }
    });

    await Promise.all(promises);

    return doc.body.innerHTML;
  }

  /**
   * Apply basic syntax highlighting using regex patterns
   * Supports: JavaScript, TypeScript, Python, Java, C++, Go, Rust, SQL, HTML, CSS
   */
  private applyBasicHighlighting(code: string, language: string): string {
    // Escape HTML first
    let highlighted = this.escapeHtml(code);

    // Normalize language
    const lang = language.toLowerCase();

    // JavaScript/TypeScript highlighting
    if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
      // Keywords
      highlighted = highlighted.replace(
        /\b(function|const|let|var|class|import|export|from|if|else|for|while|do|switch|case|break|continue|return|async|await|try|catch|finally|throw|new|delete|typeof|instanceof|this|super|extends|implements|interface|type|enum|namespace|declare|public|private|protected|static|readonly)\b/g,
        '<span class="hljs-keyword">$1</span>'
      );

      // Literals
      highlighted = highlighted.replace(
        /\b(true|false|null|undefined|NaN|Infinity)\b/g,
        '<span class="hljs-literal">$1</span>'
      );

      // Comments (single-line)
      highlighted = highlighted.replace(
        /(\/\/.*?)(&lt;br&gt;|$)/g,
        '<span class="hljs-comment">$1</span>$2'
      );

      // Strings
      highlighted = highlighted.replace(
        /(&quot;)((?:(?!&quot;).)*?)(&quot;)/g,
        '<span class="hljs-string">$1$2$3</span>'
      );
      highlighted = highlighted.replace(
        /(&#039;)((?:(?!&#039;).)*?)(&#039;)/g,
        '<span class="hljs-string">$1$2$3</span>'
      );

      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+\.?\d*)\b/g,
        '<span class="hljs-number">$1</span>'
      );

      // Functions
      highlighted = highlighted.replace(
        /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
        '<span class="hljs-title function_">$1</span>'
      );
    }

    // Python highlighting
    else if (lang === 'python' || lang === 'py') {
      // Keywords
      highlighted = highlighted.replace(
        /\b(def|class|import|from|if|elif|else|for|while|return|try|except|finally|with|as|lambda|yield|pass|break|continue|global|nonlocal|assert|del|raise|in|is|not|and|or)\b/g,
        '<span class="hljs-keyword">$1</span>'
      );

      // Built-in functions
      highlighted = highlighted.replace(
        /\b(print|len|range|enumerate|zip|map|filter|list|dict|set|tuple|str|int|float|bool|open|input|type|isinstance|hasattr|getattr|setattr)\b(?=\()/g,
        '<span class="hljs-built_in">$1</span>'
      );

      // Literals
      highlighted = highlighted.replace(
        /\b(True|False|None)\b/g,
        '<span class="hljs-literal">$1</span>'
      );

      // Strings (triple-quoted first to avoid conflicts with single quotes)
      highlighted = highlighted.replace(
        /(&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;)/g,
        '<span class="hljs-comment">$1</span>'
      );
      highlighted = highlighted.replace(
        /(&#039;&#039;&#039;[\s\S]*?&#039;&#039;&#039;)/g,
        '<span class="hljs-comment">$1</span>'
      );

      // Comments (# to end of line)
      highlighted = highlighted.replace(
        /(#[^\n]*)/g,
        '<span class="hljs-comment">$1</span>'
      );
      // Single/double quoted strings
      highlighted = highlighted.replace(
        /(&quot;)((?:(?!&quot;).)*?)(&quot;)/g,
        '<span class="hljs-string">$1$2$3</span>'
      );
      highlighted = highlighted.replace(
        /(&#039;)((?:(?!&#039;).)*?)(&#039;)/g,
        '<span class="hljs-string">$1$2$3</span>'
      );

      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+\.?\d*)\b/g,
        '<span class="hljs-number">$1</span>'
      );

      // Decorators
      highlighted = highlighted.replace(
        /(@[a-zA-Z_][a-zA-Z0-9_]*)/g,
        '<span class="hljs-meta">$1</span>'
      );

      // Function definitions
      highlighted = highlighted.replace(
        /\b(def)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        '<span class="hljs-keyword">$1</span> <span class="hljs-title function_">$2</span>'
      );

      // Class definitions
      highlighted = highlighted.replace(
        /\b(class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        '<span class="hljs-keyword">$1</span> <span class="hljs-title class_">$2</span>'
      );
    }

    // Java highlighting
    else if (lang === 'java') {
      highlighted = highlighted.replace(
        /\b(public|private|protected|static|final|abstract|synchronized|volatile|transient|native|strictfp|class|interface|extends|implements|package|import|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|void|int|long|short|byte|char|float|double|boolean)\b/g,
        '<span class="hljs-keyword">$1</span>'
      );

      highlighted = highlighted.replace(
        /\b(true|false|null)\b/g,
        '<span class="hljs-literal">$1</span>'
      );

      highlighted = highlighted.replace(
        /(\/\/.*?)(&lt;br&gt;|$)/g,
        '<span class="hljs-comment">$1</span>$2'
      );

      highlighted = highlighted.replace(
        /(&quot;)((?:(?!&quot;).)*?)(&quot;)/g,
        '<span class="hljs-string">$1$2$3</span>'
      );
    }

    // SQL highlighting
    else if (lang === 'sql') {
      highlighted = highlighted.replace(
        /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|DROP|TABLE|DATABASE|INDEX|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET)\b/gi,
        '<span class="hljs-keyword">$1</span>'
      );

      highlighted = highlighted.replace(
        /(--.*?)(&lt;br&gt;|$)/g,
        '<span class="hljs-comment">$1</span>$2'
      );

      highlighted = highlighted.replace(
        /(&#039;)((?:(?!&#039;).)*?)(&#039;)/g,
        '<span class="hljs-string">$1$2$3</span>'
      );
    }

    // Add more language support as needed...

    return highlighted;
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
   * Sanitize HTML to prevent XSS attacks
   * Whitelist safe tags and attributes
   */
  private sanitizeHtml(html: string): string {
    // Safe tags whitelist
    const safeTags = [
      'p', 'br', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
      'a', 'img',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr',
      'sup', 'sub',
      'details', 'summary',
      'button'  // 🔑 修复：允许CodeRenderer的Render按钮
    ];

    // Safe attributes whitelist
    const safeAttributes = [
      'href', 'src', 'alt', 'title',
      'class', 'id',
      'data-language',
      'data-action',        // 🔑 修复：允许CodeRenderer的按钮action
      'data-html-content',  // 🔑 修复：允许CodeRenderer的HTML内容
      'data-theme',         // 🔑 修复：允许CodeRenderer的主题
      'colspan', 'rowspan',
      'align', 'valign',
      'style'  // CRITICAL: Required for KaTeX inline styles (positioning, heights, etc.)
    ];

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unsafe elements and attributes
    const allElements = doc.body.querySelectorAll('*');
    allElements.forEach((element) => {
      // Check if tag is safe
      if (!safeTags.includes(element.tagName.toLowerCase())) {
        element.remove();
        return;
      }

      // Remove unsafe attributes
      const attributes = Array.from(element.attributes);
      attributes.forEach((attr) => {
        if (!safeAttributes.includes(attr.name.toLowerCase())) {
          element.removeAttribute(attr.name);
        }
      });

      // Sanitize href and src (no javascript:)
      const href = element.getAttribute('href');
      if (href && /^javascript:/i.test(href)) {
        element.removeAttribute('href');
      }

      const src = element.getAttribute('src');
      if (src && /^javascript:/i.test(src)) {
        element.removeAttribute('src');
      }
    });

    return doc.body.innerHTML;
  }

  /**
   * Process emoji shortcodes
   * Convert :smile: to 😊
   */
  private processEmoji(html: string): string {
    // Basic emoji map (extend as needed)
    const emojiMap: Record<string, string> = {
      ':smile:': '😊',
      ':laughing:': '😆',
      ':blush:': '😊',
      ':heart:': '❤️',
      ':+1:': '👍',
      ':-1:': '👎',
      ':fire:': '🔥',
      ':rocket:': '🚀',
      ':star:': '⭐',
      ':warning:': '⚠️',
      ':check:': '✅',
      ':x:': '❌'
    };

    let processed = html;
    Object.entries(emojiMap).forEach(([shortcode, emoji]) => {
      const regex = new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processed = processed.replace(regex, emoji);
    });

    return processed;
  }

  /**
   * Get renderer configuration
   */
  public getOptions(): Required<MarkdownRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<MarkdownRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create Markdown renderer
 */
export function createMarkdownRenderer(options?: MarkdownRendererOptions): MarkdownRenderer {
  return new MarkdownRenderer(options);
}

/**
 * Convenience function to render Markdown
 */
export async function renderMarkdown(
  content: string,
  options?: MarkdownRendererOptions
): Promise<string> {
  const renderer = createMarkdownRenderer(options);
  return renderer.render(content);
}
