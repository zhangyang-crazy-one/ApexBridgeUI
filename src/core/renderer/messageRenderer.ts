/**
 * Message Renderer Orchestration Layer (CORE-018F)
 *
 * Responsibilities:
 * - Orchestrate all 5 shared renderer utilities (colorUtils, domBuilder, imageHandler, streamManager, contentProcessor)
 * - Coordinate 21 specialized renderers (markdown, code, latex, etc.)
 * - Manage complete render pipeline from Message model to DOM
 * - Handle streaming render with chunk management
 * - Apply theme colors from avatar extraction
 * - Provide unified error handling and fallback mechanisms
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │ Message Model → Content Detection → Renderer Selection  │
 * │       ↓                 ↓                    ↓           │
 * │  DOM Builder      contentProcessor    Specialized       │
 * │       ↓                 ↓              Renderer          │
 * │  Color Theme      Transformations          ↓            │
 * │       ↓                 ↓              Rendered DOM      │
 * │  Image Handler    Stream Manager           ↓            │
 * │       ↓                 ↓              Final Output      │
 * └─────────────────────────────────────────────────────────┘
 *
 * Render Pipeline:
 * 1. Build message DOM skeleton (domBuilder)
 * 2. Extract avatar theme color (colorUtils)
 * 3. Detect content type (contentProcessor)
 * 4. Select appropriate renderer (registry)
 * 5. Transform content (contentProcessor)
 * 6. Render content to DOM (specialized renderer)
 * 7. Process images (imageHandler)
 * 8. Handle streaming (streamManager)
 * 9. Apply final styling and animations
 *
 * Streaming Render Flow:
 * 1. Create message skeleton immediately
 * 2. Initialize streamManager for chunk buffering
 * 3. As chunks arrive: detect → transform → append
 * 4. On completion: finalize DOM and run post-processors
 */

import type { Message } from '../models/message';
import { getColorUtils } from './colorUtils';
import { getDOMBuilder, type MessageDOMRefs, type DOMBuilderOptions } from './domBuilder';
import { getImageHandler, type ImageHandlerOptions } from './imageHandler';
import { createStreamManager, type StreamManager, type StreamManagerOptions } from './streamManager';
import { getContentProcessor, type ContentType, type ContentDetectionResult } from './contentProcessor';

// Import all 21 specialized renderers
import { createMarkdownRenderer } from './renderers/markdownRenderer';
import { createCodeRenderer } from './renderers/codeRenderer';
import { createLatexRenderer } from './renderers/latexRenderer';
import { createHtmlRenderer } from './renderers/htmlRenderer';
import { createMermaidRenderer } from './renderers/mermaidRenderer';
import { createThreejsRenderer } from './renderers/threejsRenderer';
import { createJsonRenderer } from './renderers/jsonRenderer';
import { createXmlRenderer } from './renderers/xmlRenderer';
import { createCsvRenderer } from './renderers/csvRenderer';
import { createImageRenderer } from './renderers/imageRenderer';
import { createVideoRenderer } from './renderers/videoRenderer';
import { createAudioRenderer } from './renderers/audioRenderer';
import { createPdfRenderer } from './renderers/pdfRenderer';
import { createDiffRenderer } from './renderers/diffRenderer';
import { createYamlRenderer } from './renderers/yamlRenderer';
import { createGraphqlRenderer } from './renderers/graphqlRenderer';
import { createSqlRenderer } from './renderers/sqlRenderer';
import { createRegexRenderer } from './renderers/regexRenderer';
import { createAsciiRenderer } from './renderers/asciiRenderer';
import { createColorRenderer } from './renderers/colorRenderer';
import { createUrlRenderer } from './renderers/urlRenderer';

/**
 * Renderer interface that all specialized renderers must implement
 */
export interface IRenderer {
  /**
   * Renderer type identifier
   */
  readonly type: ContentType;

  /**
   * Render content to HTML string or DOM element
   *
   * @param content - Raw content to render
   * @param metadata - Optional metadata from content detection
   * @returns Rendered HTML string or DOM element
   */
  render(content: string, metadata?: Record<string, any>): string | HTMLElement | Promise<string | HTMLElement>;

  /**
   * Check if renderer can handle this content
   *
   * @param content - Content to check
   * @returns True if renderer can handle this content
   */
  canRender(content: string): boolean;

