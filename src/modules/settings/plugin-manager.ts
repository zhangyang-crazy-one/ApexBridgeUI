/**
 * Plugin Manager UI (CORE-059)
 *
 * Plugin Management Interface
 *
 * Responsibilities:
 * - Display list of installed plugins
 * - Show plugin metadata (name, version, author, description)
 * - Enable/disable plugins
 * - Uninstall plugins
 * - Show plugin permissions
 * - Integrate with PluginInstaller for new plugin installation
 * - Real-time status updates
 *
 * Features:
 * - Plugin list with card-based UI
 * - Plugin state indicators (enabled, disabled, error)
 * - Toggle switches for enable/disable
 * - Uninstall confirmation dialog
 * - Permission viewer
 * - Integration with Phase 1 Plugin Manager (Tauri backend)
 * - Install new plugin button
 * - Search and filter plugins
 * - Plugin statistics (commands, views contributed)
 *
 * Usage:
 * ```typescript
 * import { PluginManagerUI } from './modules/settings/plugin-manager';
 *
 * const pluginManager = new PluginManagerUI('plugin-list-container');
 * await pluginManager.loadPlugins();
 * ```
 */

import { invoke } from '@tauri-apps/api/core';
import { PluginInstaller } from './plugin-installer';

/**
 * Plugin metadata interface (matches backend PluginManifest)
 */
export interface PluginMetadata {
  plugin_id: string;
  display_name: string;
  version: string;
  description: string;
  author?: string;
  permissions: string[];
  activation_events: string[];
  contributes?: {
    commands?: Array<{
      command_identifier: string;
      description: string;
    }>;
    views?: Array<{
      view_id: string;
      title: string;
    }>;
  };
}

/**
 * Plugin state from backend
 */
export enum PluginState {
  Uninstalled = 'Uninstalled',
  Installed = 'Installed',
  Loaded = 'Loaded',
  Activated = 'Activated',
  Running = 'Running',
  Deactivated = 'Deactivated',
  Error = 'Error'
}

/**
 * Plugin info combining metadata and state
 */
export interface PluginInfo {
  metadata: PluginMetadata;
  state: PluginState;
  enabled: boolean;
  error_message?: string;
}

/**
 * Plugin Manager UI class
 */
