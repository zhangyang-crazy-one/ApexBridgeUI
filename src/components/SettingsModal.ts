/**
 * SettingsModal Component (US5-001)
 *
 * Tabbed settings modal with 4 tabs:
 * - General: User info, theme, language switcher
 * - Backend: API configuration
 * - Window: Window preferences
 * - Shortcuts: Keyboard shortcuts
 */

import { GlobalSettings, getDefaultSettings } from '../core/models/settings';
import { settingsManager } from '../core/managers/settingsManager';
import { t } from '../core/i18n/i18nManager';
import { GeneralSettings } from './settings/GeneralSettings';
import { BackendSettings } from './settings/BackendSettings';
import { WindowSettings } from './settings/WindowSettings';
import { ShortcutsSettings } from './settings/ShortcutsSettings';
import closeIcon from '@/template/pic_resource/icon/Emoji_instead/close.svg';

export class SettingsModal {
  private modal: HTMLElement | null = null;
  private currentTab: 'general' | 'backend' | 'window' | 'shortcuts' = 'general';
  private settings: GlobalSettings | null = null;
  private originalSettings: GlobalSettings | null = null;
  private isOpen: boolean = false; // Track modal state to prevent multiple instances

  // Tab components
  private generalTab: GeneralSettings | null = null;
  private backendTab: BackendSettings | null = null;
  private windowTab: WindowSettings | null = null;
  private shortcutsTab: ShortcutsSettings | null = null;

  constructor() {
    // ✅ Don't call async loadSettings() in constructor
    // Settings will be loaded in open() method
    console.log('[SettingsModal] Constructor called');
  }

  private async loadSettings(): Promise<void> {
    try {
      // Use SettingsManager instead of direct IPC call (works in both Tauri and browser)
      this.settings = settingsManager.getSettings();
      this.originalSettings = JSON.parse(JSON.stringify(this.settings)); // Deep copy
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = getDefaultSettings();
      this.originalSettings = JSON.parse(JSON.stringify(this.settings));
    }
  }

  /**
   * Open the settings modal
   * @param tab Optional tab to open (defaults to 'general')
   */
  public async open(tab?: 'general' | 'backend' | 'window' | 'shortcuts'): Promise<void> {
    console.log('[SettingsModal] 🔵 open() called, tab:', tab);
    console.log('[SettingsModal] isOpen:', this.isOpen);
    console.log('[SettingsModal] settings:', this.settings);

    // Prevent opening multiple instances
    if (this.isOpen) {
      console.warn('[SettingsModal] Modal is already open');
      return;
    }

    if (!this.settings) {
      console.log('[SettingsModal] Loading settings...');
      await this.loadSettings();
      console.log('[SettingsModal] Settings loaded:', this.settings);
    }

    // Clean up any existing modal instances before creating a new one
    const existingModals = document.querySelectorAll('.settings-modal-overlay');
    existingModals.forEach(modal => modal.remove());

    console.log('[SettingsModal] Calling render()...');
    this.render();
    console.log('[SettingsModal] render() completed, modal:', this.modal);

    // Switch to specified tab if provided
    if (tab && tab !== 'general') {
      console.log('[SettingsModal] Switching to tab:', tab);
      this.switchTab(tab);
    }

    // Add to DOM
    console.log('[SettingsModal] Appending modal to body...');
    document.body.appendChild(this.modal!);

    // Mark as open
    this.isOpen = true;

    // Show modal with animation (same pattern as AgentEditor/GroupEditor)
    // Use setTimeout to ensure browser has time to apply initial styles before transition
    console.log('[SettingsModal] Adding .show class with setTimeout...');
    setTimeout(() => {
      console.log('[SettingsModal] Adding .show class now');
      this.modal?.classList.add('show');

      // Reset scroll position to top to ensure content is visible
      const settingsContent = this.modal?.querySelector('.settings-content');
      if (settingsContent) {
        settingsContent.scrollTop = 0;
        console.log('[SettingsModal] Reset scroll position to top');
      }

      console.log('[SettingsModal] Modal classList:', this.modal?.classList);
      console.log('[SettingsModal] ✅ Modal should now be visible');
    }, 10);
  }

