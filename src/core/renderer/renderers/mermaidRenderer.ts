/**
 * Mermaid Renderer (CORE-022)
 *
 * Responsibilities:
 * - Render Mermaid diagrams using Mermaid.js library
 * - Support flowcharts, sequence diagrams, Gantt charts, class diagrams, etc.
 * - Interactive zoom and pan for complex diagrams
 * - Export diagram as SVG/PNG
 * - Streaming chunk rendering with buffering
 * - Theme support (light/dark)
 * - Auto-layout and custom styling
 *
 * Supported Diagram Types:
 * - Flowchart: graph TD, graph LR
 * - Sequence Diagram: sequenceDiagram
 * - Class Diagram: classDiagram
 * - State Diagram: stateDiagram-v2
 * - Entity Relationship Diagram: erDiagram
 * - Gantt Chart: gantt
 * - Pie Chart: pie
 * - Git Graph: gitGraph
 * - User Journey: journey
 * - Requirement Diagram: requirementDiagram
 *
 * Usage:
 * ```typescript
 * import { createMermaidRenderer } from './renderers/mermaidRenderer';
 *
 * const renderer = createMermaidRenderer();
 * const html = await renderer.render(`
 *   graph TD
 *     A[Start] --> B{Decision}
 *     B -->|Yes| C[Process]
 *     B -->|No| D[End]
 * `);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Mermaid diagram types
 */
export type MermaidDiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'pie'
  | 'gitGraph'
  | 'journey'
  | 'requirement'
  | 'unknown';

/**
 * Mermaid renderer options
 */
export interface MermaidRendererOptions {
  /**
   * Theme: default, dark, forest, neutral
   * Default: 'default'
   */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';

  /**
   * Enable interactive zoom and pan
   * Default: true
   */
  interactive?: boolean;

  /**
   * Enable export buttons (SVG, PNG)
   * Default: true
   */
  exportButtons?: boolean;

  /**
   * Enable full-screen mode
   * Default: true
   */
  fullScreenButton?: boolean;

  /**
   * Start with diagram folded (collapsed)
   * Default: false
   */
  startFolded?: boolean;

  /**
   * Custom Mermaid configuration
   */
  mermaidConfig?: Record<string, any>;

  /**
   * Maximum diagram size (characters)
   * Default: 10000
   */
  maxSize?: number;

  /**
   * Custom CSS class for Mermaid container
   * Default: 'mermaid-renderer'
   */
  className?: string;

  /**
   * Enable syntax error display
   * Default: true
   */
  showErrors?: boolean;
}

/**
 * Mermaid Renderer
 * Implements IRenderer interface for Mermaid diagrams
 */
export class MermaidRenderer implements IRenderer {
  public readonly type = 'mermaid' as const;

  private options: Required<Omit<MermaidRendererOptions, 'mermaidConfig'>> & {
    mermaidConfig?: Record<string, any>;
  };

  private mermaidLoaded: boolean = false;
  private streamBuffer: string = '';
  private diagramCounter: number = 1;

  constructor(options: MermaidRendererOptions = {}) {
    this.options = {
      theme: options.theme ?? 'default',
      interactive: options.interactive ?? true,
      exportButtons: options.exportButtons ?? true,
      fullScreenButton: options.fullScreenButton ?? true,
      startFolded: options.startFolded ?? false,
      maxSize: options.maxSize ?? 10000,
      className: options.className ?? 'mermaid-renderer',
      showErrors: options.showErrors ?? true,
      mermaidConfig: options.mermaidConfig
    };
  }

