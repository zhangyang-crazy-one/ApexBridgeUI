/**
 * Content Detection Constants
 *
 * Pre-compiled regex patterns for content type detection and parsing.
 * All patterns are compiled at module initialization for optimal performance.
 *
 * CORE-012C: Pre-compile all regex patterns for content detection at module init
 */

/**
 * Markdown patterns
 */
export const MARKDOWN_PATTERNS = {
  // Code blocks
  CODE_BLOCK: /```(\w+)?\n([\s\S]*?)```/g,
  INLINE_CODE: /`([^`]+)`/g,

  // Headers
  HEADER: /^(#{1,6})\s+(.+)$/gm,

  // Lists
  ORDERED_LIST: /^\d+\.\s+(.+)$/gm,
  UNORDERED_LIST: /^[-*+]\s+(.+)$/gm,

  // Links and images
  LINK: /\[([^\]]+)\]\(([^)]+)\)/g,
  IMAGE: /!\[([^\]]*)\]\(([^)]+)\)/g,

  // Emphasis
  BOLD: /\*\*([^*]+)\*\*/g,
  ITALIC: /\*([^*]+)\*/g,
  STRIKETHROUGH: /~~([^~]+)~~/g,

  // Blockquote
  BLOCKQUOTE: /^>\s+(.+)$/gm,

  // Horizontal rule
  HR: /^[-*_]{3,}$/gm
} as const;

/**
 * Code syntax patterns
 */
export const CODE_PATTERNS = {
  // Common languages
  PYTHON: /^(def|class|import|from|if|for|while|try|except|with)\s/m,
  JAVASCRIPT: /^(function|const|let|var|class|import|export|if|for|while|try|catch)\s/m,
  TYPESCRIPT: /^(interface|type|enum|namespace|declare|import|export)\s/m,
  JAVA: /^(public|private|protected|class|interface|import|package)\s/m,
  CSHARP: /^(using|namespace|class|interface|public|private|protected)\s/m,
  CPP: /^(#include|namespace|class|struct|public|private|protected)\s/m,
  RUST: /^(fn|pub|use|mod|struct|enum|impl|trait)\s/m,
  GO: /^(package|import|func|type|struct|interface)\s/m,
  RUBY: /^(def|class|module|require|include|if|unless|while)\s/m,
  PHP: /^(<\?php|namespace|use|class|interface|trait|function)\s/m,

  // Shell scripts
  BASH: /^(#!\/bin\/bash|#!\/bin\/sh|if|then|else|fi|for|while|do|done)\s/m,

  // Markup
  HTML: /<\/?[a-z][\s\S]*>/i,
  XML: /<\?xml|<[a-z][\s\S]*>/i,

  // Data formats
  JSON: /^\s*[\[{][\s\S]*[\]}]\s*$/,
  YAML: /^[\w-]+:\s/m,
  TOML: /^\[[\w.-]+\]$/m,

  // Query languages
  SQL: /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN)\s/im,
  GRAPHQL: /^(query|mutation|subscription|fragment|type|interface|enum|union|input)\s/m,

  // Config
  DOCKERFILE: /^(FROM|RUN|COPY|ADD|WORKDIR|ENV|EXPOSE|CMD|ENTRYPOINT)\s/m,
  NGINX: /^(server|location|listen|root|index|proxy_pass)\s/m
} as const;

/**
 * LaTeX patterns
 */
export const LATEX_PATTERNS = {
  // Display math
  DISPLAY_MATH: /\$\$([\s\S]+?)\$\$/g,
  BRACKET_DISPLAY: /\\\[([\s\S]+?)\\\]/g,

  // Inline math
  INLINE_MATH: /\$([^$]+)\$/g,
  PAREN_INLINE: /\\\(([^)]+?)\\\)/g,

  // Environments
  ENVIRONMENT: /\\begin{(\w+)}([\s\S]*?)\\end{\1}/g,

  // Commands
  COMMAND: /\\([a-zA-Z]+)(\{[^}]*\})?/g
} as const;

/**
 * URL patterns
 */
export const URL_PATTERNS = {
  // URL detection
  URL: /https?:\/\/[^\s<>"]+/g,
  DOMAIN: /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/,

  // URL components
  PROTOCOL: /^(https?):\/\//,
  PATH: /^https?:\/\/[^/]+(\/.*)$/,
  QUERY: /\?([^#]*)/,
  FRAGMENT: /#(.*)$/
} as const;

/**
 * Media patterns
 */
export const MEDIA_PATTERNS = {
  // Images
  IMAGE_URL: /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?[^"'\s]*)?$/i,
  IMAGE_DATA: /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/,

  // Videos
  VIDEO_URL: /\.(mp4|webm|ogg|mov|avi|mkv)(\?[^"'\s]*)?$/i,
  VIDEO_DATA: /^data:video\/(mp4|webm|ogg);base64,/,

  // Audio
  AUDIO_URL: /\.(mp3|wav|ogg|m4a|aac|flac|wma)(\?[^"'\s]*)?$/i,
  AUDIO_DATA: /^data:audio\/(mp3|wav|ogg|mpeg);base64,/,

  // Documents
  PDF_URL: /\.pdf(\?[^"'\s]*)?$/i,
  PDF_DATA: /^data:application\/pdf;base64,/
} as const;

/**
 * Special content patterns
 */
export const SPECIAL_PATTERNS = {
  // Diagrams
  MERMAID: /```mermaid\n([\s\S]*?)```/g,

  // JSON
  JSON_BLOCK: /```json\n([\s\S]*?)```/g,

  // CSV/Tables
  CSV: /```csv\n([\s\S]*?)```/g,
  TABLE: /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g,

  // Diff
  DIFF: /```diff\n([\s\S]*?)```/g,

  // Color codes
  HEX_COLOR: /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g,
  RGB_COLOR: /rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/g,
  RGBA_COLOR: /rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)/g,

  // ASCII art
  ASCII_ART: /^[\s\S]*?[┌┐└┘│─├┤┬┴┼╔╗╚╝║═╠╣╦╩╬]+[\s\S]*$/m,

  // Emoji
  EMOJI: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
} as const;

/**
 * VCP protocol patterns
 */
export const VCP_PATTERNS = {
  // Tool request
  TOOL_REQUEST: /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g,

  // Tool parameters
  TOOL_PARAM: /(\w+):「始」([\s\S]*?)「末」/g,

  // Memory injection
  DIARY_FULL: /\{\{([^}]+)\}\}/g,      // {{日记本}} - Full text injection
  DIARY_RAG: /\[\[([^\]]+)\]\]/g,      // [[日记本]] - RAG search
  DIARY_SIMILARITY_FULL: /<<([^>]+)>>/g,  // <<日记本>> - Similarity full text
  DIARY_SIMILARITY_RAG: /《《([^》]+)》》/g,  // 《《日记本》》 - Similarity RAG

  // Diary write
  DIARY_WRITE: /<<<DailyNoteStart>>>([\s\S]*?)<<<DailyNoteEnd>>>/g,

  // Agent reference
  AGENT_REF: /@(\w+)/g
} as const;

/**
 * Whitespace and formatting patterns
 */
export const FORMAT_PATTERNS = {
  // Line breaks
  NEWLINE: /\r?\n/g,
  DOUBLE_NEWLINE: /\n\n+/g,

  // Whitespace
  LEADING_WS: /^\s+/,
  TRAILING_WS: /\s+$/,
  MULTI_SPACE: /\s{2,}/g,

  // Indentation
  INDENT: /^(\s+)/gm,
  TAB: /\t/g
} as const;

/**
 * Validation patterns
 */
export const VALIDATION_PATTERNS = {
  // Email
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // UUIDs
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // ISO 8601 timestamps
  ISO_TIMESTAMP: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,

  // Semantic version
  SEMVER: /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/,

  // File paths
  WINDOWS_PATH: /^[a-zA-Z]:[\\\/](?:[^\\/:*?"<>|\r\n]+[\\\/])*[^\\/:*?"<>|\r\n]*$/,
  UNIX_PATH: /^\/(?:[^/\0]+\/)*[^/\0]*$/,

  // IP addresses
  IPV4: /^(\d{1,3}\.){3}\d{1,3}$/,
  IPV6: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
} as const;

/**
 * Get language from code block
 */
export function detectLanguage(code: string): string | null {
  for (const [lang, pattern] of Object.entries(CODE_PATTERNS)) {
    if (pattern.test(code)) {
      return lang.toLowerCase();
    }
  }
  return null;
}

/**
 * Check if content is a valid URL
 */
export function isURL(text: string): boolean {
  return URL_PATTERNS.URL.test(text);
}

/**
 * Check if URL points to an image
 */
export function isImageURL(url: string): boolean {
  return MEDIA_PATTERNS.IMAGE_URL.test(url);
}

/**
 * Check if URL points to a video
 */
export function isVideoURL(url: string): boolean {
  return MEDIA_PATTERNS.VIDEO_URL.test(url);
}

/**
 * Check if URL points to audio
 */
export function isAudioURL(url: string): boolean {
  return MEDIA_PATTERNS.AUDIO_URL.test(url);
}

/**
 * Check if URL points to PDF
 */
export function isPDFURL(url: string): boolean {
  return MEDIA_PATTERNS.PDF_URL.test(url);
}

/**
 * Extract all URLs from text
 */
export function extractURLs(text: string): string[] {
  const matches = text.match(URL_PATTERNS.URL);
  return matches || [];
}

/**
 * Extract all code blocks from markdown
 */
export function extractCodeBlocks(markdown: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const matches = markdown.matchAll(MARKDOWN_PATTERNS.CODE_BLOCK);

  for (const match of matches) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2]
    });
  }

  return blocks;
}

/**
 * Extract LaTeX math expressions
 */
export function extractMathExpressions(text: string): Array<{ type: 'inline' | 'display'; content: string }> {
  const expressions: Array<{ type: 'inline' | 'display'; content: string }> = [];

  // Display math
  const displayMatches = text.matchAll(LATEX_PATTERNS.DISPLAY_MATH);
  for (const match of displayMatches) {
    expressions.push({ type: 'display', content: match[1] });
  }

  // Inline math
  const inlineMatches = text.matchAll(LATEX_PATTERNS.INLINE_MATH);
  for (const match of inlineMatches) {
    expressions.push({ type: 'inline', content: match[1] });
  }

  return expressions;
}