  /**
   * Close the settings modal
   */
  public close(): void {
    if (!this.modal) return;

    // Remove event listeners to prevent memory leaks
    document.removeEventListener('keydown', this.handleEscape);

    // Fade out animation
    this.modal.classList.remove('show');

    // Mark as closed
    this.isOpen = false;

    setTimeout(() => {
      this.modal?.remove();
      this.modal = null;

      // Cleanup tab components
      this.generalTab = null;
      this.backendTab = null;
      this.windowTab = null;
      this.shortcutsTab = null;
    }, 300);
  }

  /**
   * Render the modal
   */
  private render(): void {
    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal-overlay';

    this.modal.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <h2>${t('settings.title')}</h2>
          <button class="settings-close" data-action="close">
            <img src="${closeIcon}" alt="Close" />
          </button>
        </div>

        <div class="settings-content">
          <!-- Tab Navigation -->
          <div class="settings-tabs">
            <button class="tab-btn tab-btn-beautified active" data-tab="general">
              <img src="/icons/setting.svg" class="tab-icon" alt="General">
              <span>${t('settings.tabs.general')}</span>
            </button>

            <button class="tab-btn tab-btn-beautified" data-tab="backend">
              <img src="/icons/back-end.svg" class="tab-icon" alt="Backend">
              <span>${t('settings.tabs.backend')}</span>
            </button>

            <button class="tab-btn tab-btn-beautified" data-tab="window">
              <img src="/icons/windows.svg" class="tab-icon" alt="Window">
              <span>${t('settings.tabs.window')}</span>
            </button>

            <button class="tab-btn tab-btn-beautified" data-tab="shortcuts">
              <img src="/icons/hotkey.svg" class="tab-icon" alt="Shortcuts">
              <span>${t('settings.tabs.shortcuts')}</span>
            </button>
          </div>

          <!-- Tab Content -->
          <div class="settings-tab-content">
            <div id="tab-general" class="tab-pane active"></div>
            <div id="tab-backend" class="tab-pane"></div>
            <div id="tab-window" class="tab-pane"></div>
            <div id="tab-shortcuts" class="tab-pane"></div>
          </div>
        </div>

        <div class="settings-footer">
          <button class="btn-secondary" data-action="cancel">${t('settings.cancel')}</button>
          <button class="btn-primary" data-action="save">${t('settings.save')}</button>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();

    // Initialize tab components
    this.initializeTabComponents();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close button
    const closeBtn = this.modal.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.handleCancel());

    // Cancel button
    const cancelBtn = this.modal.querySelector('[data-action="cancel"]');
    cancelBtn?.addEventListener('click', () => this.handleCancel());

    // Save button
    const saveBtn = this.modal.querySelector('[data-action="save"]');
    saveBtn?.addEventListener('click', () => this.handleSave());