  /**
   * Check if content is Mermaid diagram
   * Detection heuristics:
   * - Starts with ```mermaid fence
   * - Contains Mermaid keywords (graph, sequenceDiagram, classDiagram, etc.)
   * - Contains Mermaid syntax (arrows -->, ===>, etc.)
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Starts with mermaid fence
    if (/^```mermaid/i.test(trimmed)) return true;

    // Check for Mermaid diagram type keywords
    const mermaidKeywords = [
      /^graph\s+(TD|TB|BT|RL|LR)/m,
      /^flowchart\s+(TD|TB|BT|RL|LR)/m,
      /^sequenceDiagram/m,
      /^classDiagram/m,
      /^stateDiagram-v2/m,
      /^erDiagram/m,
      /^gantt/m,
      /^pie/m,
      /^gitGraph/m,
      /^journey/m,
      /^requirementDiagram/m
    ];

    if (mermaidKeywords.some(pattern => pattern.test(trimmed))) {
      return true;
    }

    // Check for Mermaid syntax patterns
    const mermaidSyntax = [
      /-->/,           // Arrow
      /==>/,           // Thick arrow
      /-.->|/,         // Dotted arrow
      /\[.*\]/,        // Node with text
      /\{.*\}/,        // Decision node
      /\(\(.*\)\)/,    // Circle node
      /\[\[.*\]\]/,    // Subroutine
    ];

    let syntaxCount = 0;
    for (const pattern of mermaidSyntax) {
      if (pattern.test(trimmed)) {
        syntaxCount++;
        if (syntaxCount >= 2) return true;
      }
    }

    return false;
  }

  /**
   * Render Mermaid diagram to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    // Load Mermaid library if not loaded
    if (!this.mermaidLoaded) {
      await this.loadMermaid();
      this.mermaidLoaded = true;
    }

    try {
      // Extract diagram code
      let diagramCode = content;

      // Remove fence if present
      const fenceMatch = /^```mermaid\n([\s\S]*?)```$/m.exec(content);
      if (fenceMatch) {
        diagramCode = fenceMatch[1].trim();
      }

      // Validate size
      if (diagramCode.length > this.options.maxSize) {
        throw new Error(`Diagram too large (${diagramCode.length} > ${this.options.maxSize} characters)`);
      }

      // Detect diagram type
      const diagramType = this.detectDiagramType(diagramCode);

      // Generate unique ID
      const diagramId = `mermaid-${Date.now()}-${this.diagramCounter++}`;

      // Build diagram HTML
      const diagramHtml = await this.buildDiagramHTML(diagramCode, diagramId, diagramType);

      return diagramHtml;

    } catch (error) {
      console.error('[MermaidRenderer] Render error:', error);

      if (this.options.showErrors) {
        return this.buildErrorFallback(content, error as Error);
      }

      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete Mermaid diagram
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.mermaid-loading')) {
      const loading = document.createElement('div');
      loading.className = 'mermaid-loading';
      loading.textContent = '⏳ Loading diagram...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete Mermaid diagram
   * 🔑 修复：支持非流式渲染模式
   */
  public async finalize(container: HTMLElement): Promise<void> {
    try {
      console.log('[MermaidRenderer] finalize() called', {
        hasStreamBuffer: !!this.streamBuffer,
        containerHTML: container.innerHTML.substring(0, 200)
      });

      // 🔑 修复：处理流式渲染模式
      if (this.streamBuffer) {
        // Remove loading placeholder
        const loading = container.querySelector('.mermaid-loading');
        if (loading) loading.remove();

        // Render complete buffered content
        const html = await this.render(this.streamBuffer);

        // Replace container content
        container.innerHTML = html;

        // Clear buffer
        this.streamBuffer = '';
      }

      // 🔑 修复：无论是流式还是非流式渲染，都初始化Mermaid图表
      // 这样可以确保在非流式渲染（streaming: false）时也能正确渲染图表
      await this.initializeMermaid(container);

      // 🔑 修复问题2：绑定全屏按钮的点击事件
      this.setupFullscreenButton(container);

    } catch (error) {
      console.error('[MermaidRenderer] Finalize error:', error);
      if (this.streamBuffer) {
        container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
        this.streamBuffer = '';
      }
    }
  }

  /**
   * Detect Mermaid diagram type
   */
  private detectDiagramType(code: string): MermaidDiagramType {
    const trimmed = code.trim();

    if (/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/m.test(trimmed)) return 'flowchart';
    if (/^sequenceDiagram/m.test(trimmed)) return 'sequence';
    if (/^classDiagram/m.test(trimmed)) return 'class';
    if (/^stateDiagram-v2/m.test(trimmed)) return 'state';
    if (/^erDiagram/m.test(trimmed)) return 'er';
    if (/^gantt/m.test(trimmed)) return 'gantt';
    if (/^pie/m.test(trimmed)) return 'pie';
    if (/^gitGraph/m.test(trimmed)) return 'gitGraph';
    if (/^journey/m.test(trimmed)) return 'journey';
    if (/^requirementDiagram/m.test(trimmed)) return 'requirement';

    return 'unknown';
  }