  /**
   * Optional: Handle streaming chunk
   *
   * @param chunk - Content chunk
   * @param container - Target container element
   */
  renderChunk?(chunk: string, container: HTMLElement): void;

  /**
   * Optional: Finalize rendering (called after all chunks)
   *
   * @param container - Target container element
   */
  finalize?(container: HTMLElement): void;
}

/**
 * Message render options
 */
export interface MessageRenderOptions {
  /**
   * DOM builder options
   */
  domOptions?: DOMBuilderOptions;

  /**
   * Image handler options
   */
  imageOptions?: ImageHandlerOptions;

  /**
   * Enable avatar theme color extraction
   * Default: true
   */
  enableThemeColor?: boolean;

  /**
   * Force specific renderer type (skip detection)
   */
  forceRenderer?: ContentType;

  /**
   * Enable streaming render mode
   * Default: false
   */
  streaming?: boolean;

  /**
   * Stream manager options (if streaming enabled)
   */
  streamOptions?: StreamManagerOptions;

  /**
   * Skip finalize step (useful when element is not yet in DOM)
   * Default: false
   */
  skipFinalize?: boolean;

  /**
   * Callback when render completes
   */
  onRenderComplete?: (refs: MessageDOMRefs) => void;

  /**
   * Callback when render errors
   */
  onRenderError?: (error: Error) => void;
}

/**
 * Render result
 */
export interface RenderResult {
  /**
   * DOM references to all message elements
   */
  refs: MessageDOMRefs;

  /**
   * Detected content type
   */
  contentType: ContentType;

  /**
   * Renderer used
   */
  renderer: IRenderer;

  /**
   * Stream manager (if streaming mode)
   */
  streamManager?: StreamManager;

  /**
   * Avatar theme color (if enabled)
   */
  themeColor?: string;
}

/**
 * Message Renderer
 * Orchestrates all rendering utilities and specialized renderers
 */
export class MessageRenderer {
  private static instance: MessageRenderer;

  // Utility managers (singletons)
  private readonly colorUtils = getColorUtils();
  private readonly domBuilder = getDOMBuilder();
  private readonly imageHandler = getImageHandler();
  private readonly contentProcessor = getContentProcessor();

  // Renderer registry
  private readonly renderers: Map<ContentType, IRenderer> = new Map();

  // Default fallback renderer
  private readonly defaultRenderer: IRenderer;

  private constructor() {
    // Initialize default plaintext renderer (also handles markdown)
    this.defaultRenderer = this.createPlaintextRenderer();
    this.renderers.set('plaintext', this.defaultRenderer);

    // Register all 21 specialized renderers
    this.registerRenderer(createMarkdownRenderer());  // 1. Markdown (CORE-018)
    this.registerRenderer(createCodeRenderer());      // 2. Code (CORE-019)
    this.registerRenderer(createLatexRenderer());     // 3. LaTeX (CORE-020)
    this.registerRenderer(createHtmlRenderer());      // 4. HTML (CORE-021)
    this.registerRenderer(createMermaidRenderer());   // 5. Mermaid (CORE-022)
    this.registerRenderer(createThreejsRenderer());   // 6. Three.js (CORE-023)
    this.registerRenderer(createJsonRenderer());      // 7. JSON (CORE-024)
    this.registerRenderer(createXmlRenderer());       // 8. XML (CORE-025)
    this.registerRenderer(createCsvRenderer());       // 9. CSV (CORE-026)
    this.registerRenderer(createImageRenderer());     // 10. Image (CORE-027)
    this.registerRenderer(createVideoRenderer());     // 11. Video (CORE-028)
    this.registerRenderer(createAudioRenderer());     // 12. Audio (CORE-029)
    this.registerRenderer(createPdfRenderer());       // 13. PDF (CORE-030)
    this.registerRenderer(createDiffRenderer());      // 14. Diff (CORE-031)
    this.registerRenderer(createYamlRenderer());      // 15. YAML (CORE-032)
    this.registerRenderer(createGraphqlRenderer());   // 16. GraphQL (CORE-033)
    this.registerRenderer(createSqlRenderer());       // 17. SQL (CORE-034)
    this.registerRenderer(createRegexRenderer());     // 18. Regex (CORE-035)
    this.registerRenderer(createAsciiRenderer());     // 19. ASCII (CORE-036)
    this.registerRenderer(createColorRenderer());     // 20. Color (CORE-037)
    this.registerRenderer(createUrlRenderer());       // 21. URL (CORE-038)

    console.log('[MessageRenderer] Initialized with all 21 specialized renderers:', {
      rendererCount: this.renderers.size,
      registeredTypes: Array.from(this.renderers.keys()),
      utilities: {
        colorUtils: !!this.colorUtils,
        domBuilder: !!this.domBuilder,
        imageHandler: !!this.imageHandler,
        contentProcessor: !!this.contentProcessor
      }
    });
  }

