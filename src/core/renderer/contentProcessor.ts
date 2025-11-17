/**
 * Content Processor Module (CORE-018E)
 *
 * Responsibilities:
 * - Pre-compile regex patterns for content detection at module init
 * - Detect content types (Markdown, Code, LaTeX, HTML, etc.)
 * - Apply content transformations (URL linking, escaping, formatting)
 * - Parse code blocks with language and metadata extraction
 * - Process inline content (bold, italic, code spans)
 * - Handle escape sequences and special characters
 *
 * Architecture:
 * ┌────────────────────────────────────────────────┐
 * │ Raw Content → Detection → Transformation      │
 * │                   ↓              ↓             │
 * │           Regex Patterns   Processors          │
 * │                   ↓              ↓             │
 * │         Content Type    Processed Content      │
 * └────────────────────────────────────────────────┘
 *
 * Content Detection Flow:
 * 1. Pre-compiled patterns check content against 21 renderer types
 * 2. Priority order: Code blocks → LaTeX → HTML → Markdown → Plain text
 * 3. Returns renderer type and extracted metadata
 *
 * Transformation Pipeline:
 * 1. Escape HTML entities (if needed)
 * 2. Convert URLs to links
 * 3. Process inline formatting
 * 4. Apply syntax-specific transformations
 */

import type { MessageSender } from '../models/message';

/**
 * Supported content types (21 renderers)
 */
export type ContentType =
  | 'markdown'
  | 'code'
  | 'latex'
  | 'html'
  | 'mermaid'
  | 'threejs'
  | 'json'
  | 'xml'
  | 'csv'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'diff'
  | 'yaml'
  | 'graphql'
  | 'sql'
  | 'regex'
  | 'ascii'
  | 'color'
  | 'url';

/**
 * Content detection result
 */
export interface ContentDetectionResult {
  /**
   * Detected content type
   */
  type: ContentType;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Extracted metadata
   */
  metadata?: {
    language?: string;
    fileName?: string;
    lineNumbers?: boolean;
    highlight?: number[];
    title?: string;
    isRenderableHtml?: boolean;  // 🔑 标记为可渲染的HTML
    rawHtmlContent?: string;      // 🔑 保存原始HTML内容
    [key: string]: any;
  };

  /**
   * Raw content before transformation
   */
  rawContent: string;
}

/**
 * Code block metadata
 */
export interface CodeBlockMetadata {
  language: string;
  fileName?: string;
  lineNumbers?: boolean;
  highlight?: number[];
  startLine?: number;
  isRenderableHtml?: boolean;  // 🔑 标记为可渲染的HTML
  rawHtmlContent?: string;      // 🔑 保存原始HTML内容
}

/**
 * Transformation options
 */
export interface TransformationOptions {
  /**
   * Auto-link URLs
   * Default: true
   */
  autoLinkUrls?: boolean;

  /**
   * Escape HTML entities
   * Default: false
   */
  escapeHtml?: boolean;

  /**
   * Process inline formatting (bold, italic, code)
   * Default: true
   */
  processInline?: boolean;

  /**
   * Target renderer type (affects transformations)
   */
  targetType?: ContentType;

  /**
   * Preserve whitespace
   * Default: false
   */
  preserveWhitespace?: boolean;
}

/**
 * Pre-compiled regex patterns for content detection
 * Initialized at module load for performance
 */
class RegexPatterns {
  // Code block patterns
  public readonly codeBlockFenced = /^```(\w+)?\s*(?:\{([^}]+)\})?\n([\s\S]*?)```$/gm;
  public readonly codeBlockIndented = /^(?: {4}|\t).*$/gm;

  // LaTeX patterns
  public readonly latexDisplay = /\$\$[\s\S]+?\$\$/g;
  public readonly latexInline = /\$[^\$\n]+?\$/g;
  public readonly latexBlock = /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g;
  public readonly latexBracketDisplay = /\\\[[\s\S]+?\\\]/g;  // \[...\]
  public readonly latexParenInline = /\\\([\s\S]+?\\\)/g;     // \(...\)