  /**
   * Build diagram HTML
   */
  private async buildDiagramHTML(
    code: string,
    diagramId: string,
    diagramType: MermaidDiagramType
  ): Promise<string> {
    // Build container
    let html = `<div class="${this.options.className}" data-diagram-id="${diagramId}" data-diagram-type="${diagramType}">`;

    // Header with actions
    html += '<div class="mermaid-header">';
    html += `<span class="mermaid-type">${this.formatDiagramType(diagramType)}</span>`;
    html += '<div class="mermaid-actions">';

    if (this.options.startFolded) {
      html += '<button class="mermaid-fold-btn" data-action="toggle-fold" title="Toggle diagram">▼</button>';
    }

    if (this.options.exportButtons) {
      html += '<button class="mermaid-export-svg-btn" data-action="export-svg" title="Export as SVG">SVG</button>';
      html += '<button class="mermaid-export-png-btn" data-action="export-png" title="Export as PNG">PNG</button>';
    }

    if (this.options.fullScreenButton) {
      html += `<button class="mermaid-fullscreen-btn" data-action="toggle-fullscreen" title="Toggle Full Screen">
        <img src="src/template/pic_resource/icon/Emoji_instead/24-1px-whole-screen.svg"
             alt="Fullscreen"
             class="fullscreen-icon"
             style="width: 16px; height: 16px;" />
      </button>`;
    }

    html += '</div>'; // .mermaid-actions
    html += '</div>'; // .mermaid-header

    // Diagram content
    const foldedClass = this.options.startFolded ? ' folded' : '';
    html += `<div class="mermaid-content${foldedClass}">`;

    // Mermaid diagram container
    html += `<div class="mermaid" id="${diagramId}" data-theme="${this.options.theme}">`;
    html += this.escapeHtml(code);
    html += '</div>';

    html += '</div>'; // .mermaid-content

    html += '</div>'; // .mermaid-renderer

    return html;
  }