    // Tab buttons
    const tabBtns = this.modal.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.dataset.tab as typeof this.currentTab;
        this.switchTab(tab);
      });
    });

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.handleCancel();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', this.handleEscape);
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.handleCancel();
    }
  };

  /**
   * Initialize tab components
   */
  private initializeTabComponents(): void {
    if (!this.modal || !this.settings) return;

    // General tab
    const generalContainer = this.modal.querySelector('#tab-general') as HTMLElement;
    this.generalTab = new GeneralSettings(generalContainer, this.settings);

    // Backend tab
    const backendContainer = this.modal.querySelector('#tab-backend') as HTMLElement;
    this.backendTab = new BackendSettings(backendContainer, this.settings);

    // Window tab
    const windowContainer = this.modal.querySelector('#tab-window') as HTMLElement;
    this.windowTab = new WindowSettings(windowContainer, this.settings);

    // Shortcuts tab
    const shortcutsContainer = this.modal.querySelector('#tab-shortcuts') as HTMLElement;
    this.shortcutsTab = new ShortcutsSettings(shortcutsContainer, this.settings);
  }

  /**
   * Switch between tabs
   */
  private switchTab(tab: typeof this.currentTab): void {
    if (tab === this.currentTab) return;

    // Update active tab button
    const tabBtns = this.modal?.querySelectorAll('.tab-btn');
    tabBtns?.forEach(btn => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update active tab pane
    const tabPanes = this.modal?.querySelectorAll('.tab-pane');
    tabPanes?.forEach(pane => {
      if (pane.id === `tab-${tab}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    this.currentTab = tab;
  }

  /**
   * Handle cancel action
   */
  private handleCancel(): void {
    // Check if there are unsaved changes
    const hasChanges = JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);

    if (hasChanges) {
      const confirmed = confirm(t('settings.unsavedChangesWarning'));
      if (!confirmed) return;
    }

    document.removeEventListener('keydown', this.handleEscape);
    this.close();
  }

  /**
   * Handle save action
   */
  private async handleSave(): Promise<void> {
    if (!this.settings) return;

    try {
      // Collect changes from all tabs
      const updatedSettings: GlobalSettings = {
        ...this.settings,
        ...this.generalTab?.getSettings(),
        ...this.backendTab?.getSettings(),
        ...this.windowTab?.getSettings(),
        keyboard_shortcuts: this.shortcutsTab?.getSettings() || this.settings.keyboard_shortcuts
      };

      // Validate settings
      const validation = this.validateSettings(updatedSettings);
      if (!validation.valid) {
        alert(t('settings.validationError') + ': ' + validation.errors.join(', '));
        return;
      }

      // Check if language changed
      const languageChanged = this.settings.language !== updatedSettings.language;

      // Save using SettingsManager (works in both Tauri and browser)
      // updateSettings() will automatically persist and apply the settings
      const savedSettings = await settingsManager.updateSettings(updatedSettings);

      // Update reference with the saved settings
      this.settings = savedSettings;
      this.originalSettings = JSON.parse(JSON.stringify(savedSettings));

      // Show success message
      this.showSuccessMessage();

      // If language changed, prompt user to reload the page
      if (languageChanged) {
        setTimeout(() => {
          const confirmed = confirm(t('settings.general.languageRestartWarning') + '\n\n' + t('settings.reloadNow'));
          if (confirmed) {
            window.location.reload();
          } else {
            document.removeEventListener('keydown', this.handleEscape);
            this.close();
          }
        }, 500);
      } else {
        // Close modal after short delay (only if language didn't change)
        setTimeout(() => {
          document.removeEventListener('keydown', this.handleEscape);
          this.close();
        }, 1000);
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(t('settings.saveError') + ': ' + (error as Error).message);
    }
  }

  /**
   * Validate settings
   */
  private validateSettings(settings: GlobalSettings): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Backend URL validation
    if (!settings.backend_url || !settings.backend_url.startsWith('http')) {
      errors.push(t('settings.validation.invalidBackendUrl'));
    }

    // API key validation
    if (!settings.api_key || settings.api_key.trim().length === 0) {
      errors.push(t('settings.validation.missingApiKey'));
    }

    // User name validation
    if (!settings.user_name || settings.user_name.trim().length === 0) {
      errors.push(t('settings.validation.missingUserName'));
    }

    // Window size validation
    if (settings.window_preferences.width < 800 || settings.window_preferences.height < 600) {
      errors.push(t('settings.validation.invalidWindowSize'));
    }

    // Transparency validation
    if (settings.window_preferences.transparency < 0 || settings.window_preferences.transparency > 1) {
      errors.push(t('settings.validation.invalidTransparency'));
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Show success message
   */
  private showSuccessMessage(): void {
    const message = document.createElement('div');
    message.className = 'settings-success-message';
    message.textContent = t('settings.saveSuccess');

    this.modal?.querySelector('.settings-modal')?.appendChild(message);

    setTimeout(() => message.remove(), 2000);
  }
}
