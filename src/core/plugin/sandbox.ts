// PLUGIN-061 to PLUGIN-064: Plugin Sandbox Implementation
// Isolates plugin execution using iframe with strict sandboxing
// Blocks direct Tauri API access and proxies all communication through postMessage

import { FileSystemAPI, NetworkAPI, StorageAPI } from './pluginContext';
import { eventBus } from './eventBus';

/**
 * Message types for sandbox communication
 */
export enum SandboxMessageType {
  // Plugin → Host messages
  FS_READ_FILE = 'fs.readFile',
  FS_WRITE_FILE = 'fs.writeFile',
  FS_LIST_FILES = 'fs.listFiles',
  FS_DELETE_FILE = 'fs.deleteFile',
  FS_CREATE_DIR = 'fs.createDirectory',
  FS_EXISTS = 'fs.exists',
  FS_WATCH = 'fs.watchDirectory',
  FS_UNWATCH = 'fs.unwatchDirectory',

  HTTP_REQUEST = 'http.request',
  HTTP_GET = 'http.get',
  HTTP_POST = 'http.post',
  HTTP_PUT = 'http.put',
  HTTP_DELETE = 'http.delete',
  HTTP_PATCH = 'http.patch',

  STORAGE_SET = 'storage.set',
  STORAGE_GET = 'storage.get',
  STORAGE_DELETE = 'storage.delete',
  STORAGE_CLEAR = 'storage.clear',
  STORAGE_KEYS = 'storage.keys',
  STORAGE_HAS = 'storage.has',
  STORAGE_SIZE = 'storage.size',

  EVENT_ON = 'event.on',
  EVENT_EMIT = 'event.emit',
  EVENT_OFF = 'event.off',

  // Host → Plugin messages
  API_RESPONSE = 'api.response',
  API_ERROR = 'api.error',
  EVENT_TRIGGERED = 'event.triggered',

  // Lifecycle messages
  PLUGIN_ACTIVATE = 'plugin.activate',
  PLUGIN_DEACTIVATE = 'plugin.deactivate',
}

/**
 * Sandbox message structure
 */
export interface SandboxMessage {
  type: SandboxMessageType;
  requestId: string;
  pluginId: string;
  payload: any;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  pluginId: string;
  pluginCode: string;
  permissions: string[];
}

/**
 * PLUGIN-061 to PLUGIN-063: PluginSandbox
 * Creates isolated iframe execution environment for plugins
 */
export class PluginSandbox {
  private iframe: HTMLIFrameElement;
  private pluginId: string;
  private pluginCode: string;
  private permissions: string[];

  // API instances for this plugin
  private fsAPI: FileSystemAPI;
  private networkAPI: NetworkAPI;
  private storageAPI: StorageAPI;

  // Pending requests (for async API calls)
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>;

  // Event listeners registered by plugin
  private eventListeners: Map<string, Set<string>>; // event → requestIds

  constructor(config: SandboxConfig) {
    this.pluginId = config.pluginId;
    this.pluginCode = config.pluginCode;
    this.permissions = config.permissions;

    this.pendingRequests = new Map();
    this.eventListeners = new Map();

    // Initialize API instances
    this.fsAPI = new FileSystemAPI(this.pluginId);
    this.networkAPI = new NetworkAPI(this.pluginId);
    this.storageAPI = new StorageAPI(this.pluginId);

    // Create iframe (PLUGIN-061)
    this.iframe = this.createSecureIframe();

    // Set up message listener (PLUGIN-062)
    this.setupMessageProxy();
  }

  /**
   * PLUGIN-061: Create iframe with strict sandbox attributes
   */
  private createSecureIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');

    // Strict sandbox - only allow scripts
    iframe.setAttribute('sandbox', 'allow-scripts');

    // PLUGIN-063: Block Tauri API access by providing fake implementation
    const sandboxHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';">
</head>
<body>
  <script>
    // PLUGIN-063: Block all direct Tauri API access
    window.__TAURI__ = Object.freeze({});
    window.__TAURI_INTERNALS__ = Object.freeze({});

