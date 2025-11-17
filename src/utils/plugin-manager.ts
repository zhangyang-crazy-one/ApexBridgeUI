/**
 * Plugin Manager
 * Handles dynamic plugin mounting/unmounting in overlay container
 * Complies with Anthropic Design System (Constitution v1.1.0 Section V)
 */

export interface PluginConfig {
  id: string;
  name: string;
  url?: string;
  html?: string;
  width?: string;
  height?: string;
  allowScripts?: boolean;
}

export class PluginManager {
  private static instance: PluginManager;
  private container: HTMLElement;
  private activePlugin: PluginConfig | null = null;
  private pluginContent: HTMLElement | null = null;

  private constructor() {
    const container = document.getElementById('plugin-container');
    if (!container) {
      throw new Error('Plugin container not found in DOM');
    }
    this.container = container;
    this.init();
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Initialize plugin manager
   */
  private init(): void {
    // Listen for ESC key to close plugin
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activePlugin) {
        this.unmountPlugin();
      }
    });

    // Click on backdrop to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.unmountPlugin();
      }
    });

    console.log('✓ Plugin manager initialized');
  }

  /**
   * Mount a plugin into the container
   */
  public async mountPlugin(config: PluginConfig): Promise<void> {
    // Unmount any existing plugin first
    if (this.activePlugin) {
      await this.unmountPlugin();
    }

    this.activePlugin = config;

    // Create plugin wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'plugin-wrapper';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-label', config.name);
    wrapper.setAttribute('aria-modal', 'true');

    // Set custom dimensions if provided
    if (config.width) {
      wrapper.style.width = config.width;
    }
    if (config.height) {
      wrapper.style.height = config.height;
    }

    // Create plugin header
    const header = this.createPluginHeader(config);
    wrapper.appendChild(header);

    // Create plugin content area
    const contentArea = document.createElement('div');
    contentArea.className = 'plugin-content-area';

    if (config.url) {
      // Load plugin from URL using iframe
      const iframe = document.createElement('iframe');
      iframe.src = config.url;
      iframe.className = 'plugin-iframe';
      iframe.setAttribute('sandbox', config.allowScripts
        ? 'allow-scripts allow-same-origin allow-forms'
        : 'allow-same-origin allow-forms'
      );
      contentArea.appendChild(iframe);
    } else if (config.html) {
      // Load plugin from HTML string
      const contentDiv = document.createElement('div');
      contentDiv.className = 'plugin-html-content';
      contentDiv.innerHTML = config.html;
      contentArea.appendChild(contentDiv);
    } else {
      throw new Error('Plugin config must provide either url or html');
    }

    wrapper.appendChild(contentArea);
    this.pluginContent = wrapper;

    // Mount to container
    this.container.appendChild(wrapper);
    this.container.style.display = 'flex';

    // Add animation class after a tick for smooth entrance
    requestAnimationFrame(() => {
      this.container.classList.add('active');
      wrapper.classList.add('active');
    });

    // Emit custom event
    window.dispatchEvent(new CustomEvent('plugin-mounted', {
      detail: { plugin: config }
    }));

    console.log(`✓ Plugin mounted: ${config.name}`);
  }

  /**
   * Create plugin header with title and close button
   */
  private createPluginHeader(config: PluginConfig): HTMLElement {
    const header = document.createElement('div');
    header.className = 'plugin-header';

    // Plugin title
    const title = document.createElement('h2');
    title.className = 'plugin-title';
    title.textContent = config.name;
    header.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'plugin-close-btn';
    closeBtn.setAttribute('aria-label', 'Close plugin');
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => {
      this.unmountPlugin();
    });
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Unmount the active plugin
   */
  public async unmountPlugin(): Promise<void> {
    if (!this.activePlugin || !this.pluginContent) {
      return;
    }

    const pluginId = this.activePlugin.id;

    // Add exit animation
    this.container.classList.remove('active');
    this.pluginContent.classList.remove('active');

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Remove from DOM
    if (this.pluginContent && this.pluginContent.parentNode) {
      this.pluginContent.parentNode.removeChild(this.pluginContent);
    }

    this.container.style.display = 'none';
    this.pluginContent = null;
    this.activePlugin = null;

    // Emit custom event
    window.dispatchEvent(new CustomEvent('plugin-unmounted', {
      detail: { pluginId }
    }));

    console.log(`✓ Plugin unmounted: ${pluginId}`);
  }

  /**
   * Get active plugin info
   */
  public getActivePlugin(): PluginConfig | null {
    return this.activePlugin;
  }

  /**
   * Check if a plugin is currently mounted
   */
  public isPluginMounted(): boolean {
    return this.activePlugin !== null;
  }

  /**
   * Send message to active plugin (if using iframe)
   */
  public sendMessageToPlugin(message: any): void {
    if (!this.pluginContent) {
      console.warn('No active plugin to send message to');
      return;
    }

    const iframe = this.pluginContent.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, '*');
    } else {
      console.warn('Active plugin is not an iframe');
    }
  }

  /**
   * Listen for messages from plugin
   */
  public onPluginMessage(callback: (message: any) => void): void {
    window.addEventListener('message', (event) => {
      if (this.activePlugin) {
        callback(event.data);
      }
    });
  }
}

/**
 * Initialize plugin manager
 */
export function initPluginManager(): PluginManager {
  return PluginManager.getInstance();
}

/**
 * Convenience function to mount a plugin
 */
export async function mountPlugin(config: PluginConfig): Promise<void> {
  const manager = PluginManager.getInstance();
  await manager.mountPlugin(config);
}

/**
 * Convenience function to unmount current plugin
 */
export async function unmountPlugin(): Promise<void> {
  const manager = PluginManager.getInstance();
  await manager.unmountPlugin();
}