  public static getInstance(): MessageRenderer {
    if (!MessageRenderer.instance) {
      MessageRenderer.instance = new MessageRenderer();
    }
    return MessageRenderer.instance;
  }

  /**
   * Register a specialized renderer
   *
   * @param renderer - Renderer instance implementing IRenderer interface
   */
  public registerRenderer(renderer: IRenderer): void {
    this.renderers.set(renderer.type, renderer);
    console.log(`[MessageRenderer] Registered renderer: ${renderer.type}`);
  }

  /**
   * Unregister a renderer
   *
   * @param type - Renderer type to remove
   */
  public unregisterRenderer(type: ContentType): void {
    this.renderers.delete(type);
    console.log(`[MessageRenderer] Unregister renderer: ${type}`);
  }

  /**
   * Get registered renderer by type
   *
   * @param type - Renderer type
   * @returns Renderer instance or undefined
   */
  public getRenderer(type: ContentType): IRenderer | undefined {
    return this.renderers.get(type);
  }

  /**
   * Render message to DOM
   *
   * @param message - Message model to render
   * @param options - Render options
   * @returns RenderResult with DOM refs and metadata
   */
  public async renderMessage(
    message: Message,
    options: MessageRenderOptions = {}
  ): Promise<RenderResult> {
    const {
      domOptions = {},
      imageOptions = {},
      enableThemeColor = true,
      forceRenderer,
      streaming = false,
      streamOptions = {},
      skipFinalize = false,
      onRenderComplete,
      onRenderError
    } = options;

    try {
      // Step 1: Build message DOM skeleton (now async)
      const refs = await this.domBuilder.buildMessageDOM(message, domOptions);

      // Step 2: Extract theme color from avatar (async, non-blocking)
      let themeColor: string | undefined;
      if (enableThemeColor && message.sender_id) {
        try {
          const avatarElement = refs.avatar?.querySelector('img') as HTMLImageElement;
          if (avatarElement && avatarElement.src) {
            themeColor = await this.colorUtils.getDominantColor(avatarElement.src);

            // Apply theme color to message container
            refs.container.style.setProperty('--message-theme-color', themeColor);
          }
        } catch (error) {
          console.warn('[MessageRenderer] Failed to extract theme color:', error);
        }
      }

      // Step 3: Detect content type
      let contentType: ContentType;
      let detectionResult: ContentDetectionResult;

      if (forceRenderer) {
        contentType = forceRenderer;
        detectionResult = {
          type: forceRenderer,
          confidence: 1.0,
          rawContent: message.content,
          metadata: {}
        };
      } else {
        // 🔑 传递sender参数以支持AI消息中的HTML代码可选渲染
        detectionResult = this.contentProcessor.detectContentType(
          message.content,
          message.sender  // 传递消息来源
        );
        contentType = detectionResult.type;
      }

      // Step 4: Get appropriate renderer
      const renderer = this.getRenderer(contentType) || this.defaultRenderer;

      // Step 5: Render content
      if (streaming && message.is_streaming) {
        // Streaming mode
        const streamManager = await this.renderStreaming(
          message,
          refs,
          renderer,
          contentType,
          streamOptions
        );

        const result: RenderResult = {
          refs,
          contentType,
          renderer,
          streamManager,
          themeColor
        };

        if (onRenderComplete) {
          onRenderComplete(refs);
        }

        return result;
      } else {
        // Non-streaming mode
        await this.renderStatic(
          message.content,
          refs.contentZone,
          renderer,
          detectionResult,
          skipFinalize  // 🔑 修复：传递skipFinalize选项
        );

        // Process images in rendered content
        this.processImages(refs.contentZone, imageOptions);

        const result: RenderResult = {
          refs,
          contentType,
          renderer,
          themeColor
        };

        if (onRenderComplete) {
          onRenderComplete(refs);
        }

        return result;
      }
    } catch (error) {
      console.error('[MessageRenderer] Render failed:', error);

      if (onRenderError) {
        onRenderError(error as Error);
      }

      throw error;
    }
  }

