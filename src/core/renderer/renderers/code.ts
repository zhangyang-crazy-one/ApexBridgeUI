/**
 * Code Block Renderer with Prism.js Syntax Highlighting
 *
 * Phase 6: US3-005 - Code block renderer with Prism.js highlighting (priority 7)
 *
 * Supports syntax highlighting for 200+ languages via Prism.js:
 * - Popular languages: JavaScript, TypeScript, Python, Java, C++, Rust, Go, etc.
 * - Web languages: HTML, CSS, SCSS, JSX, TSX
 * - Shell scripts: Bash, PowerShell, Batch
 * - Markup: Markdown, JSON, YAML, XML
 * - Data: SQL, GraphQL
 *
 * Features:
 * - Line numbers
 * - Language badge
 * - Copy button
 * - Auto-detect language from fence
 * - Fallback to plaintext if language unknown
 * - Dark theme support (matching Claude color scheme)
 */

/**
 * Supported language mappings
 * Maps fence language identifiers to Prism.js language names
 */
const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript variants
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',

  // Python
  py: 'python',
  python: 'python',

  // Web languages
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',

  // Systems programming
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  golang: 'go',

  // JVM languages
  java: 'java',
  kotlin: 'kotlin',
  kt: 'kotlin',
  scala: 'scala',

  // .NET languages
  csharp: 'csharp',
  'c#': 'csharp',
  cs: 'csharp',
  vb: 'vbnet',
  vbnet: 'vbnet',
  fsharp: 'fsharp',
  'f#': 'fsharp',

  // Shell scripts
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  batch: 'batch',
  bat: 'batch',
  cmd: 'batch',

  // Data formats
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'markup',

  // Databases
  sql: 'sql',
  mysql: 'sql',
  postgresql: 'sql',
  plsql: 'plsql',

  // Functional languages
  haskell: 'haskell',
  hs: 'haskell',
  elixir: 'elixir',
  ex: 'elixir',
  erlang: 'erlang',
  erl: 'erlang',
  clojure: 'clojure',
  clj: 'clojure',

  // Ruby
  ruby: 'ruby',
  rb: 'ruby',

  // PHP
  php: 'php',

  // Swift
  swift: 'swift',

  // R
  r: 'r',

  // Lua
  lua: 'lua',

  // Dart
  dart: 'dart',

  // Markdown
  markdown: 'markdown',
  md: 'markdown',

  // GraphQL
  graphql: 'graphql',
  gql: 'graphql',

  // Docker
  dockerfile: 'docker',
  docker: 'docker',

  // Nginx
  nginx: 'nginx',

  // Git
  git: 'git',
  gitignore: 'git',

  // Other
  diff: 'diff',
  patch: 'diff',
  regex: 'regex',
  vim: 'vim',
};

/**
 * Language display names (for badge)
 */
const LANGUAGE_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'React JSX',
  tsx: 'React TSX',
  python: 'Python',
  markup: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  kotlin: 'Kotlin',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  bash: 'Bash',
  powershell: 'PowerShell',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  graphql: 'GraphQL',
  docker: 'Dockerfile',
};

/**
 * Extract language from code fence
 * Example: ```javascript\n code \n```
 */
