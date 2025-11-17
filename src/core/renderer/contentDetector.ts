/**
 * Content Type Detector for MessageRenderer
 *
 * Phase 6: US3-002 - Content type detection with regex patterns
 *
 * Provides detection functions for each renderer type to determine
 * which renderer should be used for given content.
 */

export type DetectorFunction = (content: string) => boolean;

/**
 * Detect HTML content
 * Looks for HTML tags and DOCTYPE declarations
 */
export function detectHTML(content: string): boolean {
  const htmlPatterns = [
    /<!DOCTYPE\s+html/i,
    /<html[\s>]/i,
    /<head[\s>]/i,
    /<body[\s>]/i,
    /<div[\s>]/i,
    /<script[\s>]/i,
    /<style[\s>]/i,
  ];

  return htmlPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect Three.js scenes
 * Looks for Three.js specific code patterns
 */
export function detectThreeJS(content: string): boolean {
  const threejsPatterns = [
    /THREE\.Scene/,
    /THREE\.WebGLRenderer/,
    /THREE\.PerspectiveCamera/,
    /THREE\.Mesh/,
    /THREE\.Geometry/,
    /THREE\.Material/,
  ];

  return threejsPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect image URLs or base64 images
 */
export function detectImage(content: string): boolean {
  const imagePatterns = [
    /https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg|bmp)/i,
    /!\[.*?\]\(.*\.(jpg|jpeg|png|gif|webp|svg|bmp)\)/i,
  ];

  return imagePatterns.some(pattern => pattern.test(content));
}

/**
 * Detect base64 encoded images
 */
export function detectBase64Image(content: string): boolean {
  return /data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/.test(content);
}

/**
 * Detect Mermaid diagram syntax
 */
export function detectMermaid(content: string): boolean {
  const mermaidPatterns = [
    /```mermaid\s/,
    /graph\s+(TD|LR|TB|RL)\s/,
    /sequenceDiagram\s/,
    /classDiagram\s/,
    /stateDiagram\s/,
    /erDiagram\s/,
    /gantt\s/,
    /pie\s+title\s/,
    /journey\s/,
  ];

  return mermaidPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect code blocks with language specifier
 */
export function detectCode(content: string): boolean {
  // Detect fenced code blocks with language
  return /```(\w+)\s/.test(content);
}

/**
 * Detect LaTeX math expressions
 */
export function detectLaTeX(content: string): boolean {
  const latexPatterns = [
    /\$\$[\s\S]+?\$\$/,       // Display math: $$...$$
    /\$[^\$]+\$/,             // Inline math: $...$
    /\\\[[\s\S]+?\\\]/,       // Display math: \[...\]
    /\\\([\s\S]+?\\\)/,       // Inline math: \(...\)
    /\\begin\{equation\}/,    // Equation environment
    /\\begin\{align\}/,       // Align environment
    /\\frac\{/,               // Fractions
    /\\sum_/,                 // Summations
    /\\int_/,                 // Integrals
  ];

  return latexPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect video URLs or embedded players
 */
export function detectVideo(content: string): boolean {
  const videoPatterns = [
    /https?:\/\/.*\.(mp4|webm|ogg|mov|avi)/i,
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /vimeo\.com\//,
    /bilibili\.com\/video\//,
  ];

  return videoPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect audio URLs
 */
export function detectAudio(content: string): boolean {
  const audioPatterns = [
    /https?:\/\/.*\.(mp3|wav|ogg|flac|m4a|aac)/i,
  ];

  return audioPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect SVG markup
 */
export function detectSVG(content: string): boolean {
  return /<svg[\s>]/.test(content) || content.trim().startsWith('<svg');
}

/**
 * Detect JSON content
 */
export function detectJSON(content: string): boolean {
  // Must start with { or [ and be valid JSON
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect markdown tables
 */
export function detectTable(content: string): boolean {
  const tablePattern = /^\s*\|.*\|\s*\n\s*\|[\s:-]+\|/m;
  return tablePattern.test(content);
}

/**
 * Detect Chart.js data
 */
export function detectChart(content: string): boolean {
  const chartPatterns = [
    /```chart/,
    /"type":\s*"(bar|line|pie|doughnut|radar|polarArea|bubble|scatter)"/,
    /"datasets":\s*\[/,
  ];

  return chartPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect Python code (Pyodide executor)
 */
export function detectPython(content: string): boolean {
  const pythonPatterns = [
    /```python\s/,
    /```py\s/,
  ];

  return pythonPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect JavaScript code (executor)
 */
export function detectJavaScript(content: string): boolean {
  const jsPatterns = [
    /```javascript\s/,
    /```js\s/,
  ];

  return jsPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect PlantUML diagrams
 */
export function detectPlantUML(content: string): boolean {
  const plantumlPatterns = [
    /```plantuml\s/,
    /```uml\s/,
    /@startuml/,
    /@enduml/,
  ];

  return plantumlPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect Graphviz DOT language
 */
export function detectGraphviz(content: string): boolean {
  const graphvizPatterns = [
    /```dot\s/,
    /```graphviz\s/,
    /digraph\s+\w+\s*\{/,
    /graph\s+\w+\s*\{/,
  ];

  return graphvizPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect blockquotes
 */
export function detectBlockquote(content: string): boolean {
  return /^\s*>\s/m.test(content);
}

/**
 * Detect URLs for link previews
 */
export function detectLinkPreview(content: string): boolean {
  const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/m;
  return urlPattern.test(content);
}

/**
 * Detect file attachment references
 */
export function detectFileAttachment(content: string): boolean {
  const filePattern = /\[file:([^\]]+)\]/;
  return filePattern.test(content);
}

/**
 * Detect markdown content (fallback, lower priority)
 */
export function detectMarkdown(content: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers
    /\*\*.*?\*\*/,          // Bold
    /\*.*?\*/,              // Italic
    /```[\s\S]*?```/,       // Code blocks
    /`[^`]+`/,              // Inline code
    /^\s*[-*+]\s/m,         // Unordered lists
    /^\s*\d+\.\s/m,         // Ordered lists
    /\[.*?\]\(.*?\)/,       // Links
    /^\s*>\s/m,             // Blockquotes
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
}

/**
 * Get all detector functions mapped by renderer type
 */
export const contentDetectors: Record<string, DetectorFunction> = {
  html: detectHTML,
  threejs: detectThreeJS,
  image: detectImage,
  base64_image: detectBase64Image,
  mermaid: detectMermaid,
  code: detectCode,
  latex: detectLaTeX,
  video: detectVideo,
  audio: detectAudio,
  svg: detectSVG,
  json: detectJSON,
  table: detectTable,
  chart: detectChart,
  python: detectPython,
  javascript: detectJavaScript,
  plantuml: detectPlantUML,
  graphviz: detectGraphviz,
  blockquote: detectBlockquote,
  link_preview: detectLinkPreview,
  file_attachment: detectFileAttachment,
  markdown: detectMarkdown,
  // 'text' has no detector - it's the fallback
};