    // Prevent any attempts to redefine or access Tauri
    Object.defineProperty(window, '__TAURI__', {
      value: Object.freeze({}),
      writable: false,
      configurable: false
    });

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: Object.freeze({}),
      writable: false,
      configurable: false
    });

    // Plugin API - communicates with host via postMessage
    class PluginAPI {
      constructor() {
        this.pluginId = '${this.pluginId}';
        this.requestId = 0;
        this.pendingCallbacks = new Map();

        // Listen for responses from host
        window.addEventListener('message', (event) => {
          const msg = event.data;

          if (msg.type === 'api.response') {
            const callback = this.pendingCallbacks.get(msg.requestId);
            if (callback) {
              callback.resolve(msg.payload);
              this.pendingCallbacks.delete(msg.requestId);
            }
          } else if (msg.type === 'api.error') {
            const callback = this.pendingCallbacks.get(msg.requestId);
            if (callback) {
              callback.reject(new Error(msg.payload.message || 'API call failed'));
              this.pendingCallbacks.delete(msg.requestId);
            }
          } else if (msg.type === 'event.triggered') {
            // Event emitted from host or other plugins
            if (this.eventHandlers.has(msg.payload.event)) {
              const handlers = this.eventHandlers.get(msg.payload.event);
              handlers.forEach(handler => handler(msg.payload.data));
            }
          }
        });

        this.eventHandlers = new Map();
      }

      sendRequest(type, payload) {
        return new Promise((resolve, reject) => {
          const requestId = String(++this.requestId);
          this.pendingCallbacks.set(requestId, { resolve, reject });

          window.parent.postMessage({
            type,
            requestId,
            pluginId: this.pluginId,
            payload
          }, '*');
        });
      }

      // FileSystem API
      fs = {
        readFile: (path) => this.sendRequest('fs.readFile', { path }),
        writeFile: (path, contents) => this.sendRequest('fs.writeFile', { path, contents }),
        listFiles: (path, pattern) => this.sendRequest('fs.listFiles', { path, pattern }),
        deleteFile: (path) => this.sendRequest('fs.deleteFile', { path }),
        createDirectory: (path) => this.sendRequest('fs.createDirectory', { path }),
        exists: (path) => this.sendRequest('fs.exists', { path }),
        watchDirectory: (path) => this.sendRequest('fs.watchDirectory', { path }),
        unwatchDirectory: () => this.sendRequest('fs.unwatchDirectory', {})
      };

      // Network API
      http = {
        request: (req) => this.sendRequest('http.request', req),
        get: (url, headers) => this.sendRequest('http.get', { url, headers }),
        post: (url, body, headers) => this.sendRequest('http.post', { url, body, headers }),
        put: (url, body, headers) => this.sendRequest('http.put', { url, body, headers }),
        delete: (url, headers) => this.sendRequest('http.delete', { url, headers }),
        patch: (url, body, headers) => this.sendRequest('http.patch', { url, body, headers })
      };

      // Storage API
      storage = {
        set: (key, value) => this.sendRequest('storage.set', { key, value }),
        get: (key) => this.sendRequest('storage.get', { key }),
        delete: (key) => this.sendRequest('storage.delete', { key }),
        clear: () => this.sendRequest('storage.clear', {}),
        keys: () => this.sendRequest('storage.keys', {}),
        has: (key) => this.sendRequest('storage.has', { key }),
        size: () => this.sendRequest('storage.size', {})
      };

      // Event API
      events = {
        on: (event, callback) => {
          if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
          }
          this.eventHandlers.get(event).add(callback);

          // Register with host
          this.sendRequest('event.on', { event });
        },

        emit: (event, data) => this.sendRequest('event.emit', { event, data }),

        off: (event, callback) => {
          if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(callback);
            if (this.eventHandlers.get(event).size === 0) {
              this.eventHandlers.delete(event);
              this.sendRequest('event.off', { event });
            }
          }
        }
      };
    }

    // Make API available globally
    window.pluginAPI = new PluginAPI();

    // Execute plugin code
    ${this.pluginCode}
  </script>
