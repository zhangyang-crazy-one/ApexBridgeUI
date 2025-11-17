/**
 * Sandboxed Iframe Renderer for HTML/JavaScript Content
 *
 * Phase 6: US3-003 - Sandboxed iframe for HTML/JavaScript renderers
 *
 * Provides secure iframe-based rendering for potentially unsafe content:
 * - HTML content (user-generated or AI-generated)
 * - JavaScript code execution
 * - Three.js 3D scenes
 * - Python code execution (via Pyodide)
 *
 * Security Features:
 * - Isolated iframe with sandbox attribute
 * - Content Security Policy (CSP)
 * - No access to parent window
 * - No network access (optional)
 * - Restricted permissions
 */

export interface SandboxOptions {
  /**
   * Enable JavaScript execution
   * @default true
   */
  allowScripts?: boolean;

  /**
   * Enable same-origin policy (required for localStorage, etc.)
   * @default false
   */
  allowSameOrigin?: boolean;

  /**
   * Enable form submission
   * @default false
   */
  allowForms?: boolean;

  /**
   * Enable modals (alert, confirm, prompt)
   * @default false
   */
  allowModals?: boolean;

  /**
   * Enable pointer lock
   * @default false
   */
  allowPointerLock?: boolean;

  /**
   * Enable popups
   * @default false
   */
  allowPopups?: boolean;

  /**
   * Custom Content Security Policy
   * @default "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';"
   */
  contentSecurityPolicy?: string;

  /**
   * Custom width
   * @default "100%"
   */
  width?: string;

  /**
   * Custom height
   * @default "auto"
   */
  height?: string;

  /**
   * Allow network requests
   * @default false
   */
  allowNetwork?: boolean;
}

/**
 * Default sandbox options for HTML content
 */
const DEFAULT_HTML_SANDBOX: SandboxOptions = {
  allowScripts: true,
  allowSameOrigin: false,
  allowForms: false,
  allowModals: false,
  allowPointerLock: false,
  allowPopups: false,
  allowNetwork: false,
  contentSecurityPolicy: "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:;",
};

/**
 * Default sandbox options for Three.js content
 */
const DEFAULT_THREEJS_SANDBOX: SandboxOptions = {
  allowScripts: true,
  allowSameOrigin: false,
  allowForms: false,
  allowModals: false,
  allowPointerLock: true, // Required for Three.js camera controls
  allowPopups: false,
  allowNetwork: true, // May need to load textures/models
  contentSecurityPolicy: "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob: https:;",
};

/**
 * Default sandbox options for Python (Pyodide) content
 */
const DEFAULT_PYTHON_SANDBOX: SandboxOptions = {
  allowScripts: true,
  allowSameOrigin: false,
  allowForms: false,
  allowModals: false,
  allowPointerLock: false,
  allowPopups: false,
  allowNetwork: true, // Pyodide needs to load packages
  contentSecurityPolicy: "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'unsafe-inline';",
};

/**
 * Default sandbox options for JavaScript content
 */
const DEFAULT_JAVASCRIPT_SANDBOX: SandboxOptions = {
  allowScripts: true,
  allowSameOrigin: false,
  allowForms: false,
  allowModals: false,
  allowPointerLock: false,
  allowPopups: false,
  allowNetwork: false,
  contentSecurityPolicy: "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';",
};

/**
 * Create a sandboxed iframe element
 */