  /**
   * Render static (non-streaming) content
   */
  private async renderStatic(
    content: string,
    container: HTMLElement,
    renderer: IRenderer,
    detectionResult: ContentDetectionResult,
    skipFinalize: boolean = false  // 🔑 修复：添加skipFinalize参数
  ): Promise<void> {
    try {
      console.log(`[MessageRenderer] renderStatic() called for renderer: ${renderer.type}, skipFinalize: ${skipFinalize}`);

      const rendered = await renderer.render(
        detectionResult.rawContent,
        detectionResult.metadata
      );

      console.log(`[MessageRenderer] render() completed, rendered type: ${typeof rendered}`);

      if (typeof rendered === 'string') {
        container.innerHTML = rendered;
      } else {
        container.innerHTML = '';
        container.appendChild(rendered);
      }

      console.log(`[MessageRenderer] DOM updated, checking for finalize method: ${!!renderer.finalize}, skipFinalize: ${skipFinalize}`);

      // 🔑 修复：只有在skipFinalize为false时才调用finalize
      if (!skipFinalize && renderer.finalize) {
        console.log(`[MessageRenderer] Calling renderer.finalize() for ${renderer.type}`);
        await renderer.finalize(container);
        console.log(`[MessageRenderer] renderer.finalize() completed for ${renderer.type}`);
      } else if (skipFinalize) {
        console.log(`[MessageRenderer] Skipping finalize for ${renderer.type} (skipFinalize=true)`);
      } else {
        console.log(`[MessageRenderer] No finalize method for ${renderer.type}`);
      }
    } catch (error) {
      console.error('[MessageRenderer] Static render failed:', error);

      // Fallback to plaintext
      container.textContent = content;
      container.classList.add('render-error');

      // Re-throw to allow error handling in renderMessage
      throw error;
    }
  }

  /**
   * Render streaming content with chunk buffering
   */
  private async renderStreaming(
    message: Message,
    refs: MessageDOMRefs,
    renderer: IRenderer,
    contentType: ContentType,
    streamOptions: StreamManagerOptions
  ): Promise<StreamManager> {
    const container = refs.contentZone;

    // Store user-provided callbacks
    const userOnChunk = streamOptions.onChunk;
    const userOnComplete = streamOptions.onComplete;
    const userOnError = streamOptions.onError;

    // Create stream manager with combined callbacks
    const streamManager = createStreamManager({
      ...streamOptions,
      onChunk: (chunk, fullContent) => {
        // Use renderer's chunk handler if available
        if (renderer.renderChunk) {
          renderer.renderChunk(chunk.content, container);
        } else {
          // Default: append to container
          const textNode = document.createTextNode(chunk.content);
          container.appendChild(textNode);
        }

        // Call user-provided onChunk callback
        if (userOnChunk) {
          userOnChunk(chunk, fullContent);
        }
      },
      onComplete: async (fullContent) => {
        // Mark as complete
        this.domBuilder.markAsComplete(refs.container);

        console.log(`[MessageRenderer] Stream complete, calling finalize for renderer: ${renderer.type}, has finalize: ${!!renderer.finalize}`);

        // 🔑 修复：await异步finalize方法
        if (renderer.finalize) {
          console.log(`[MessageRenderer] Calling renderer.finalize() for ${renderer.type}`);
          await renderer.finalize(container);
          console.log(`[MessageRenderer] renderer.finalize() completed for ${renderer.type}`);
        } else {
          console.warn(`[MessageRenderer] Renderer ${renderer.type} has no finalize method`);
        }

        // Process images
        this.processImages(container, {});

        console.log(`[MessageRenderer] Streaming complete for message ${message.id}`);

        // Call user-provided onComplete callback
        if (userOnComplete) {
          userOnComplete(fullContent);
        }
      },
      onError: (error) => {
        console.error('[MessageRenderer] Streaming error:', error);
        this.domBuilder.markAsError(refs.container);

        // Show error message
        const errorEl = document.createElement('div');
        errorEl.className = 'stream-error';
        errorEl.textContent = `Stream error: ${error.message}`;
        container.appendChild(errorEl);

        // Call user-provided onError callback
        if (userOnError) {
          userOnError(error);
        }
      }
    });

    // Start streaming
    streamManager.start();

    return streamManager;
  }