  // HTML patterns
  public readonly htmlTag = /<\/?[a-z][\s\S]*?>/gi;
  public readonly htmlComment = /<!--[\s\S]*?-->/g;
  public readonly htmlEntity = /&(?:[a-z\d]+|#\d+|#x[a-f\d]+);/gi;

  // Mermaid patterns
  public readonly mermaidBlock = /```mermaid\n([\s\S]*?)```/g;
  public readonly mermaidKeyword = /^\s*(graph\s+(TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie)/mi;

  // URL patterns
  public readonly url = /https?:\/\/[^\s<>"\]]+/gi;
  public readonly urlWithProtocol = /^https?:\/\//i;

  // Inline formatting
  public readonly bold = /\*\*([^*]+)\*\*/g;
  public readonly italic = /\*([^*]+)\*/g;
  public readonly inlineCode = /`([^`]+)`/g;
  public readonly strikethrough = /~~([^~]+)~~/g;

  // JSON pattern
  public readonly json = /^\s*[\{\[]/;

  // XML pattern
  public readonly xml = /^\s*<\?xml/i;

  // CSV pattern
  public readonly csv = /^[^,\n]+(?:,[^,\n]+)+$/m;

  // Color patterns
  public readonly hexColor = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
  public readonly rgbColor = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi;
  public readonly hslColor = /hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)/gi;

  // File extension patterns
  public readonly imageExt = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
  public readonly videoExt = /\.(mp4|webm|ogg|mov|avi|mkv)$/i;
  public readonly audioExt = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
  public readonly pdfExt = /\.pdf$/i;

  // Markdown media syntax
  public readonly markdownImage = /!\[([^\]]*)\]\(([^)]+)\)/;

  // Markdown syntax indicators (for mixed content detection)
  public readonly markdownHeading = /^#{1,6}\s+.+$/m;
  public readonly markdownList = /^[\s]*[-*+]\s+.+$/m;
  public readonly markdownOrderedList = /^[\s]*\d+\.\s+.+$/m;
  public readonly markdownBlockquote = /^>\s+.+$/m;
  public readonly markdownLink = /\[([^\]]+)\]\(([^)]+)\)/;

  // Known video/image domains
  public readonly videoDomain = /(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv)/i;
  public readonly imageDomain = /(imgur\.com|flickr\.com|instagram\.com|cloudinary\.com)/i;

  // Diff patterns
  public readonly diffLine = /^(?:[+\-@]|diff --git)/m;

  // YAML patterns
  public readonly yamlStart = /^---\s*$/m;
  public readonly yamlKey = /^\s*[\w-]+:/m;

  // GraphQL patterns
  public readonly graphqlQuery = /^\s*(?:query|mutation|subscription|fragment)/i;

  // SQL patterns
  public readonly sqlKeyword = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i;

  // Regex pattern (meta!)
  public readonly regexPattern = /^\/.*\/[gimsuvy]*$/;

  // ASCII art detection (multiple lines of similar length with special chars)
  public readonly asciiArtLine = /^[^\w\s]{3,}$/m;
}

/**
 * Content Processor
 * Singleton class for content detection and transformation
 */
export class ContentProcessor {
  private static instance: ContentProcessor;

  // Pre-compiled regex patterns
  private readonly patterns: RegexPatterns;

  // Transformation processors cache
  private readonly processors: Map<string, (content: string, options: any) => string>;

  private constructor() {
    this.patterns = new RegexPatterns();
    this.processors = new Map();

    // Initialize transformation processors
    this.initializeProcessors();
  }

  public static getInstance(): ContentProcessor {
    if (!ContentProcessor.instance) {
      ContentProcessor.instance = new ContentProcessor();
    }
    return ContentProcessor.instance;
  }

  /**
   * Initialize transformation processors
   */
  private initializeProcessors(): void {
    // URL auto-linking processor
    this.processors.set('autoLinkUrls', (content: string) => {
      return content.replace(this.patterns.url, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      });
    });

    // HTML escape processor
    this.processors.set('escapeHtml', (content: string) => {
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    });

    // Inline formatting processor
    this.processors.set('processInline', (content: string) => {
      return content
        .replace(this.patterns.bold, '<strong>$1</strong>')
        .replace(this.patterns.italic, '<em>$1</em>')
        .replace(this.patterns.inlineCode, '<code>$1</code>')
        .replace(this.patterns.strikethrough, '<del>$1</del>');
    });

    // Whitespace preservation processor
    this.processors.set('preserveWhitespace', (content: string) => {
      return content.replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
    });
  }

  /**
   * Detect content type from raw content
   *
   * @param content - Raw content string
   * @param sender - Optional message sender ('user' or 'agent')
   * @returns ContentDetectionResult with type and metadata
   */
  public detectContentType(content: string, sender?: MessageSender): ContentDetectionResult {
    const trimmed = content.trim();

    // Priority 1: Mermaid diagrams
    // 🔑 修复：参考HTML检测逻辑，检查Mermaid代码块是否覆盖整个内容
    this.patterns.mermaidBlock.lastIndex = 0;
    const mermaidMatch = this.patterns.mermaidBlock.exec(trimmed);
    if (mermaidMatch) {
      // 检查Mermaid代码块是否覆盖整个内容
      const matchStart = mermaidMatch.index;
      const matchEnd = matchStart + mermaidMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        // 整个内容都是Mermaid代码块，使用MermaidRenderer
        return {
          type: 'mermaid',
          confidence: 1.0,
          metadata: {},
          rawContent: mermaidMatch[1]
        };
      } else {
        // 包含其他内容（如说明文字），使用MarkdownRenderer
        // MarkdownRenderer会调用MermaidRenderer来渲染Mermaid部分
        return {
          type: 'markdown',
          confidence: 0.95,
          metadata: {},
          rawContent: trimmed
        };
      }
    }

    // Priority 1.5: Bare Mermaid keywords (without code blocks)
    if (this.patterns.mermaidKeyword.test(trimmed)) {
      return {
        type: 'mermaid',
        confidence: 0.9,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 2: Code blocks (fenced) - Only if the ENTIRE content is a code block
    this.patterns.codeBlockFenced.lastIndex = 0;
    const codeBlockMatch = this.patterns.codeBlockFenced.exec(trimmed);
    if (codeBlockMatch) {
      // Check if the match covers the entire content (not just embedded in markdown)
      const matchStart = codeBlockMatch.index;
      const matchEnd = matchStart + codeBlockMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        const language = (codeBlockMatch[1] || 'plaintext').toLowerCase();
        const metadata = this.parseCodeBlockMetadata(codeBlockMatch[2] || '');
        const codeContent = codeBlockMatch[3];

        // Map language identifiers to specialized renderers
        // This allows ```yaml, ```diff, ```sql, etc. to use their specialized renderers
        let contentType: ContentType = 'code';

        if (language === 'diff' || language === 'patch') {
          contentType = 'diff';
        } else if (language === 'yaml' || language === 'yml') {
          contentType = 'yaml';
        } else if (language === 'graphql' || language === 'gql') {
          contentType = 'graphql';
        } else if (language === 'sql' || language === 'mysql' || language === 'postgresql' || language === 'sqlite') {
          contentType = 'sql';
        } else if (language === 'ascii' || language === 'asciiart' || language === 'art') {
          contentType = 'ascii';
        } else if (language === 'json') {
          // JSON in code blocks should use JSON renderer for tree view
          contentType = 'json';
        } else if (language === 'xml' || language === 'html') {
          // XML/HTML in code blocks should use their specialized renderers
          contentType = language as ContentType;
        }

        return {
          type: contentType,
          confidence: 1.0,
          metadata: {
            ...metadata,    // ← Spread first
            language        // ← Then override with detected language
          },
          rawContent: codeContent
        };
      }
      // If code block is embedded in other content, fall through to markdown detection
    }

    // Priority 3: LaTeX (display math) - Only if ENTIRE content is LaTeX
    this.patterns.latexDisplay.lastIndex = 0;
    const latexDisplayMatch = this.patterns.latexDisplay.exec(trimmed);
    if (latexDisplayMatch) {
      // Check if the match covers the entire content
      const matchStart = latexDisplayMatch.index;
      const matchEnd = matchStart + latexDisplayMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        return {
          type: 'latex',
          confidence: 0.95,
          metadata: { displayMode: true },
          rawContent: trimmed
        };
      }
      // If LaTeX is embedded in other content, fall through to markdown detection
    }

    // Priority 4: LaTeX (environment blocks) - Only if ENTIRE content
    this.patterns.latexBlock.lastIndex = 0;
    const latexBlockMatch = this.patterns.latexBlock.exec(trimmed);
    if (latexBlockMatch) {
      const matchStart = latexBlockMatch.index;
      const matchEnd = matchStart + latexBlockMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        return {
          type: 'latex',
          confidence: 0.95,
          metadata: { displayMode: true },
          rawContent: trimmed
        };
      }
    }

    // Priority 4.5: LaTeX (inline math) - Only if ENTIRE content is a single LaTeX expression
    // Only detect if not inside code blocks
    this.patterns.latexInline.lastIndex = 0;
    const latexInlineMatch = this.patterns.latexInline.exec(trimmed);

    if (latexInlineMatch) {
      // Check if the match covers the entire content
      const matchStart = latexInlineMatch.index;
      const matchEnd = matchStart + latexInlineMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      // Also check no code blocks present
      this.patterns.codeBlockFenced.lastIndex = 0;
      const hasCodeBlock = this.patterns.codeBlockFenced.test(trimmed);

      if (isEntireContent && !hasCodeBlock) {
        return {
          type: 'latex',
          confidence: 0.85,
          metadata: { displayMode: false },
          rawContent: trimmed
        };
      }
      // If LaTeX is embedded in other content, fall through to markdown detection
    }

    // Priority 4.6: LaTeX bracket display math \[...\] - Only if ENTIRE content
    this.patterns.latexBracketDisplay.lastIndex = 0;
    const latexBracketMatch = this.patterns.latexBracketDisplay.exec(trimmed);
    if (latexBracketMatch) {
      const matchStart = latexBracketMatch.index;
      const matchEnd = matchStart + latexBracketMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        return {
          type: 'latex',
          confidence: 0.9,
          metadata: { displayMode: true },
          rawContent: trimmed
        };
      }
    }

    // Priority 4.7: LaTeX paren inline math \(...\) - Only if ENTIRE content
    this.patterns.latexParenInline.lastIndex = 0;
    const latexParenMatch = this.patterns.latexParenInline.exec(trimmed);
    if (latexParenMatch) {
      const matchStart = latexParenMatch.index;
      const matchEnd = matchStart + latexParenMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        return {
          type: 'latex',
          confidence: 0.85,
          metadata: { displayMode: false },
          rawContent: trimmed
        };
      }
    }

    // Priority 5: XML (check before HTML since XML also contains HTML-like tags)
    // XML must start with <?xml declaration
    if (this.patterns.xml.test(trimmed)) {
      return {
        type: 'xml',
        confidence: 0.95,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 6: HTML
    if (this.patterns.htmlTag.test(trimmed)) {
      const tagCount = (trimmed.match(this.patterns.htmlTag) || []).length;
      const confidence = Math.min(tagCount / 5, 1.0); // More tags = higher confidence

      // 🔑 修复：检查是否包含Markdown代码块标记
      const hasMarkdownCodeBlock = /```/.test(trimmed);

      // 🔑 关键修改：AI消息中的HTML识别为代码块（可渲染）
      if (sender === 'agent') {
        // 如果包含Markdown代码块标记，直接返回Markdown类型
        // 这样可以避免被后续的Color等检测器误判
        if (hasMarkdownCodeBlock) {
          return {
            type: 'markdown',
            confidence: 0.95,
            metadata: {},
            rawContent: trimmed
          };
        } else {
          // AI消息：纯HTML内容，识别为代码块，但保留元数据标记
          return {
            type: 'code',
            confidence: 0.9,
            metadata: {
              language: 'html',
              isRenderableHtml: true,  // 标记为可渲染的HTML
              rawHtmlContent: trimmed   // 保存原始HTML内容
            },
            rawContent: trimmed
          };
        }
      } else {
        // 用户消息：保持原有行为，直接渲染为HTML
        return {
          type: 'html',
          confidence,
          metadata: {},
          rawContent: trimmed
        };
      }
    }

    // Priority 7: Three.js scene (check before JSON since Three.js scenes are JSON)
    // Check for Three.js scene definition or keywords
    if (this.patterns.json.test(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed);
        // Check if it's a Three.js scene definition
        if (parsed.type === 'scene' || parsed.type === 'model' ||
            parsed.objects || parsed.modelUrl || parsed.camera || parsed.lights) {
          return {
            type: 'threejs',
            confidence: 0.95,
            metadata: {},
            rawContent: trimmed
          };
        }
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // Check for Three.js code keywords
    const threejsKeywords = [
      /THREE\./,
      /new\s+Scene\(\)/,
      /PerspectiveCamera/,
      /WebGLRenderer/,
      /BoxGeometry|SphereGeometry|CylinderGeometry/,
      /MeshStandardMaterial|MeshBasicMaterial/
    ];

    if (threejsKeywords.some(pattern => pattern.test(trimmed))) {
      return {
        type: 'threejs',
        confidence: 0.9,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 8: JSON (moved after Three.js check)
    if (this.patterns.json.test(trimmed)) {
      try {
        JSON.parse(trimmed);
        return {
          type: 'json',
          confidence: 1.0,
          metadata: {},
          rawContent: trimmed
        };
      } catch {
        // Not valid JSON, continue detection
      }
    }

    // Priority 8: CSV
    // Strengthen detection: require multiple lines with consistent comma counts
    if (this.patterns.csv.test(trimmed)) {
      const lines = trimmed.split('\n').filter(line => line.trim().length > 0);

      // Must have at least 2 lines
      if (lines.length >= 2) {
        // Count commas in each line
        const commaCounts = lines.map(line => (line.match(/,/g) || []).length);

        // Check if most lines have commas (CSV-like structure)
        const linesWithCommas = commaCounts.filter(count => count > 0).length;
        const commaLineRatio = linesWithCommas / lines.length;

        // Check if comma counts are relatively consistent (within ±1)
        const avgCommas = commaCounts.reduce((a, b) => a + b, 0) / commaCounts.length;
        const consistentCommas = commaCounts.filter(count =>
          Math.abs(count - avgCommas) <= 1
        ).length;
        const consistencyRatio = consistentCommas / lines.length;

        // Only classify as CSV if:
        // 1. At least 70% of lines have commas
        // 2. Comma counts are relatively consistent (70%+ within ±1 of average)
        // 3. Average comma count is at least 1
        if (commaLineRatio >= 0.7 && consistencyRatio >= 0.7 && avgCommas >= 1) {
          const confidence = Math.min(commaLineRatio * consistencyRatio, 0.9);

          return {
            type: 'csv',
            confidence,
            metadata: {},
            rawContent: trimmed
          };
        }
      }
      // If CSV pattern matched but didn't pass stricter checks, fall through to other detection
    }

    // Priority 9: File extensions and media URLs (image, video, audio, pdf) - MOVED BEFORE YAML
    // Check for media URLs before YAML to avoid misdetection

    // Check Markdown image syntax first - Only if it's the ENTIRE content
    const markdownImageMatch = this.patterns.markdownImage.exec(trimmed);
    if (markdownImageMatch) {
      // Check if the match covers the entire content
      const matchStart = markdownImageMatch.index;
      const matchEnd = matchStart + markdownImageMatch[0].length;
      const isEntireContent = (matchStart === 0 && matchEnd === trimmed.length);

      if (isEntireContent) {
        return {
          type: 'image',
          confidence: 0.95,
          metadata: { src: markdownImageMatch[2], alt: markdownImageMatch[1] },
          rawContent: trimmed
        };
      }
      // If image markdown is embedded in other content, fall through to markdown detection
    }

    // Check file extensions
    // For URLs with query params, extract the pathname before checking extension
    let pathToCheck = trimmed;
    this.patterns.url.lastIndex = 0;  // Reset regex state
    if (this.patterns.url.test(trimmed)) {
      try {
        const urlObj = new URL(trimmed);
        pathToCheck = urlObj.pathname;
      } catch {
        // If URL parsing fails, use the original string
      }
    }

    if (this.patterns.imageExt.test(pathToCheck)) {
      return {
        type: 'image',
        confidence: 0.9,
        metadata: { src: trimmed },
        rawContent: trimmed
      };
    }

    if (this.patterns.videoExt.test(pathToCheck)) {
      return {
        type: 'video',
        confidence: 0.9,
        metadata: { src: trimmed },
        rawContent: trimmed
      };
    }

    // Check known video domains (YouTube, Vimeo, etc.)
    if (this.patterns.videoDomain.test(trimmed)) {
      return {
        type: 'video',
        confidence: 0.85,
        metadata: { src: trimmed },
        rawContent: trimmed
      };
    }

    // Check known image domains
    if (this.patterns.imageDomain.test(trimmed)) {
      return {
        type: 'image',
        confidence: 0.8,
        metadata: { src: trimmed },
        rawContent: trimmed
      };
    }

    if (this.patterns.audioExt.test(trimmed)) {
      return {
        type: 'audio',
        confidence: 0.9,
        metadata: { src: trimmed },
        rawContent: trimmed
      };
    }

    if (this.patterns.pdfExt.test(trimmed)) {
      return {
        type: 'pdf',
        confidence: 0.9,
        metadata: { src: trimmed },
        rawContent: trimmed
      };
    }

    // Priority 10: YAML (was Priority 9)
    // Strengthen detection: require YAML document marker OR multiple consistent key-value lines

    // Check for YAML document marker (---) at START of document
    // BUT: --- in markdown is also a horizontal rule, so we need to be careful
    // YAML documents typically have --- at the very beginning, followed by key: value pairs
    // Markdown --- is usually a section divider with content before/after
    if (this.patterns.yamlStart.test(trimmed)) {
      // Check if this is YAML or markdown horizontal rule
      // YAML: starts with --- and has key: value pairs immediately after
      // Markdown: has content before ---, or has markdown features

      const lines = trimmed.split('\n');
      const dashLineIndex = lines.findIndex(line => /^---\s*$/.test(line));

      // If --- is not at the beginning (index > 0), it's likely markdown
      if (dashLineIndex > 0) {
        console.log('[ContentProcessor] --- found but not at start, likely markdown horizontal rule');
        // Fall through to other detection
      } else {
        // --- is at the start, check if followed by YAML content
        // Look for key: value pairs in the next few lines
        const nextLines = lines.slice(1, 6); // Check next 5 lines
        const hasYamlKeys = nextLines.some(line => /^\s*[\w-]+:\s*/.test(line));

        // Check for markdown features
        const hasMarkdownHeadings = /^#{1,6}\s+/m.test(trimmed);
        const hasCodeBlocks = this.patterns.codeBlockFenced.test(trimmed);
        const hasMarkdownFormatting = /\*\*[^*]+\*\*|__[^_]+__|`[^`]+`/m.test(trimmed);

        if (hasYamlKeys && !hasMarkdownHeadings && !hasCodeBlocks && !hasMarkdownFormatting) {
          // Likely YAML
          console.log('[ContentProcessor] YAML detected via document marker at start with keys');
          return {
            type: 'yaml',
            confidence: 0.9,
            metadata: {},
            rawContent: trimmed
          };
        } else {
          console.log('[ContentProcessor] --- at start but has markdown features, treating as markdown');
          // Fall through to markdown
        }
      }
    }

    // Check for YAML-like key-value structure
    // Only classify as YAML if:
    // 1. Has multiple lines with key: value pattern
    // 2. Keys are consistently indented (YAML structure)
    // 3. Not inside markdown code blocks or headings
    if (this.patterns.yamlKey.test(trimmed)) {
      const lines = trimmed.split('\n');
      const yamlKeyLines = lines.filter(line => /^\s*[\w-]+:\s*/.test(line));

      console.log('[ContentProcessor] YAML key pattern matched', {
        totalLines: lines.length,
        yamlKeyLines: yamlKeyLines.length,
        firstFewLines: lines.slice(0, 5)
      });

      // Must have at least 3 key-value lines to be YAML
      // Single key-value lines are likely markdown headings or prose with colons
      if (yamlKeyLines.length >= 3) {
        // Check if NOT inside markdown (no ### headings, no code blocks)
        const hasMarkdownHeadings = /^#{1,6}\s+/m.test(trimmed);
        const hasCodeBlocks = this.patterns.codeBlockFenced.test(trimmed);
        const hasMarkdownFormatting = /\*\*[^*]+\*\*|__[^_]+__|`[^`]+`/m.test(trimmed);

        console.log('[ContentProcessor] YAML check - has markdown features?', {
          hasMarkdownHeadings,
          hasCodeBlocks,
          hasMarkdownFormatting
        });

        // If has markdown features, not YAML
        if (hasMarkdownHeadings || hasCodeBlocks || hasMarkdownFormatting) {
          console.log('[ContentProcessor] YAML rejected - has markdown features, falling through');
          // Fall through to markdown detection
        } else {
          // Likely YAML
          const confidence = Math.min(yamlKeyLines.length / lines.length, 0.8);
          console.log('[ContentProcessor] YAML confirmed', { confidence });
          return {
            type: 'yaml',
            confidence,
            metadata: {},
            rawContent: trimmed
          };
        }
      } else {
        console.log('[ContentProcessor] YAML rejected - not enough key-value lines (<3)');
      }
      // If < 3 key-value lines, fall through to other detection
    }

    // Priority 11: GraphQL (was Priority 10)
    if (this.patterns.graphqlQuery.test(trimmed)) {
      return {
        type: 'graphql',
        confidence: 0.9,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 12: SQL (was Priority 11)
    if (this.patterns.sqlKeyword.test(trimmed)) {
      return {
        type: 'sql',
        confidence: 0.85,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 13: Diff (was Priority 12)
    // Strengthen detection: require actual diff syntax, not just lines starting with +/-
    // Real diffs have:
    // 1. "diff --git" header OR "---/+++" file markers
    // 2. "@@ ... @@" hunk headers
    // 3. Lines starting with exactly one +/- followed by content (not "- list item")
    //
    // Markdown lists use "- " or "* " with space, diffs use "+line" or "-line" without space after
    const lines = trimmed.split('\n');

    // Check for diff headers
    const hasDiffHeader = /^diff --git/.test(trimmed) || /^---.*\n\+\+\+/.test(trimmed);
    const hasHunkHeader = /@@ -\d+,\d+ \+\d+,\d+ @@/.test(trimmed);

    // Check for diff-style additions/deletions (+ or - at start without space)
    // Exclude markdown lists (- followed by space) and numbered additions (just + alone)
    const diffAddDel = lines.filter(line => {
      // Match: +content or -content (no space after +/-)
      // Don't match: "- list" (markdown list) or "+ item" (markdown list)
      // Don't match: standalone + or -
      return /^[+\-][^\s]/.test(line) && line.length > 1;
    });

    // Require either diff headers OR multiple diff-style lines with hunk headers
    if (hasDiffHeader || (hasHunkHeader && diffAddDel.length >= 2)) {
      console.log('[ContentProcessor] Diff detected', {
        hasDiffHeader,
        hasHunkHeader,
        diffAddDelCount: diffAddDel.length
      });

      return {
        type: 'diff',
        confidence: 0.9,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 14: Regex pattern (was Priority 13)
    if (this.patterns.regexPattern.test(trimmed)) {
      return {
        type: 'regex',
        confidence: 0.7,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 15: Color values (was Priority 14)
    if (
      this.patterns.hexColor.test(trimmed) ||
      this.patterns.rgbColor.test(trimmed) ||
      this.patterns.hslColor.test(trimmed)
    ) {
      return {
        type: 'color',
        confidence: 0.7,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Priority 16: URL (was Priority 15)
    // Only classify as URL if the content is PRIMARILY a URL (not just contains a URL)
    // URL should be at least 70% of the content length
    if (this.patterns.urlWithProtocol.test(trimmed)) {
      const urlMatch = trimmed.match(/https?:\/\/[^\s<>"\]]+/gi);
      if (urlMatch) {
        const urlLength = urlMatch.join('').length;
        const contentLength = trimmed.length;
        const urlRatio = urlLength / contentLength;

        // If URL is at least 70% of content, classify as URL
        if (urlRatio >= 0.7) {
          return {
            type: 'url',
            confidence: urlRatio,
            metadata: {},
            rawContent: trimmed
          };
        }
      }
      // If URL is embedded in text, fall through to markdown detection
    }

    // Priority 17: ASCII art (was Priority 17, no change)
    const asciiLines = lines.filter(line => this.patterns.asciiArtLine.test(line));
    if (lines.length > 3 && asciiLines.length >= lines.length * 0.5) {
      return {
        type: 'ascii',
        confidence: 0.7,
        metadata: {},
        rawContent: trimmed
      };
    }

    // Default: Markdown
    return {
      type: 'markdown',
      confidence: 0.5,
      metadata: {},
      rawContent: trimmed
    };
  }

  /**
   * Parse code block metadata from info string
   * Format: {fileName="app.ts" lineNumbers=true highlight=[1,3,5]}
   */
  private parseCodeBlockMetadata(infoString: string): CodeBlockMetadata {
    const metadata: CodeBlockMetadata = {
      language: 'plaintext'
    };

    if (!infoString) return metadata;

    // Parse key-value pairs
    const kvPattern = /(\w+)=(?:"([^"]*)"|(\[[\d,\s]+\])|(true|false))/g;
    let match: RegExpExecArray | null;

    while ((match = kvPattern.exec(infoString)) !== null) {
      const key = match[1];
      const stringValue = match[2];
      const arrayValue = match[3];
      const boolValue = match[4];

      if (key === 'fileName' && stringValue) {
        metadata.fileName = stringValue;
      } else if (key === 'lineNumbers' && boolValue) {
        metadata.lineNumbers = boolValue === 'true';
      } else if (key === 'highlight' && arrayValue) {
        try {
          metadata.highlight = JSON.parse(arrayValue);
        } catch {
          // Ignore invalid array syntax
        }
      } else if (key === 'startLine') {
        metadata.startLine = parseInt(stringValue || '1', 10);
      }
    }

    return metadata;
  }

  /**
   * Transform content with specified options
   *
   * @param content - Raw content to transform
   * @param options - Transformation options
   * @returns Transformed content
   */
  public transformContent(
    content: string,
    options: TransformationOptions = {}
  ): string {
    const {
      autoLinkUrls = true,
      escapeHtml = false,
      processInline = true,
      preserveWhitespace = false
    } = options;

    let transformed = content;

    // Apply processors in order
    if (escapeHtml) {
      const processor = this.processors.get('escapeHtml');
      if (processor) transformed = processor(transformed, {});
    }

    if (autoLinkUrls) {
      const processor = this.processors.get('autoLinkUrls');
      if (processor) transformed = processor(transformed, {});
    }

    if (processInline) {
      const processor = this.processors.get('processInline');
      if (processor) transformed = processor(transformed, {});
    }

    if (preserveWhitespace) {
      const processor = this.processors.get('preserveWhitespace');
      if (processor) transformed = processor(transformed, {});
    }

    return transformed;
  }

  /**
   * Extract code blocks from content
   *
   * @param content - Content containing code blocks
   * @returns Array of code blocks with metadata
   */
  public extractCodeBlocks(content: string): Array<{
    language: string;
    code: string;
    metadata: CodeBlockMetadata;
    startIndex: number;
    endIndex: number;
  }> {
    const blocks: Array<{
      language: string;
      code: string;
      metadata: CodeBlockMetadata;
      startIndex: number;
      endIndex: number;
    }> = [];

    // Reset regex
    this.patterns.codeBlockFenced.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = this.patterns.codeBlockFenced.exec(content)) !== null) {
      const language = match[1] || 'plaintext';
      const infoString = match[2] || '';
      const code = match[3];
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;

      const metadata = this.parseCodeBlockMetadata(infoString);
      metadata.language = language;

      blocks.push({
        language,
        code,
        metadata,
        startIndex,
        endIndex
      });
    }

    return blocks;
  }

  /**
   * Escape HTML entities
   */
  public escapeHtml(content: string): string {
    const processor = this.processors.get('escapeHtml');
    return processor ? processor(content, {}) : content;
  }

  /**
   * Unescape HTML entities
   */
  public unescapeHtml(content: string): string {
    return content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  /**
   * Strip HTML tags from content
   */
  public stripHtmlTags(content: string): string {
    return content.replace(this.patterns.htmlTag, '');
  }

  /**
   * Extract URLs from content
   */
  public extractUrls(content: string): string[] {
    const urls = content.match(this.patterns.url);
    return urls ? Array.from(new Set(urls)) : [];
  }

  /**
   * Check if content contains LaTeX
   */
  public hasLatex(content: string): boolean {
    return (
      this.patterns.latexDisplay.test(content) ||
      this.patterns.latexInline.test(content) ||
      this.patterns.latexBlock.test(content) ||
      this.patterns.latexBracketDisplay.test(content) ||
      this.patterns.latexParenInline.test(content)
    );
  }

  /**
   * Check if content contains code blocks
   */
  public hasCodeBlocks(content: string): boolean {
    return this.patterns.codeBlockFenced.test(content);
  }

  /**
   * Check if content is valid JSON
   */
  public isValidJson(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get regex patterns (for external use if needed)
   */
  public getPatterns(): RegexPatterns {
    return this.patterns;
  }
}

/**
 * Factory function to get singleton instance
 */
export function getContentProcessor(): ContentProcessor {
  return ContentProcessor.getInstance();
}

/**
 * Convenience function to detect content type
 */
export function detectContentType(content: string, sender?: MessageSender): ContentDetectionResult {
  const processor = getContentProcessor();
  return processor.detectContentType(content, sender);
}

/**
 * Convenience function to transform content
 */
export function transformContent(
  content: string,
  options?: TransformationOptions
): string {
  const processor = getContentProcessor();
  return processor.transformContent(content, options);
}

/**
 * Convenience function to extract code blocks
 */
export function extractCodeBlocks(content: string) {
  const processor = getContentProcessor();
  return processor.extractCodeBlocks(content);
}