export function createSandboxedIframe(
  content: string,
  options: SandboxOptions = DEFAULT_HTML_SANDBOX
): HTMLIFrameElement {
  const iframe = document.createElement('iframe');

  // Build sandbox attribute
  const sandboxPermissions: string[] = [];

  if (options.allowScripts) {
    sandboxPermissions.push('allow-scripts');
  }

  if (options.allowSameOrigin) {
    sandboxPermissions.push('allow-same-origin');
  }

  if (options.allowForms) {
    sandboxPermissions.push('allow-forms');
  }

  if (options.allowModals) {
    sandboxPermissions.push('allow-modals');
  }

  if (options.allowPointerLock) {
    sandboxPermissions.push('allow-pointer-lock');
  }

  if (options.allowPopups) {
    sandboxPermissions.push('allow-popups');
  }

  iframe.setAttribute('sandbox', sandboxPermissions.join(' '));

  // Set CSP via meta tag in content
  const csp = options.contentSecurityPolicy || DEFAULT_HTML_SANDBOX.contentSecurityPolicy;
  const wrappedContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <style>
          body {
            margin: 0;
            padding: 16px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #2d333a;
            background: #fff;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

  // Set iframe properties
  iframe.style.width = options.width || '100%';
  iframe.style.height = options.height || '400px';
  iframe.style.border = '1px solid #e0e0e0';
  iframe.style.borderRadius = '8px';
  iframe.style.backgroundColor = '#fff';

  // Write content to iframe
  iframe.srcdoc = wrappedContent;

  return iframe;
}

/**
 * Render HTML content in sandboxed iframe
 */
export function renderSandboxedHTML(html: string, options?: SandboxOptions): string {
  const iframe = createSandboxedIframe(html, options || DEFAULT_HTML_SANDBOX);

  // Return iframe as HTML string
  const wrapper = document.createElement('div');
  wrapper.className = 'sandboxed-html-container';
  wrapper.appendChild(iframe);

  return wrapper.outerHTML;
}

/**
 * Render Three.js scene in sandboxed iframe
 */
export function renderSandboxedThreeJS(code: string, options?: SandboxOptions): string {
  const threeJSTemplate = `
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/OrbitControls.js"></script>
    <div id="three-container" style="width: 100%; height: 400px;"></div>
    <script>
      try {
        ${code}
      } catch (error) {
        document.body.innerHTML = '<div style="color: #d32f2f; padding: 16px; background: #ffebee; border-radius: 4px;">Three.js Error: ' + error.message + '</div>';
        console.error('Three.js execution error:', error);
      }
    </script>
  `;

  const iframe = createSandboxedIframe(threeJSTemplate, options || DEFAULT_THREEJS_SANDBOX);

  const wrapper = document.createElement('div');
  wrapper.className = 'sandboxed-threejs-container';
  wrapper.appendChild(iframe);

  return wrapper.outerHTML;
}

/**
 * Render Python code in sandboxed iframe using Pyodide
 */
export function renderSandboxedPython(code: string, options?: SandboxOptions): string {
  const pyodideTemplate = `
    <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
    <div id="output" style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace; white-space: pre-wrap;"></div>
    <script>
      async function runPython() {
        const output = document.getElementById('output');
        try {
          output.textContent = 'Loading Pyodide...\\n';
          const pyodide = await loadPyodide();
          output.textContent = 'Running Python code...\\n';

          // Capture stdout
          pyodide.runPython(\`
import sys
from io import StringIO
sys.stdout = StringIO()
          \`);

          // Run user code
          pyodide.runPython(\`${code.replace(/`/g, '\\`')}\`);

          // Get stdout
          const stdout = pyodide.runPython('sys.stdout.getvalue()');
          output.textContent = stdout || '(No output)';
        } catch (error) {
          output.style.color = '#d32f2f';
          output.style.background = '#ffebee';
          output.textContent = 'Python Error: ' + error.message;
          console.error('Python execution error:', error);
        }
      }

      runPython();
    </script>
  `;

  const iframe = createSandboxedIframe(pyodideTemplate, options || DEFAULT_PYTHON_SANDBOX);
  iframe.style.height = '300px';

  const wrapper = document.createElement('div');
  wrapper.className = 'sandboxed-python-container';
  wrapper.appendChild(iframe);

  return wrapper.outerHTML;
}

/**
 * Render JavaScript code in sandboxed iframe
 */
export function renderSandboxedJavaScript(code: string, options?: SandboxOptions): string {
  const jsTemplate = `
    <div id="output" style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace; white-space: pre-wrap;"></div>
    <script>
      const output = document.getElementById('output');
      const originalLog = console.log;

      // Capture console.log
      console.log = function(...args) {
        output.textContent += args.join(' ') + '\\n';
        originalLog.apply(console, args);
      };

      try {
        ${code}
      } catch (error) {
        output.style.color = '#d32f2f';
        output.style.background = '#ffebee';
        output.textContent = 'JavaScript Error: ' + error.message;
        console.error('JavaScript execution error:', error);
      }
    </script>
  `;

  const iframe = createSandboxedIframe(jsTemplate, options || DEFAULT_JAVASCRIPT_SANDBOX);
  iframe.style.height = '300px';

  const wrapper = document.createElement('div');
  wrapper.className = 'sandboxed-javascript-container';
  wrapper.appendChild(iframe);

  return wrapper.outerHTML;
}

/**
 * Export sandbox option presets
 */
export const SandboxPresets = {
  HTML: DEFAULT_HTML_SANDBOX,
  THREEJS: DEFAULT_THREEJS_SANDBOX,
  PYTHON: DEFAULT_PYTHON_SANDBOX,
  JAVASCRIPT: DEFAULT_JAVASCRIPT_SANDBOX,
};