</body>
</html>
    `;

    // Set iframe content using srcdoc
    iframe.srcdoc = sandboxHtml;
    iframe.style.display = 'none';

    return iframe;
  }

  /**
   * PLUGIN-062: Set up postMessage proxy for API calls
   */
  private setupMessageProxy(): void {
    window.addEventListener('message', async (event) => {
      // Verify message is from our iframe
      if (event.source !== this.iframe.contentWindow) {
        return;
      }

      const msg: SandboxMessage = event.data;

      // Verify plugin ID matches
      if (msg.pluginId !== this.pluginId) {
        console.error(`Plugin ID mismatch: expected ${this.pluginId}, got ${msg.pluginId}`);
        return;
      }

      try {
        // Route to appropriate API handler
        await this.handleAPICall(msg);
      } catch (error: any) {
        // Send error response
        this.sendErrorResponse(msg.requestId, error.message || 'Unknown error');
      }
    });
  }

  /**
   * Handle API calls from sandbox
   */
  private async handleAPICall(msg: SandboxMessage): Promise<void> {
    const { type, requestId, payload } = msg;
    let result: any;

    try {
      // FileSystem API
      if (type === SandboxMessageType.FS_READ_FILE) {
        result = await this.fsAPI.readFile(payload.path);
      } else if (type === SandboxMessageType.FS_WRITE_FILE) {
        result = await this.fsAPI.writeFile(payload.path, payload.contents);
      } else if (type === SandboxMessageType.FS_LIST_FILES) {
        result = await this.fsAPI.listFiles(payload.path, payload.pattern || null);
      } else if (type === SandboxMessageType.FS_DELETE_FILE) {
        result = await this.fsAPI.deleteFile(payload.path);
      } else if (type === SandboxMessageType.FS_CREATE_DIR) {
        result = await this.fsAPI.createDirectory(payload.path);
      } else if (type === SandboxMessageType.FS_EXISTS) {
        result = await this.fsAPI.exists(payload.path);
      } else if (type === SandboxMessageType.FS_WATCH) {
        result = await this.fsAPI.watchDirectory(payload.path);
      } else if (type === SandboxMessageType.FS_UNWATCH) {
        result = await this.fsAPI.unwatchDirectory();
      }

      // Network API
      else if (type === SandboxMessageType.HTTP_REQUEST) {
        result = await this.networkAPI.request(payload);
      } else if (type === SandboxMessageType.HTTP_GET) {
        result = await this.networkAPI.get(payload.url, payload.headers);
      } else if (type === SandboxMessageType.HTTP_POST) {
        result = await this.networkAPI.post(payload.url, payload.body, payload.headers);
      } else if (type === SandboxMessageType.HTTP_PUT) {
        result = await this.networkAPI.put(payload.url, payload.body, payload.headers);
      } else if (type === SandboxMessageType.HTTP_DELETE) {
        result = await this.networkAPI.delete(payload.url, payload.headers);
      } else if (type === SandboxMessageType.HTTP_PATCH) {
        result = await this.networkAPI.patch(payload.url, payload.body, payload.headers);
      }

      // Storage API
      else if (type === SandboxMessageType.STORAGE_SET) {
        result = await this.storageAPI.set(payload.key, payload.value);
      } else if (type === SandboxMessageType.STORAGE_GET) {
        result = await this.storageAPI.get(payload.key);
      } else if (type === SandboxMessageType.STORAGE_DELETE) {
        result = await this.storageAPI.delete(payload.key);
      } else if (type === SandboxMessageType.STORAGE_CLEAR) {
        result = await this.storageAPI.clear();
      } else if (type === SandboxMessageType.STORAGE_KEYS) {
        result = await this.storageAPI.keys();
      } else if (type === SandboxMessageType.STORAGE_HAS) {
        result = await this.storageAPI.has(payload.key);
      } else if (type === SandboxMessageType.STORAGE_SIZE) {
        result = await this.storageAPI.size();
      }

      // Event API
      else if (type === SandboxMessageType.EVENT_ON) {
        // Register event listener
        if (!this.eventListeners.has(payload.event)) {
          this.eventListeners.set(payload.event, new Set());

          // Subscribe to global event bus
          eventBus.on(payload.event, (data) => {
            this.sendEventToPlugin(payload.event, data);
          });
        }
        this.eventListeners.get(payload.event)!.add(requestId);
        result = { success: true };
      } else if (type === SandboxMessageType.EVENT_EMIT) {
        // Emit event to global event bus
        eventBus.emit(payload.event, payload.data);
        result = { success: true };
      } else if (type === SandboxMessageType.EVENT_OFF) {
        // Unregister event listener
        if (this.eventListeners.has(payload.event)) {
          this.eventListeners.get(payload.event)!.delete(requestId);
          if (this.eventListeners.get(payload.event)!.size === 0) {
            this.eventListeners.delete(payload.event);
            // Note: EventBus doesn't provide off() yet, would need to implement
          }
        }
        result = { success: true };
      }

      else {
        throw new Error(`Unknown API call type: ${type}`);
      }

      // Send success response
      this.sendSuccessResponse(requestId, result);

    } catch (error: any) {
      this.sendErrorResponse(requestId, error.message || 'API call failed');
    }
  }

  /**
   * Send success response to plugin
   */
  private sendSuccessResponse(requestId: string, result: any): void {
    this.iframe.contentWindow?.postMessage({
      type: SandboxMessageType.API_RESPONSE,
      requestId,
      payload: result
    }, '*');
  }

  /**
   * Send error response to plugin
   */
  private sendErrorResponse(requestId: string, message: string): void {
    this.iframe.contentWindow?.postMessage({
      type: SandboxMessageType.API_ERROR,
      requestId,
      payload: { message }
    }, '*');
  }

  /**
   * Send event to plugin
   */
  private sendEventToPlugin(event: string, data: any): void {
    this.iframe.contentWindow?.postMessage({
      type: SandboxMessageType.EVENT_TRIGGERED,
      requestId: '',
      payload: { event, data }
    }, '*');
  }

  /**
   * Load and activate plugin
   */
  public activate(): void {
    // Mount iframe to DOM
    document.body.appendChild(this.iframe);

    // Notify plugin of activation
    this.iframe.contentWindow?.postMessage({
      type: SandboxMessageType.PLUGIN_ACTIVATE,
      requestId: '',
      pluginId: this.pluginId,
      payload: {}
    }, '*');
  }

  /**
   * Deactivate and cleanup plugin
   */
  public deactivate(): void {
    // Notify plugin of deactivation
    this.iframe.contentWindow?.postMessage({
      type: SandboxMessageType.PLUGIN_DEACTIVATE,
      requestId: '',
      pluginId: this.pluginId,
      payload: {}
    }, '*');

    // Cleanup event listeners
    this.eventListeners.clear();

    // Remove iframe from DOM
    if (this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
  }

  /**
   * Get plugin ID
   */
  public getPluginId(): string {
    return this.pluginId;
  }
}