function extractLanguage(code: string): string | null {
  const fenceMatch = code.match(/^```(\w+)\n/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].toLowerCase();
  }
  return null;
}

/**
 * Strip code fence markers if present
 * Converts: ```javascript\ncode\n``` → code
 */
function stripCodeFence(code: string): string {
  // Remove opening fence with language
  let stripped = code.replace(/^```\w*\n/, '');

  // Remove closing fence
  stripped = stripped.replace(/\n```$/, '');

  return stripped.trim();
}

/**
 * Normalize language identifier
 * Maps common aliases to canonical Prism.js names
 */
function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || normalized;
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
 * Generate copy button HTML
 */
function generateCopyButton(code: string): string {
  const escapedCode = escapeHtml(code).replace(/'/g, '&#39;');

  return `
    <button
      class="code-copy-button"
      onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(code)}'))"
      title="Copy code"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10.5 1.5h-8v11h8v-11z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M13.5 4.5v11h-8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    </button>
  `;
}

/**
 * Render code with Prism.js syntax highlighting
 * Lazy-loads Prism.js library on first use
 */
export async function renderCode(codeContent: string): Promise<string> {
  // Extract language from fence (if present)
  const fencedLanguage = extractLanguage(codeContent);

  // Strip fence markers
  const code = stripCodeFence(codeContent);

  // Determine language
  const rawLang = fencedLanguage || 'plaintext';
  const prismLang = normalizeLanguage(rawLang);
  const displayLang = LANGUAGE_NAMES[prismLang] || rawLang.toUpperCase();

  // Try to load Prism.js
  let highlightedCode: string;
  try {
    // Lazy load Prism.js
    const Prism = await loadPrism();

    // Check if language is supported
    if (Prism.languages[prismLang]) {
      // Highlight with Prism
      highlightedCode = Prism.highlight(
        code,
        Prism.languages[prismLang],
        prismLang
      );
    } else {
      // Fallback to escaped HTML
      console.warn(`[CodeRenderer] Language '${prismLang}' not supported by Prism, using plaintext`);
      highlightedCode = escapeHtml(code);
    }
  } catch (error) {
    console.error('[CodeRenderer] Failed to load Prism.js, using plaintext:', error);
    highlightedCode = escapeHtml(code);
  }

  // Add line numbers
  const lines = highlightedCode.split('\n');
  const lineNumbersHtml = lines
    .map((_, index) => `<span class="line-number">${index + 1}</span>`)
    .join('\n');

  const linesHtml = lines
    .map((line, index) => `<span class="code-line" data-line="${index + 1}">${line || ' '}</span>`)
    .join('\n');

  // Build final HTML
  return `
    <div class="code-block" data-language="${prismLang}">
      <div class="code-header">
        <span class="code-language-badge">${displayLang}</span>
        ${generateCopyButton(code)}
      </div>
      <div class="code-content">
        <pre class="line-numbers-container"><code class="line-numbers">${lineNumbersHtml}</code></pre>
        <pre class="code-container"><code class="language-${prismLang}">${linesHtml}</code></pre>
      </div>
    </div>
  `;
}

/**
 * Prism.js lazy loader
 * Loads Prism.js from CDN on first use
 */
let prismLoaded = false;
let prismLoadPromise: Promise<any> | null = null;

async function loadPrism(): Promise<any> {
  if (prismLoaded && (window as any).Prism) {
    return (window as any).Prism;
  }

  if (prismLoadPromise) {
    return prismLoadPromise;
  }

  prismLoadPromise = new Promise((resolve, reject) => {
    // Load Prism.js CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(link);

    // Load Prism.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js';
    script.onload = () => {
      prismLoaded = true;
      console.log('[CodeRenderer] Prism.js loaded successfully');
      resolve((window as any).Prism);
    };
    script.onerror = () => {
      console.error('[CodeRenderer] Failed to load Prism.js from CDN');
      reject(new Error('Failed to load Prism.js'));
    };
    document.head.appendChild(script);

    // Load common language components
    // These will load automatically after main Prism.js loads
    const components = [
      'components/prism-typescript.min.js',
      'components/prism-jsx.min.js',
      'components/prism-tsx.min.js',
      'components/prism-python.min.js',
      'components/prism-rust.min.js',
      'components/prism-go.min.js',
      'components/prism-java.min.js',
      'components/prism-csharp.min.js',
      'components/prism-bash.min.js',
      'components/prism-powershell.min.js',
      'components/prism-sql.min.js',
      'components/prism-yaml.min.js',
      'components/prism-json.min.js',
      'components/prism-markdown.min.js',
      'components/prism-graphql.min.js',
    ];

    script.onload = () => {
      // Load language components after main Prism is loaded
      Promise.all(
        components.map((component) => {
          return new Promise<void>((resolveComp) => {
            const compScript = document.createElement('script');
            compScript.src = `https://cdn.jsdelivr.net/npm/prismjs@1.29.0/${component}`;
            compScript.onload = () => resolveComp();
            compScript.onerror = () => {
              console.warn(`[CodeRenderer] Failed to load Prism component: ${component}`);
              resolveComp(); // Continue even if component fails
            };
            document.head.appendChild(compScript);
          });
        })
      ).then(() => {
        prismLoaded = true;
        console.log('[CodeRenderer] Prism.js and components loaded successfully');
        resolve((window as any).Prism);
      });
    };
  });

  return prismLoadPromise;
}
