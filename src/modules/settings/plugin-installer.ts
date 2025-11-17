// PLUGIN-071: Plugin Installation Dialog
// Provides UI for installing plugins from ZIP files

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface PluginManifest {
  manifestVersion: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  activationEvents: string[];
  permissions: string[];
  contributes?: {
    commands?: Array<{
      commandIdentifier: string;
      description: string;
    }>;
    views?: Array<{
      viewId: string;
      title: string;
    }>;
  };
  engines?: {
    vcp: string;
  };
  dependencies?: Record<string, string>;
}

interface ParsedPlugin {
  manifest: PluginManifest;
  pluginPath: string;
}

/**
 * PluginInstaller class handles the plugin installation workflow
 */
export class PluginInstaller {
  private containerElement: HTMLElement;
  private currentPlugin: ParsedPlugin | null = null;
  private onInstallComplete?: (pluginId: string) => void;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.containerElement = container;
    this.initialize();
  }

  /**
   * Initialize the installer UI
   */
  private initialize(): void {
    this.containerElement.innerHTML = `
      <div class="plugin-installer">
        <div class="installer-header">
          <h2>Install Plugin</h2>
          <button class="close-button" id="closeInstaller">×</button>
        </div>

        <div class="installer-body">
          <!-- Step 1: File Selection -->
          <div class="installer-step" id="stepFileSelection">
            <div class="file-picker-area">
              <div class="file-picker-icon">📦</div>
              <p class="file-picker-text">Select a plugin ZIP file to install</p>
              <button class="primary-button" id="selectPluginFile">Choose Plugin File</button>
              <p class="file-picker-hint">Supported format: .zip</p>
            </div>
          </div>

          <!-- Step 2: Manifest Review (hidden initially) -->
          <div class="installer-step hidden" id="stepManifestReview">
            <div class="manifest-info">
              <div class="plugin-header-info">
                <h3 id="pluginDisplayName" class="plugin-name"></h3>
                <span id="pluginVersion" class="plugin-version"></span>
              </div>

              <div class="info-row">
                <span class="info-label">Plugin ID:</span>
                <span id="pluginName" class="info-value"></span>
              </div>

              <div class="info-row">
                <span class="info-label">Author:</span>
                <span id="pluginAuthor" class="info-value"></span>
              </div>

              <div class="info-row">
                <span class="info-label">Description:</span>
                <p id="pluginDescription" class="info-value description"></p>
              </div>

              <div class="info-row">
                <span class="info-label">Engine Version:</span>
                <span id="pluginEngine" class="info-value"></span>
              </div>

              <!-- Permissions Section (will be populated by PLUGIN-073) -->
              <div class="permissions-section">
                <h4>Permissions Required:</h4>
                <div id="permissionsList" class="permissions-list"></div>
              </div>

              <!-- Contributions Section -->
              <div id="contributionsSection" class="contributions-section hidden">
                <h4>What this plugin provides:</h4>
                <div id="contributionsList" class="contributions-list"></div>
              </div>
            </div>

            <div class="installer-actions">
              <button class="secondary-button" id="cancelInstall">Cancel</button>
              <button class="primary-button" id="confirmInstall">Install Plugin</button>
            </div>
          </div>

          <!-- Step 3: Installation Progress (hidden initially) -->
          <div class="installer-step hidden" id="stepProgress">
            <div class="progress-container">
              <div class="progress-icon">⏳</div>
              <h3 id="progressTitle">Installing Plugin...</h3>
              <div class="progress-bar">
                <div id="progressBarFill" class="progress-bar-fill"></div>
              </div>
              <p id="progressStatus" class="progress-status">Extracting files...</p>
            </div>
          </div>

          <!-- Step 4: Completion (hidden initially) -->
          <div class="installer-step hidden" id="stepComplete">
            <div class="completion-container">
              <div class="completion-icon success">✓</div>
              <h3 id="completionTitle">Plugin Installed Successfully!</h3>
              <p id="completionMessage" class="completion-message"></p>
              <button class="primary-button" id="finishInstall">Done</button>
            </div>
          </div>

          <!-- Error State (hidden initially) -->
          <div class="installer-step hidden" id="stepError">
            <div class="completion-container">
              <div class="completion-icon error">✗</div>
              <h3>Installation Failed</h3>
              <p id="errorMessage" class="error-message"></p>
              <div class="installer-actions">
                <button class="secondary-button" id="retryInstall">Try Again</button>
                <button class="primary-button" id="closeError">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners to UI elements
   */
  private attachEventListeners(): void {
    // Close installer
    const closeButton = document.getElementById('closeInstaller');
    closeButton?.addEventListener('click', () => this.close());

    // File selection
    const selectFileButton = document.getElementById('selectPluginFile');
    selectFileButton?.addEventListener('click', () => this.selectPluginFile());

    // Cancel installation
    const cancelButton = document.getElementById('cancelInstall');
    cancelButton?.addEventListener('click', () => this.reset());

    // Confirm installation
    const confirmButton = document.getElementById('confirmInstall');
    confirmButton?.addEventListener('click', () => this.installPlugin());

    // Finish installation
    const finishButton = document.getElementById('finishInstall');
    finishButton?.addEventListener('click', () => this.close());

    // Retry installation
    const retryButton = document.getElementById('retryInstall');
    retryButton?.addEventListener('click', () => this.reset());

    // Close error
    const closeErrorButton = document.getElementById('closeError');
    closeErrorButton?.addEventListener('click', () => this.close());
  }

  /**
   * PLUGIN-071: Open file picker dialog for selecting plugin ZIP
   */
  private async selectPluginFile(): Promise<void> {
    try {
      // Open file picker dialog (Tauri plugin-dialog)
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Plugin Package',
            extensions: ['zip']
          }
        ]
      });

      if (!selected) {
        // User cancelled
        return;
      }

      const filePath = typeof selected === 'string' ? selected : selected.path;

      // Load and parse the plugin
      await this.loadPlugin(filePath);

    } catch (error: any) {
      this.showError(`Failed to select plugin file: ${error.message || error}`);
    }
  }

  /**
   * Load and parse plugin from ZIP file
   */
  private async loadPlugin(filePath: string): Promise<void> {
    try {
      // Call Tauri backend to parse plugin manifest
      const parsedPlugin: ParsedPlugin = await invoke('parse_plugin_manifest', {
        zipPath: filePath
      });

      this.currentPlugin = parsedPlugin;

      // Display manifest information (PLUGIN-072 implementation)
      this.displayManifest(parsedPlugin.manifest);

      // Show manifest review step
      this.showStep('stepManifestReview');

    } catch (error: any) {
      this.showError(`Failed to load plugin: ${error.message || error}`);
    }
  }

  /**
   * PLUGIN-072: Display parsed manifest information
   */
  private displayManifest(manifest: PluginManifest): void {
    // Plugin name and version
    const displayNameEl = document.getElementById('pluginDisplayName');
    if (displayNameEl) {
      displayNameEl.textContent = manifest.displayName || manifest.name;
    }

    const versionEl = document.getElementById('pluginVersion');
    if (versionEl) {
      versionEl.textContent = `v${manifest.version}`;
    }

    // Plugin ID
    const nameEl = document.getElementById('pluginName');
    if (nameEl) {
      nameEl.textContent = manifest.name;
    }

    // Author
    const authorEl = document.getElementById('pluginAuthor');
    if (authorEl) {
      authorEl.textContent = manifest.author || 'Unknown';
    }

    // Description
    const descriptionEl = document.getElementById('pluginDescription');
    if (descriptionEl) {
      descriptionEl.textContent = manifest.description;
    }

    // Engine version
    const engineEl = document.getElementById('pluginEngine');
    if (engineEl) {
      engineEl.textContent = manifest.engines?.vcp || 'N/A';
    }

    // Permissions list (will be fully implemented in PLUGIN-073)
    this.displayPermissions(manifest.permissions);

    // Contributions (commands, views, etc.)
    this.displayContributions(manifest);
  }

  /**
   * PLUGIN-073: Display permissions list with approval checkboxes
   * Enhanced version with interactive permission approval
   */
  private displayPermissions(permissions: string[]): void {
    const permissionsListEl = document.getElementById('permissionsList');
    if (!permissionsListEl) return;

    if (permissions.length === 0) {
      permissionsListEl.innerHTML = '<p class="no-permissions">No special permissions required</p>';
      // Enable install button if no permissions needed
      this.updateInstallButtonState(true);
      return;
    }

    // PLUGIN-073: Create permission items with checkboxes
    permissionsListEl.innerHTML = permissions.map((permission, index) => {
      const permInfo = this.getPermissionInfo(permission);
      return `
        <div class="permission-item-enhanced">
          <label class="permission-checkbox-container">
            <input
              type="checkbox"
              class="permission-checkbox"
              data-permission="${permission}"
              data-index="${index}"
              id="permission-${index}"
            >
            <span class="permission-checkmark"></span>
          </label>

          <div class="permission-details">
            <div class="permission-header">
              <span class="permission-icon">${permInfo.icon}</span>
              <span class="permission-title">${permInfo.title}</span>
              ${permInfo.riskLevel ? `<span class="risk-badge ${permInfo.riskLevel}">${permInfo.riskLevel.toUpperCase()}</span>` : ''}
            </div>
            <p class="permission-description">${permInfo.description}</p>
            ${permInfo.warning ? `<p class="permission-warning">⚠️ ${permInfo.warning}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add permission approval notice
    const approvalNotice = document.createElement('div');
    approvalNotice.className = 'permission-approval-notice';
    approvalNotice.innerHTML = `
      <p class="approval-notice-text">
        ✓ Please review and approve all permissions before installing.
        You can revoke these permissions later in settings.
      </p>
      <button class="approve-all-button" id="approveAllPermissions">
        Approve All Permissions
      </button>
    `;
    permissionsListEl.appendChild(approvalNotice);

    // Attach checkbox event listeners
    this.attachPermissionCheckboxListeners();

    // Disable install button initially
    this.updateInstallButtonState(false);
  }

  /**
   * PLUGIN-073: Get detailed permission information
   */
  private getPermissionInfo(permission: string): {
    icon: string;
    title: string;
    description: string;
    warning?: string;
    riskLevel?: 'low' | 'medium' | 'high';
  } {
    const parts = permission.split(':');
    const permType = parts[0];
    const scope = parts[1] || '*';

    const permissionInfoMap: Record<string, any> = {
      'filesystem.read': {
        icon: '📂',
        title: 'Read Files',
        description: `This plugin can read files from: ${scope === '*' ? 'any location within AppData' : scope}`,
        riskLevel: scope === '*' ? 'medium' : 'low',
        warning: scope === '*' ? 'This permission allows reading all plugin data files.' : undefined
      },
      'filesystem.write': {
        icon: '✏️',
        title: 'Write Files',
        description: `This plugin can create and modify files in: ${scope === '*' ? 'any location within AppData' : scope}`,
        riskLevel: scope === '*' ? 'high' : 'medium',
        warning: scope === '*' ? 'This permission allows modifying any plugin data files.' : 'Files will be modified or created.'
      },
      'network.request': {
        icon: '🌐',
        title: 'Network Access',
        description: `This plugin can make network requests to: ${scope === '*' ? 'any domain' : scope}`,
        riskLevel: scope === '*' ? 'high' : 'medium',
        warning: scope === '*' ? 'This permission allows unrestricted internet access.' : undefined
      },
      'storage.read': {
        icon: '💾',
        title: 'Read Storage',
        description: 'This plugin can read its own storage data',
        riskLevel: 'low'
      },
      'storage.write': {
        icon: '💾',
        title: 'Write Storage',
        description: 'This plugin can write to its own storage data',
        riskLevel: 'low'
      },
      'system.notify': {
        icon: '🔔',
        title: 'Send Notifications',
        description: 'This plugin can send system notifications',
        riskLevel: 'low'
      },
      'ui.registerCommand': {
        icon: '⚡',
        title: 'Register Commands',
        description: 'This plugin can register UI commands',
        riskLevel: 'low'
      },
      'ui.registerView': {
        icon: '🖼️',
        title: 'Register Views',
        description: 'This plugin can register custom UI views',
        riskLevel: 'low'
      }
    };

    return permissionInfoMap[permType] || {
      icon: '🔒',
      title: permType,
      description: `Permission: ${permission}`,
      riskLevel: 'medium'
    };
  }

  /**
   * PLUGIN-073: Attach checkbox event listeners
   */
  private attachPermissionCheckboxListeners(): void {
    // Individual checkbox listeners
    const checkboxes = this.containerElement.querySelectorAll('.permission-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateInstallButtonState(this.areAllPermissionsApproved());
      });
    });

    // Approve all button listener
    const approveAllButton = document.getElementById('approveAllPermissions');
    if (approveAllButton) {
      approveAllButton.addEventListener('click', () => {
        checkboxes.forEach((checkbox: any) => {
          checkbox.checked = true;
        });
        this.updateInstallButtonState(true);
      });
    }
  }

  /**
   * PLUGIN-073: Check if all permissions are approved
   */
  private areAllPermissionsApproved(): boolean {
    const checkboxes = this.containerElement.querySelectorAll('.permission-checkbox');
    if (checkboxes.length === 0) {
      return true; // No permissions required
    }

    return Array.from(checkboxes).every((checkbox: any) => checkbox.checked);
  }

  /**
   * PLUGIN-073: Update install button enabled/disabled state
   */
  private updateInstallButtonState(enabled: boolean): void {
    const installButton = document.getElementById('confirmInstall') as HTMLButtonElement;
    if (installButton) {
      installButton.disabled = !enabled;
      if (enabled) {
        installButton.classList.remove('button-disabled');
      } else {
        installButton.classList.add('button-disabled');
      }
    }
  }

  /**
   * Display plugin contributions
   */
  private displayContributions(manifest: PluginManifest): void {
    const contributionsSection = document.getElementById('contributionsSection');
    const contributionsList = document.getElementById('contributionsList');

    if (!contributionsSection || !contributionsList) return;

    const contributions: string[] = [];

    // Commands
    if (manifest.contributes?.commands && manifest.contributes.commands.length > 0) {
      manifest.contributes.commands.forEach(cmd => {
        contributions.push(`<div class="contribution-item">
          <span class="contribution-icon">⚡</span>
          <span class="contribution-text"><strong>${cmd.commandIdentifier}</strong>: ${cmd.description}</span>
        </div>`);
      });
    }

    // Views
    if (manifest.contributes?.views && manifest.contributes.views.length > 0) {
      manifest.contributes.views.forEach(view => {
        contributions.push(`<div class="contribution-item">
          <span class="contribution-icon">🖼️</span>
          <span class="contribution-text"><strong>${view.viewId}</strong>: ${view.title}</span>
        </div>`);
      });
    }

    if (contributions.length > 0) {
      contributionsList.innerHTML = contributions.join('');
      contributionsSection.classList.remove('hidden');
    } else {
      contributionsSection.classList.add('hidden');
    }
  }

  /**
   * Install the plugin (will be implemented with PLUGIN-074 progress indicator)
   */
  private async installPlugin(): Promise<void> {
    if (!this.currentPlugin) {
      this.showError('No plugin selected');
      return;
    }

    try {
      // Show progress step (PLUGIN-074)
      this.showStep('stepProgress');

      // Update progress: Validating permissions
      this.updateProgress(20, 'Validating permissions...');

      // Call Tauri backend to install plugin
      // This will be implemented when PluginManager is integrated
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate validation

      // Update progress: Installing plugin
      this.updateProgress(50, 'Installing plugin files...');

      await invoke('install_plugin', {
        zipPath: this.currentPlugin.pluginPath
      });

      // Update progress: Activating plugin
      this.updateProgress(80, 'Activating plugin...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Update progress: Complete
      this.updateProgress(100, 'Installation complete!');

      // Show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      this.showCompletion(this.currentPlugin.manifest);

      // Notify completion callback
      if (this.onInstallComplete) {
        this.onInstallComplete(this.currentPlugin.manifest.name);
      }

    } catch (error: any) {
      this.showError(`Installation failed: ${error.message || error}`);
    }
  }

  /**
   * PLUGIN-074: Update installation progress
   */
  private updateProgress(percentage: number, status: string): void {
    const progressBarFill = document.getElementById('progressBarFill');
    const progressStatus = document.getElementById('progressStatus');

    if (progressBarFill) {
      progressBarFill.style.width = `${percentage}%`;
    }

    if (progressStatus) {
      progressStatus.textContent = status;
    }
  }

  /**
   * Show completion message
   */
  private showCompletion(manifest: PluginManifest): void {
    const completionMessage = document.getElementById('completionMessage');
    if (completionMessage) {
      completionMessage.textContent = `${manifest.displayName || manifest.name} has been installed and is ready to use.`;
    }

    this.showStep('stepComplete');
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
      errorMessage.textContent = message;
    }

    this.showStep('stepError');
  }

  /**
   * Show specific step and hide others
   */
  private showStep(stepId: string): void {
    const allSteps = this.containerElement.querySelectorAll('.installer-step');
    allSteps.forEach(step => step.classList.add('hidden'));

    const targetStep = document.getElementById(stepId);
    if (targetStep) {
      targetStep.classList.remove('hidden');
    }
  }

  /**
   * Reset installer to initial state
   */
  private reset(): void {
    this.currentPlugin = null;
    this.showStep('stepFileSelection');
  }

  /**
   * Close installer
   */
  private close(): void {
    this.containerElement.style.display = 'none';
    this.reset();
  }

  /**
   * Open installer dialog
   */
  public open(): void {
    this.containerElement.style.display = 'block';
    this.reset();
  }

  /**
   * Set callback for installation completion
   */
  public setOnInstallComplete(callback: (pluginId: string) => void): void {
    this.onInstallComplete = callback;
  }
}