  /**
   * Process images in rendered content
   * Convert img tags to lazy-loaded images
   */
  private processImages(container: HTMLElement, options: ImageHandlerOptions): void {
    const images = container.querySelectorAll('img');

    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) return;

      // Create lazy image
      const lazyImg = this.imageHandler.createLazyImage(src, {
        ...options,
        alt: img.getAttribute('alt') || '',
        className: img.className
      });

      // Replace original image
      img.replaceWith(lazyImg);
    });
  }

  /**
   * Update message content (for streaming updates)
   *
   * @param messageId - Message ID
   * @param newContent - New content chunk
   * @param streamManager - Stream manager instance
   */
  public updateStreamingContent(
    messageId: string,
    newContent: string,
    streamManager: StreamManager
  ): void {
    streamManager.push(newContent);
  }

  /**
   * Complete streaming message
   *
   * @param messageId - Message ID
   * @param streamManager - Stream manager instance
   */
  public completeStreaming(messageId: string, streamManager: StreamManager): void {
    streamManager.complete();
  }

  /**
   * Handle streaming error
   *
   * @param messageId - Message ID
   * @param error - Error object
   * @param streamManager - Stream manager instance
   */
  public errorStreaming(
    messageId: string,
    error: Error,
    streamManager: StreamManager
  ): void {
    streamManager.error(error);
  }

  /**
   * Re-render message content (for regeneration)
   *
   * @param message - Message model
   * @param container - Target container element
   * @param options - Render options
   */
  public async reRenderMessage(
    message: Message,
    container: HTMLElement,
    options: MessageRenderOptions = {}
  ): Promise<void> {
    // Clear existing content
    container.innerHTML = '';

    // Detect content type
    // 🔑 传递sender参数
    const detectionResult = this.contentProcessor.detectContentType(
      message.content,
      message.sender
    );

    // Get renderer
    const renderer = this.getRenderer(detectionResult.type) || this.defaultRenderer;

    // Render
    await this.renderStatic(
      message.content,
      container,
      renderer,
      detectionResult
    );

    // Process images
    this.processImages(container, options.imageOptions || {});
  }

  /**
   * Create default plaintext renderer
   */
  private createPlaintextRenderer(): IRenderer {
    return {
      type: 'markdown',

      canRender: (content: string) => true,

      render: (content: string, metadata?: Record<string, any>) => {
        // Transform content (auto-link URLs, process inline formatting)
        const transformed = this.contentProcessor.transformContent(content, {
          autoLinkUrls: true,
          escapeHtml: false,
          processInline: true
        });

        // Wrap in paragraph
        const container = document.createElement('div');
        container.className = 'message-content-plaintext';
        container.innerHTML = transformed;

        return container;
      },

      renderChunk: (chunk: string, container: HTMLElement) => {
        // For streaming: append text node
        const textNode = document.createTextNode(chunk);
        container.appendChild(textNode);
      },

      finalize: (container: HTMLElement) => {
        // Transform final content
        const finalContent = container.textContent || '';
        const transformed = this.contentProcessor.transformContent(finalContent, {
          autoLinkUrls: true,
          escapeHtml: false,
          processInline: true
        });

        container.innerHTML = transformed;
      }
    };
  }

  /**
   * Get all registered renderer types
   */
  public getRegisteredTypes(): ContentType[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Get renderer statistics
   */
  public getStats(): {
    registeredRenderers: number;
    rendererTypes: ContentType[];
    imageHandlerCacheSize: number;
  } {
    return {
      registeredRenderers: this.renderers.size,
      rendererTypes: this.getRegisteredTypes(),
      imageHandlerCacheSize: this.imageHandler.getCacheSize()
    };
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.imageHandler.clearCache();
    this.colorUtils.clearCache();
    console.log('[MessageRenderer] Caches cleared');
  }
}