export class PluginManagerUI {
  private containerElement: HTMLElement;
  private plugins: PluginInfo[] = [];
  private searchQuery: string = '';
  private pluginInstaller: PluginInstaller | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.containerElement = container;
  }

  /**
   * Initialize and load plugins
   */
  public async initialize(): Promise<void> {
    await this.loadPlugins();
    this.render();
    console.log('[PluginManagerUI] Initialized with', this.plugins.length, 'plugins');
  }

  /**
   * Load plugins from backend
   */
  public async loadPlugins(): Promise<void> {
    try {
      // Call Tauri backend to get installed plugins list
      const pluginList: PluginInfo[] = await invoke('list_plugins');
      this.plugins = pluginList;
      console.log('[PluginManagerUI] Loaded', pluginList.length, 'plugins');
    } catch (error: any) {
      console.error('[PluginManagerUI] Failed to load plugins:', error);
      this.plugins = [];
    }
  }

  /**
   * Render the plugin manager UI
   */
  private render(): void {
    const filteredPlugins = this.filterPlugins();

    this.containerElement.innerHTML = `
      <div class="plugin-manager">
        <div class="plugin-manager-header">
          <div class="plugin-manager-title">
            <h3>Installed Plugins</h3>
            <span class="plugin-count">${filteredPlugins.length} plugin${filteredPlugins.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="plugin-manager-actions">
            <input
              type="text"
              class="plugin-search"
              placeholder="Search plugins..."
              value="${this.searchQuery}"
              id="pluginSearch"
            >
            <button class="install-plugin-btn" id="installPluginBtn">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 5v10M5 10h10"/>
              </svg>
              Install Plugin
            </button>
          </div>
        </div>

        ${filteredPlugins.length === 0 ? this.renderEmptyState() : ''}

        <div class="plugin-list">
          ${filteredPlugins.map(plugin => this.renderPluginCard(plugin)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    if (this.searchQuery) {
      return `
        <div class="plugin-empty-state">
          <p>No plugins found matching "${this.searchQuery}"</p>
        </div>
      `;
    }

    return `
      <div class="plugin-empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M3 5h4v4H3V5zm0 6h4v4H3v-4zm6-6h4v4H9V5zm0 6h4v4H9v-4z"/>
        </svg>
        <h4>No Plugins Installed</h4>
        <p>Get started by installing your first plugin</p>
        <button class="install-plugin-btn-secondary" id="installPluginBtnEmpty">
          Install Plugin
        </button>
      </div>
    `;
  }

  /**
   * Render individual plugin card
   */
  private renderPluginCard(plugin: PluginInfo): string {
    const { metadata, state, enabled, error_message } = plugin;
    const isError = state === PluginState.Error;
    const isRunning = state === PluginState.Running || state === PluginState.Activated;

    const commandCount = metadata.contributes?.commands?.length || 0;
    const viewCount = metadata.contributes?.views?.length || 0;

    return `
      <div class="plugin-card ${isError ? 'error' : ''}" data-plugin-id="${metadata.plugin_id}">
        <div class="plugin-card-header">
          <div class="plugin-info">
            <h4 class="plugin-name">${metadata.display_name}</h4>
            <span class="plugin-version">v${metadata.version}</span>
            ${metadata.author ? `<span class="plugin-author">by ${metadata.author}</span>` : ''}
          </div>
          <div class="plugin-controls">
            <label class="toggle-switch" title="${enabled ? 'Disable' : 'Enable'} plugin">
              <input
                type="checkbox"
                class="plugin-toggle"
                data-plugin-id="${metadata.plugin_id}"
                ${enabled ? 'checked' : ''}
                ${isError ? 'disabled' : ''}
              >
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="plugin-card-body">
          <p class="plugin-description">${metadata.description}</p>

          ${isError && error_message ? `
            <div class="plugin-error-message">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9h2v6H9V9zm0-4h2v2H9V5z"/>
              </svg>
              <span>${error_message}</span>
            </div>
          ` : ''}

          <div class="plugin-stats">
            <span class="plugin-stat">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a7 7 0 100 14 7 7 0 000-14zm-1 11.5v-2h2v2H9zm0-4v-5h2v5H9z"/>
              </svg>
              ${commandCount} command${commandCount !== 1 ? 's' : ''}
            </span>
            <span class="plugin-stat">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 3h14v14H3V3zm2 2v10h10V5H5z"/>
              </svg>
              ${viewCount} view${viewCount !== 1 ? 's' : ''}
            </span>
            <span class="plugin-stat plugin-state ${this.getStateClass(state, enabled)}">
              <span class="state-indicator"></span>
              ${this.getStateLabel(state, enabled)}
            </span>
          </div>

          <div class="plugin-permissions">
            <button class="show-permissions-btn" data-plugin-id="${metadata.plugin_id}">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2C6.69 2 4 4.69 4 8v2H3v8h14v-8h-1V8c0-3.31-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4v2H6V8c0-2.21 1.79-4 4-4z"/>
              </svg>
              ${metadata.permissions.length} permission${metadata.permissions.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        <div class="plugin-card-footer">
          <button class="uninstall-plugin-btn" data-plugin-id="${metadata.plugin_id}">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3h6v2H7V3zM5 6h10v11H5V6zm3 2v7h1V8H8zm3 0v7h1V8h-1z"/>
            </svg>
            Uninstall
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get CSS class for plugin state
   */
  private getStateClass(state: PluginState, enabled: boolean): string {
    if (!enabled) return 'state-disabled';
    if (state === PluginState.Error) return 'state-error';
    if (state === PluginState.Running || state === PluginState.Activated) return 'state-running';
    return 'state-inactive';
  }

  /**
   * Get human-readable state label
   */
  private getStateLabel(state: PluginState, enabled: boolean): string {
    if (!enabled) return 'Disabled';
    if (state === PluginState.Error) return 'Error';
    if (state === PluginState.Running) return 'Running';
    if (state === PluginState.Activated) return 'Active';
    return 'Inactive';
  }

  /**
   * Filter plugins by search query
   */
  private filterPlugins(): PluginInfo[] {
    if (!this.searchQuery) return this.plugins;

    const query = this.searchQuery.toLowerCase();
    return this.plugins.filter(plugin => {
      const metadata = plugin.metadata;
      return (
        metadata.display_name.toLowerCase().includes(query) ||
        metadata.plugin_id.toLowerCase().includes(query) ||
        metadata.description.toLowerCase().includes(query) ||
        (metadata.author && metadata.author.toLowerCase().includes(query))
      );
    });
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Search input
    const searchInput = document.getElementById('pluginSearch') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
    });

    // Install plugin button
    const installBtn = document.getElementById('installPluginBtn');
    const installBtnEmpty = document.getElementById('installPluginBtnEmpty');
    installBtn?.addEventListener('click', () => this.showInstallDialog());
    installBtnEmpty?.addEventListener('click', () => this.showInstallDialog());

    // Plugin toggles (enable/disable)
    const toggles = document.querySelectorAll('.plugin-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const pluginId = target.dataset.pluginId;
        if (pluginId) {
          await this.togglePlugin(pluginId, target.checked);
        }
      });
    });

    // Show permissions buttons
    const permissionBtns = document.querySelectorAll('.show-permissions-btn');
    permissionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const pluginId = target.dataset.pluginId;
        if (pluginId) {
          this.showPermissions(pluginId);
        }
      });
    });

    // Uninstall buttons
    const uninstallBtns = document.querySelectorAll('.uninstall-plugin-btn');
    uninstallBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const pluginId = target.dataset.pluginId;
        if (pluginId) {
          await this.uninstallPlugin(pluginId);
        }
      });
    });
  }

  /**
   * Toggle plugin (enable/disable)
   */
  private async togglePlugin(pluginId: string, enable: boolean): Promise<void> {
    try {
      if (enable) {
        await invoke('activate_plugin', { pluginId });
        console.log('[PluginManagerUI] Activated plugin:', pluginId);
      } else {
        await invoke('deactivate_plugin', { pluginId });
        console.log('[PluginManagerUI] Deactivated plugin:', pluginId);
      }

      // Reload plugins to get updated state
      await this.loadPlugins();
      this.render();
    } catch (error: any) {
      console.error('[PluginManagerUI] Toggle failed:', error);
      alert(`Failed to ${enable ? 'enable' : 'disable'} plugin: ${error.message || error}`);

      // Reload to revert UI state
      await this.loadPlugins();
      this.render();
    }
  }

  /**
   * Show plugin permissions dialog
   */
  private showPermissions(pluginId: string): void {
    const plugin = this.plugins.find(p => p.metadata.plugin_id === pluginId);
    if (!plugin) return;

    const permissions = plugin.metadata.permissions;
    const permissionsHtml = permissions.length > 0
      ? permissions.map(perm => {
          const [type, scope] = perm.split(':');
          return `
            <div class="permission-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2C6.69 2 4 4.69 4 8v2H3v8h14v-8h-1V8c0-3.31-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4v2H6V8c0-2.21 1.79-4 4-4z"/>
              </svg>
              <div class="permission-details">
                <span class="permission-type">${type}</span>
                ${scope ? `<span class="permission-scope">${scope}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')
      : '<p class="no-permissions">This plugin requires no special permissions.</p>';

    const dialog = document.createElement('div');
    dialog.className = 'permission-dialog-overlay';
    dialog.innerHTML = `
      <div class="permission-dialog">
        <div class="permission-dialog-header">
          <h3>Plugin Permissions</h3>
          <button class="close-dialog-btn">×</button>
        </div>
        <div class="permission-dialog-body">
          <h4>${plugin.metadata.display_name}</h4>
          <p class="permissions-description">This plugin requests the following permissions:</p>
          <div class="permissions-list">
            ${permissionsHtml}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Close dialog handlers
    const closeBtn = dialog.querySelector('.close-dialog-btn');
    closeBtn?.addEventListener('click', () => dialog.remove());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  /**
   * Uninstall plugin
   */
  private async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.find(p => p.metadata.plugin_id === pluginId);
    if (!plugin) return;

    const confirmed = confirm(
      `Are you sure you want to uninstall "${plugin.metadata.display_name}"?\n\nThis will remove the plugin and all its data. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await invoke('uninstall_plugin', { pluginId });
      console.log('[PluginManagerUI] Uninstalled plugin:', pluginId);

      // Reload plugins
      await this.loadPlugins();
      this.render();

      // Show success notification (can be improved with toast notification)
      alert(`Successfully uninstalled "${plugin.metadata.display_name}"`);
    } catch (error: any) {
      console.error('[PluginManagerUI] Uninstall failed:', error);
      alert(`Failed to uninstall plugin: ${error.message || error}`);
    }
  }

  /**
   * Show plugin installation dialog
   */
  private showInstallDialog(): void {
    // Create installer container
    const installerContainer = document.createElement('div');
    installerContainer.id = 'plugin-installer-container';
    document.body.appendChild(installerContainer);

    // Initialize PluginInstaller
    this.pluginInstaller = new PluginInstaller('plugin-installer-container');

    // Set callback for installation complete
    (this.pluginInstaller as any).onInstallComplete = async (pluginId: string) => {
      console.log('[PluginManagerUI] Plugin installed:', pluginId);

      // Reload plugins
      await this.loadPlugins();
      this.render();

      // Close installer
      installerContainer.remove();
    };
  }

  /**
   * Refresh plugin list
   */
  public async refresh(): Promise<void> {
    await this.loadPlugins();
    this.render();
  }
}

/**
 * Initialize PluginManagerUI
 */
export async function initPluginManagerUI(containerId: string): Promise<PluginManagerUI> {
  const manager = new PluginManagerUI(containerId);
  await manager.initialize();
  return manager;
}