  /**
   * Initialize Mermaid rendering
   * This would be called after DOM insertion
   * 🔑 修复：改为public方法，以便MarkdownRenderer可以调用
   */
  public async initializeMermaid(container: HTMLElement): Promise<void> {
    try {
      // Check if Mermaid is available globally
      if (typeof (window as any).mermaid === 'undefined') {
        throw new Error('Mermaid library not loaded');
      }

      const mermaid = (window as any).mermaid;

      // Initialize Mermaid with configuration
      mermaid.initialize({
        startOnLoad: false,
        theme: this.options.theme,
        securityLevel: 'strict',
        ...this.options.mermaidConfig
      });

      // Find all mermaid diagrams in the container
      const diagrams = container.querySelectorAll('.mermaid');

      // Render each diagram
      for (const diagram of Array.from(diagrams)) {
        if (diagram.getAttribute('data-processed') === 'true') {
          continue; // Skip already processed diagrams
        }

        try {
          // Run Mermaid rendering
          await mermaid.run({
            nodes: [diagram as HTMLElement]
          });

          diagram.setAttribute('data-processed', 'true');
          console.log('[MermaidRenderer] Diagram rendered successfully');
        } catch (renderError) {
          console.error('[MermaidRenderer] Diagram render error:', renderError);
          // Show error in diagram
          diagram.innerHTML = `<div class="mermaid-error">Failed to render diagram: ${renderError}</div>`;
        }
      }

      console.log('[MermaidRenderer] All diagrams initialized');

    } catch (error) {
      console.error('[MermaidRenderer] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Setup fullscreen button event listener
   * 🔑 修复问题2：绑定全屏按钮的点击事件
   */
  public setupFullscreenButton(container: HTMLElement): void {
    if (!this.options.fullScreenButton) {
      return;
    }

    const fullscreenBtn = container.querySelector('.mermaid-fullscreen-btn');

    if (fullscreenBtn) {
      console.log('[MermaidRenderer] Binding fullscreen button click event');
      fullscreenBtn.addEventListener('click', () => {
        console.log('[MermaidRenderer] Fullscreen button clicked');
        this.toggleFullScreen(container);
      });
    } else {
      console.warn('[MermaidRenderer] Fullscreen button not found in container');
    }
  }

  /**
   * Toggle full-screen mode for Mermaid diagram
   * 🔑 修复问题2：切换全屏模式并更新图标
   */
  private toggleFullScreen(container: HTMLElement): void {
    // 🔑 修复：container可能是.message-content-zone，需要找到.mermaid-renderer
    const mermaidRenderer = container.classList.contains('mermaid-renderer')
      ? container
      : container.querySelector('.mermaid-renderer') as HTMLElement;

    if (!mermaidRenderer) {
      console.error('[MermaidRenderer] Cannot find .mermaid-renderer element');
      return;
    }

    const fullscreenBtn = mermaidRenderer.querySelector('.mermaid-fullscreen-btn');
    const iconImg = fullscreenBtn?.querySelector('.fullscreen-icon') as HTMLImageElement;
    const theme = this.getCurrentTheme();
    const iconFilter = theme === 'light' ? 'filter: invert(1);' : '';

    if (mermaidRenderer.classList.contains('fullscreen')) {
      // Exit full-screen
      console.log('[MermaidRenderer] Exiting fullscreen mode');
      mermaidRenderer.classList.remove('fullscreen');

      // 切换回全屏图标
      if (iconImg) {
        iconImg.src = 'src/template/pic_resource/icon/Emoji_instead/24-1px-whole-screen.svg';
        iconImg.alt = 'Fullscreen';
        iconImg.style.cssText = `width: 16px; height: 16px; ${iconFilter}`;
      }
      if (fullscreenBtn) {
        fullscreenBtn.setAttribute('title', 'Toggle Full Screen');
      }
    } else {
      // Enter full-screen
      console.log('[MermaidRenderer] Entering fullscreen mode');
      mermaidRenderer.classList.add('fullscreen');

      // 切换到退出全屏图标
      if (iconImg) {
        iconImg.src = 'src/template/pic_resource/icon/Emoji_instead/small-screen.svg';
        iconImg.alt = 'Exit Fullscreen';
        iconImg.style.cssText = `width: 16px; height: 16px; ${iconFilter}`;
      }
      if (fullscreenBtn) {
        fullscreenBtn.setAttribute('title', 'Exit Full Screen');
      }
    }
  }

  /**
   * 检测当前主题模式
   * @returns 'light' | 'dark'
   */
  private getCurrentTheme(): 'light' | 'dark' {
    // 方法1：检查 body 或 html 的 data-theme 属性
    const theme = document.documentElement.getAttribute('data-theme')
      || document.body.getAttribute('data-theme');

    if (theme === 'light' || theme === 'dark') {
      return theme;
    }

    // 方法2：检查 CSS 类名
    if (document.body.classList.contains('light-theme')) return 'light';
    if (document.body.classList.contains('dark-theme')) return 'dark';

    // 方法3：检查系统偏好
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // 默认返回 light
    return 'light';
  }

  /**
   * Load Mermaid library
   */
  private async loadMermaid(): Promise<void> {
    try {
      // Check if Mermaid is available globally
      if (typeof (window as any).mermaid === 'undefined') {
        throw new Error('Mermaid library not loaded. Please ensure Mermaid.js is included in your HTML.');
      }

      const mermaid = (window as any).mermaid;

      // Initialize Mermaid with default configuration
      mermaid.initialize({
        startOnLoad: false,
        theme: this.options.theme,
        securityLevel: 'strict',
        ...this.options.mermaidConfig
      });

      console.log('[MermaidRenderer] Mermaid.js library loaded successfully');
    } catch (error) {
      console.error('[MermaidRenderer] Failed to load Mermaid.js:', error);
      throw new Error('Failed to load Mermaid renderer library');
    }
  }

  /**
   * Format diagram type for display
   */
  private formatDiagramType(type: MermaidDiagramType): string {
    const typeMap: Record<MermaidDiagramType, string> = {
      'flowchart': 'Flowchart',
      'sequence': 'Sequence Diagram',
      'class': 'Class Diagram',
      'state': 'State Diagram',
      'er': 'ER Diagram',
      'gantt': 'Gantt Chart',
      'pie': 'Pie Chart',
      'gitGraph': 'Git Graph',
      'journey': 'User Journey',
      'requirement': 'Requirement Diagram',
      'unknown': 'Diagram'
    };

    return typeMap[type];
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>Mermaid Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <details class="mermaid-source">
          <summary>Show diagram source</summary>
          <pre><code>${this.escapeHtml(content)}</code></pre>
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
  public setOptions(options: Partial<MermaidRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create Mermaid renderer
 */
export function createMermaidRenderer(options?: MermaidRendererOptions): MermaidRenderer {
  return new MermaidRenderer(options);
}

/**
 * Convenience function to render Mermaid diagram
 */
export async function renderMermaid(
  content: string,
  options?: MermaidRendererOptions
): Promise<string> {
  const renderer = createMermaidRenderer(options);
  return renderer.render(content);
}

/**
 * Example Mermaid diagrams for documentation
 */
export const MERMAID_EXAMPLES = {
  flowchart: `
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
    C --> D
  `,

  sequence: `
sequenceDiagram
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: Great!
    Alice-)Bob: See you later!
  `,

  classDiagram: `
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
  `,

  stateDiagram: `
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
  `,

  erDiagram: `
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
    }
  `,

  gantt: `
gantt
    title Project Schedule
    dateFormat  YYYY-MM-DD
    section Design
    Requirements :a1, 2024-01-01, 30d
    Design :after a1, 20d
    section Development
    Implementation :2024-02-01, 60d
  `,

  pie: `
pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
  `,

  gitGraph: `
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
  `
};