/**
 * Factory function to get singleton instance
 */
export function getMessageRenderer(): MessageRenderer {
  return MessageRenderer.getInstance();
}

/**
 * Convenience function to render message
 */
export async function renderMessage(
  message: Message,
  options?: MessageRenderOptions
): Promise<RenderResult> {
  const renderer = getMessageRenderer();
  return renderer.renderMessage(message, options);
}

/**
 * Convenience function to register renderer
 */
export function registerRenderer(renderer: IRenderer): void {
  const messageRenderer = getMessageRenderer();
  messageRenderer.registerRenderer(renderer);
}

/**
 * Singleton instance export for direct access
 * Used by message-list and other components for simple rendering
 */
export const messageRenderer = {
  /**
   * Render message content to HTML string
   * Detects content type and applies appropriate rendering
   *
   * @param message - Message object to render
   * @returns Rendered HTML string
   */
  render(message: Message): string {
    const content = message.content;

    // Safety check
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Use contentProcessor to detect content type
    const processor = getContentProcessor();
    // 🔑 传递sender参数
    const detected = processor.detectContentType(content, message.sender);

    console.log('[messageRenderer.render] Content detected as:', detected.type, 'confidence:', detected.confidence);
    console.log('[messageRenderer.render] Content preview:', content.substring(0, 100));

    // Render based on detected type
    switch (detected.type) {
      case 'markdown':
        console.log('[messageRenderer.render] Calling renderMarkdown()');
        return this.renderMarkdown(content);

      case 'latex':
        console.log('[messageRenderer.render] Calling renderLatex()');
        return this.renderLatex(content, detected.metadata);

      case 'code':
        console.log('[messageRenderer.render] Calling renderCode()');
        return this.renderCode(content, detected.metadata);

      case 'html':
        console.log('[messageRenderer.render] Calling renderHtml()');
        return this.renderHtml(content);

      default:
        console.log('[messageRenderer.render] Using fallback plaintext rendering');
        // Fallback: auto-link URLs and return as plaintext
        return processor.transformContent(content, {
          autoLinkUrls: true,
          escapeHtml: false,
          processInline: true
        });
    }
  },

  /**
   * Render Markdown content with LaTeX support
   *
   * Note: Uses HTML comment-style placeholders to avoid Markdown interpretation.
   */
  renderMarkdown(content: string): string {
    console.log('[messageRenderer.renderMarkdown] START - content length:', content.length);

    if (!window.marked) {
      console.warn('[messageRenderer] marked.js not loaded, returning plain text');
      return content;
    }

    try {
      // Step 1: Preserve LaTeX by replacing with placeholders
      // CRITICAL: Use format that Markdown won't interpret as emphasis/formatting
      // Cannot use ___ (emphasis), *** (strong), ``` (code), etc.
      const latexBlocks: string[] = [];
      let processedContent = content;

      console.log('[messageRenderer.renderMarkdown] Original content:', content.substring(0, 150));

      // Preserve display math: $$...$$
      // Using LATEXBLOCKPLACEHOLDER format - pure alphanumeric, no special chars
      processedContent = processedContent.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
        const index = latexBlocks.length;
        latexBlocks.push(match);
        return `LATEXBLOCKPLACEHOLDER${index}END`;
      });

      // Preserve inline math: $...$
      processedContent = processedContent.replace(/\$([^$\n]+?)\$/g, (match) => {
        const index = latexBlocks.length;
        latexBlocks.push(match);
        return `LATEXINLINEPLACEHOLDER${index}END`;
      });

      // Preserve LaTeX environments: \begin{...}\end{...}
      processedContent = processedContent.replace(/\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g, (match) => {
        const index = latexBlocks.length;
        latexBlocks.push(match);
        return `LATEXBLOCKPLACEHOLDER${index}END`;
      });

      // Step 2: Render Markdown
      window.marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
      });
      const parseResult = window.marked.parse(processedContent);

      // CRITICAL: marked.parse() can return Promise in async mode
      // We need synchronous rendering for messageRenderer.render()
      if (parseResult instanceof Promise) {
        console.error('[messageRenderer] marked.parse returned Promise - async mode not supported in this context');
        return content;  // Fallback to original content
      }

      let html: string = parseResult;

      // Step 3: Restore and render LaTeX
      html = html.replace(/LATEXBLOCKPLACEHOLDER(\d+)END/g, (match: string, index: string) => {
        const latex = latexBlocks[parseInt(index, 10)];
        if (!latex || !window.katex) {
          return latex || match;
        }

        // Remove delimiters and render
        let latexCode = latex;
        if (latex.startsWith('$$') && latex.endsWith('$$')) {
          latexCode = latex.slice(2, -2).trim();
        } else if (latex.match(/^\\begin\{.*\}/)) {
          latexCode = latex; // Keep environment syntax
        }

        try {
          return window.katex.renderToString(latexCode, {
            displayMode: true,
            throwOnError: false,
            errorColor: '#E74C3C',
            strict: false,      // Allow non-standard LaTeX commands
            trust: false        // Security: don't trust user input
          });
        } catch (e) {
          console.error('[messageRenderer] LaTeX block render error:', e);
          return latex;
        }
      });

      html = html.replace(/LATEXINLINEPLACEHOLDER(\d+)END/g, (match: string, index: string) => {
        const latex = latexBlocks[parseInt(index, 10)];
        if (!latex || !window.katex) {
          return latex || match;
        }

        // Remove $ delimiters
        const latexCode = latex.slice(1, -1).trim();

        try {
          return window.katex.renderToString(latexCode, {
            displayMode: false,
            throwOnError: false,
            errorColor: '#E74C3C',
            strict: false,      // Allow non-standard LaTeX commands
            trust: false        // Security: don't trust user input
          });
        } catch (e) {
          console.error('[messageRenderer] LaTeX inline render error:', e);
          return latex;
        }
      });

      return html;
    } catch (error) {
      console.error('[messageRenderer] Markdown render error:', error);
      return content;
    }
  },

  /**
   * Render LaTeX content
   */
  renderLatex(content: string, metadata?: Record<string, any>): string {
    if (!window.katex) {
      console.warn('[messageRenderer] katex not loaded, returning plain text');
      return content;
    }

    try {
      const isDisplayMode = metadata?.displayMode || false;

      // Remove LaTeX delimiters
      let latexCode = content;
      if (content.startsWith('$$') && content.endsWith('$$')) {
        latexCode = content.slice(2, -2).trim();
      } else if (content.startsWith('$') && content.endsWith('$')) {
        latexCode = content.slice(1, -1).trim();
      } else if (content.startsWith('\\[') && content.endsWith('\\]')) {
        latexCode = content.slice(2, -2).trim();
      } else if (content.startsWith('\\(') && content.endsWith('\\)')) {
        latexCode = content.slice(2, -2).trim();
      }

      // Render LaTeX
      const html = window.katex.renderToString(latexCode, {
        displayMode: isDisplayMode,
        throwOnError: false,
        errorColor: '#E74C3C',
        strict: false
      });

      return html;
    } catch (error) {
      console.error('[messageRenderer] LaTeX render error:', error);
      return content;
    }
  },

  /**
   * Render code block
   */
  renderCode(content: string, metadata?: Record<string, any>): string {
    if (!window.hljs) {
      console.warn('[messageRenderer] highlight.js not loaded, returning plain code');
      return `<pre><code>${this.escapeHtml(content)}</code></pre>`;
    }

    try {
      const language = metadata?.language || 'plaintext';

      // Remove code block markers if present
      let code = content;
      const codeBlockMatch = /^```[\w]*\n([\s\S]+?)\n```$/.exec(content);
      if (codeBlockMatch) {
        code = codeBlockMatch[1];
      }

      // Highlight code
      let highlighted: string;
      if (language && language !== 'plaintext') {
        highlighted = window.hljs.highlight(code, { language }).value;
      } else {
        highlighted = window.hljs.highlightAuto(code).value;
      }

      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    } catch (error) {
      console.error('[messageRenderer] Code render error:', error);
      return `<pre><code>${this.escapeHtml(content)}</code></pre>`;
    }
  },

  /**
   * Render HTML content (sanitized)
   */
  renderHtml(content: string): string {
    // For now, just return the content
    // TODO: Add HTML sanitization to prevent XSS
    console.warn('[messageRenderer] HTML rendering without sanitization - potential security risk');
    return content;
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
