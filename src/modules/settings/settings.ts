/**
 * Settings Module (CORE-058)
 *
 * Settings UI with Tabbed Interface
 *
 * Responsibilities:
 * - Render settings modal with tabs (Global, Plugins, Theme, Language)
 * - Integrate with SettingsManager for persistence
 * - Provide UI for all user-configurable settings
 * - Handle settings validation and error display
 * - Support keyboard navigation (Tab, Escape)
 * - Auto-save on settings change
 * - Real-time preview for theme switching
 *
 * Features:
 * - Four main tabs: Global, Plugins, Theme, Language
 * - Form inputs for all GlobalSettings fields
 * - Backend URL and API key configuration
 * - WebSocket settings (optional)
 * - User profile (name, avatar)
 * - Window preferences (always-on-top, transparency, startup)
 * - Sidebar width sliders
 * - Streaming preferences toggles
 * - Keyboard shortcut editor
 * - Theme switcher with live preview
 * - Language selector (zh-CN, en-US)
 * - Plugin list with enable/disable (delegated to plugin-manager.ts)
 * - Reset to defaults button
 * - Close button and ESC key dismiss
 *
 * Usage:
 * ```typescript
 * import { SettingsUI } from './modules/settings/settings';
 *
 * const settingsUI = SettingsUI.getInstance();
 * settingsUI.show();  // Open settings modal
 * settingsUI.hide();  // Close settings modal
 * ```
 */

import { SettingsManager } from '../../core/managers/settingsManager';
import { GlobalSettings } from '../../core/models/settings';
import { PluginManagerUI } from './plugin-manager';
import { PluginStore } from './plugin-store';
import { I18nManager, Language } from '../../core/i18n/i18nManager';

export type SettingsTab = 'global' | 'plugins' | 'theme' | 'language';
export type PluginsSubTab = 'installed' | 'store';

export class SettingsUI {
  private static instance: SettingsUI;
  private settingsManager: SettingsManager;
  private modalElement: HTMLElement | null = null;
  private activeTab: SettingsTab = 'global';
  private activePluginsSubTab: PluginsSubTab = 'installed';
  private currentSettings: GlobalSettings;
  private isDirty: boolean = false;
  private pluginManagerUI: PluginManagerUI | null = null;
  private pluginStore: PluginStore | null = null;

  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
    this.currentSettings = this.settingsManager.getSettings();

    // Listen to language-changed events to update UI
    window.addEventListener('language-changed', () => {
      if (this.modalElement) {
        // Re-render current tab when language changes
        this.renderTabContent();
      }
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsUI {
    if (!SettingsUI.instance) {
      SettingsUI.instance = new SettingsUI();
    }
    return SettingsUI.instance;
  }

  /**
   * Show settings modal
   */
  public show(tab: SettingsTab = 'global'): void {
    this.activeTab = tab;
    this.currentSettings = this.settingsManager.getSettings();
    this.isDirty = false;

    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }

    // createModal() now sets this.modalElement internally
    const modalOverlay = this.createModal();
    document.body.appendChild(modalOverlay);

    // Focus first input after render
    setTimeout(() => this.focusFirstInput(), 100);

    console.log('[SettingsUI] Opened with tab:', tab);
  }

  /**
   * Hide settings modal
   */
  public hide(): void {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
    console.log('[SettingsUI] Closed');
  }

  /**
   * Switch to specific tab
   */
  public switchTab(tab: SettingsTab): void {
    this.activeTab = tab;
    if (this.modalElement) {
      this.renderTabs();
      this.renderTabContent();
    }
  }

  /**
   * Create modal HTML structure
   */
  private createModal(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.handleClose();
    };

    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button class="settings-close" aria-label="Close settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15.8 5.2l-1-1L10 9 5.2 4.2l-1 1L9 10l-4.8 4.8 1 1L10 11l4.8 4.8 1-1L11 10z"/>
          </svg>
        </button>
      </div>

      <div class="settings-tabs" role="tablist"></div>

      <div class="settings-content"></div>

      <div class="settings-footer">
        <button class="settings-reset-btn">Reset to Defaults</button>
        <div class="settings-footer-right">
          <span class="settings-status"></span>
          <button class="settings-save-btn">Save Changes</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);

    // Attach event listeners
    modal.querySelector('.settings-close')?.addEventListener('click', () => this.handleClose());
    modal.querySelector('.settings-reset-btn')?.addEventListener('click', () => this.handleReset());
    modal.querySelector('.settings-save-btn')?.addEventListener('click', () => this.handleSave());

    // Keyboard events
    document.addEventListener('keydown', this.handleKeydown);

    // Set modalElement BEFORE rendering tabs/content so querySelector works
    this.modalElement = overlay;
    this.renderTabs();
    this.renderTabContent();

    return overlay;
  }

  /**
   * Render tab buttons
   */
  private renderTabs(): void {
    const tabsContainer = this.modalElement?.querySelector('.settings-tabs');
    if (!tabsContainer) return;

    const tabs: { id: SettingsTab; label: string; icon: string }[] = [
      { id: 'global', label: 'Global', icon: 'M10 3a7 7 0 100 14 7 7 0 000-14zm-1 11.5v-2h2v2H9zm0-4v-5h2v5H9z' },
      { id: 'plugins', label: 'Plugins', icon: 'M3 5h4v4H3V5zm0 6h4v4H3v-4zm6-6h4v4H9V5zm0 6h4v4H9v-4z' },
      { id: 'theme', label: 'Theme', icon: 'M10 2a6 6 0 100 12 6 6 0 000-12zm0 11V3a5 5 0 010 10z' },
      { id: 'language', label: 'Language', icon: 'M10 2a8 8 0 100 16 8 8 0 000-16zM9 14H7a7 7 0 010-8h2v8zm2 0V6h2a7 7 0 010 8h-2z' }
    ];

    tabsContainer.innerHTML = tabs.map(tab => `
      <button
        class="settings-tab ${this.activeTab === tab.id ? 'active' : ''}"
        role="tab"
        aria-selected="${this.activeTab === tab.id}"
        data-tab="${tab.id}"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path d="${tab.icon}"/>
        </svg>
        <span>${tab.label}</span>
      </button>
    `).join('');

    // Attach click handlers
    tabsContainer.querySelectorAll('.settings-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabId = target.dataset.tab as SettingsTab;
        this.switchTab(tabId);
      });
    });
  }

  /**
   * Render active tab content
   */
  private renderTabContent(): void {
    const contentContainer = this.modalElement?.querySelector('.settings-content');
    if (!contentContainer) return;

    switch (this.activeTab) {
      case 'global':
        contentContainer.innerHTML = this.renderGlobalTab();
        // Wait for DOM to parse before attaching listeners
        setTimeout(() => this.attachGlobalTabListeners(), 0);
        break;
      case 'plugins':
        contentContainer.innerHTML = this.renderPluginsTab();
        // Wait for DOM to parse before attaching listeners
        setTimeout(() => this.attachPluginsTabListeners(), 0);
        break;
      case 'theme':
        contentContainer.innerHTML = this.renderThemeTab();
        // Wait for DOM to parse before attaching listeners
        setTimeout(() => this.attachThemeTabListeners(), 0);
        break;
      case 'language':
        contentContainer.innerHTML = this.renderLanguageTab();
        // Wait for DOM to parse before attaching listeners
        setTimeout(() => this.attachLanguageTabListeners(), 0);
        break;
    }
  }

  /**
   * Render Global tab content
   */
  private renderGlobalTab(): string {
    const s = this.currentSettings;
    return `
      <div class="settings-section">
        <h3>Backend Connection</h3>
        <div class="settings-field">
          <label for="backend-url">Backend URL</label>
          <input type="url" id="backend-url" value="${s.backend_url}" placeholder="http://localhost:6005/v1/chat/completions">
        </div>
        <div class="settings-field">
          <label for="api-key">API Key</label>
          <input type="password" id="api-key" value="${s.api_key}" placeholder="your-api-key">
        </div>
        <div class="settings-field">
          <label for="websocket-url">WebSocket URL (Optional)</label>
          <input type="url" id="websocket-url" value="${s.websocket_url || ''}" placeholder="ws://localhost:6005">
        </div>
        <div class="settings-field">
          <label for="websocket-key">WebSocket Key (Optional)</label>
          <input type="password" id="websocket-key" value="${s.websocket_key || ''}" placeholder="websocket-key">
        </div>
      </div>

      <div class="settings-section">
        <h3>User Profile</h3>
        <div class="settings-field">
          <label for="user-name">Username</label>
          <input type="text" id="user-name" value="${s.user_name}" placeholder="Your Name">
        </div>
        <div class="settings-field">
          <label for="user-avatar">Avatar URL</label>
          <input type="url" id="user-avatar" value="${s.user_avatar}" placeholder="/avatars/user.png">
        </div>
      </div>

      <div class="settings-section">
        <h3>Window Preferences</h3>
        <div class="settings-field-checkbox">
          <input type="checkbox" id="always-on-top" ${s.window_preferences.always_on_top ? 'checked' : ''}>
          <label for="always-on-top">Always on Top</label>
        </div>
        <div class="settings-field">
          <label for="transparency">Window Transparency: ${Math.round(s.window_preferences.transparency * 100)}%</label>
          <input type="range" id="transparency" min="50" max="100" value="${Math.round(s.window_preferences.transparency * 100)}">
        </div>
        <div class="settings-field">
          <label for="startup-behavior">Startup Behavior</label>
          <select id="startup-behavior">
            <option value="normal" ${s.window_preferences.startup_behavior === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="minimized" ${s.window_preferences.startup_behavior === 'minimized' ? 'selected' : ''}>Minimized</option>
            <option value="hidden" ${s.window_preferences.startup_behavior === 'hidden' ? 'selected' : ''}>Hidden</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3>Sidebar Widths</h3>
        <div class="settings-field">
          <label for="agents-width">Agents List Sidebar: ${s.sidebar_widths.agents_list}px</label>
          <input type="range" id="agents-width" min="200" max="600" value="${s.sidebar_widths.agents_list}">
        </div>
        <div class="settings-field">
          <label for="notifications-width">Notifications Sidebar: ${s.sidebar_widths.notifications}px</label>
          <input type="range" id="notifications-width" min="200" max="600" value="${s.sidebar_widths.notifications}">
        </div>
      </div>

      <div class="settings-section">
        <h3>Streaming Preferences</h3>
        <div class="settings-field-checkbox">
          <input type="checkbox" id="smooth-streaming" ${s.streaming_preferences.smooth_streaming ? 'checked' : ''}>
          <label for="smooth-streaming">Enable Smooth Streaming</label>
        </div>
        <div class="settings-field">
          <label for="chunk-delay">Chunk Delay: ${s.streaming_preferences.chunk_delay_ms}ms</label>
          <input type="range" id="chunk-delay" min="10" max="200" step="10" value="${s.streaming_preferences.chunk_delay_ms}">
        </div>
        <div class="settings-field-checkbox">
          <input type="checkbox" id="enable-morphdom" ${s.streaming_preferences.enable_morphdom ? 'checked' : ''}>
          <label for="enable-morphdom">Enable Morphdom (Efficient DOM Updates)</label>
        </div>
      </div>
    `;
  }

  /**
   * Attach Global tab event listeners
   */
  private attachGlobalTabListeners(): void {
    const inputs = [
      'backend-url', 'api-key', 'websocket-url', 'websocket-key',
      'user-name', 'user-avatar', 'always-on-top', 'transparency',
      'startup-behavior', 'agents-width', 'notifications-width',
      'smooth-streaming', 'chunk-delay', 'enable-morphdom'
    ];

    console.log('[SettingsUI] Attaching event listeners to', inputs.length, 'inputs');

    inputs.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) {
        elem.addEventListener('change', () => {
          console.log('[SettingsUI] Change event fired for:', id);
          this.handleSettingChange();
        });
        elem.addEventListener('input', () => {
          console.log('[SettingsUI] Input event fired for:', id);
          this.handleSettingChange();
        });
        console.log('[SettingsUI] Listeners attached to:', id);
      } else {
        console.warn('[SettingsUI] Element not found:', id);
      }
    });

    console.log('[SettingsUI] Event listener attachment complete');
  }

  /**
   * Render Plugins tab content
   */
  private renderPluginsTab(): string {
    return `
      <div class="settings-section">
        <!-- Plugin Sub-tabs -->
        <div class="plugin-subtabs">
          <button
            class="plugin-subtab ${this.activePluginsSubTab === 'installed' ? 'active' : ''}"
            data-subtab="installed"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5h4v4H3V5zm0 6h4v4H3v-4zm6-6h4v4H9V5zm0 6h4v4H9v-4z"/>
            </svg>
            <span>Installed Plugins</span>
          </button>
          <button
            class="plugin-subtab ${this.activePluginsSubTab === 'store' ? 'active' : ''}"
            data-subtab="store"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3L2 8v9h16v-9l-8-5zm6 13H4V9.5l6-3.75 6 3.75V16z"/>
              <path d="M7 11h6v5H7z"/>
            </svg>
            <span>Plugin Store</span>
          </button>
        </div>

        <!-- Plugin Content Container -->
        <div id="plugin-content-container">
          <!-- PluginManagerUI or PluginStore will be mounted here -->
        </div>
      </div>
    `;
  }

  /**
   * Attach Plugins tab event listeners and initialize plugin UI components
   */
  private async attachPluginsTabListeners(): Promise<void> {
    console.log('[DEBUG] attachPluginsTabListeners called');
    // Attach sub-tab switchers
    const subTabButtons = document.querySelectorAll('.plugin-subtab');
    console.log('[DEBUG] Found sub-tab buttons for event listeners:', subTabButtons.length);
    subTabButtons.forEach((btn, index) => {
      const subtabAttr = (btn as HTMLElement).dataset.subtab;
      console.log(`[DEBUG] Attaching listener to button ${index}, subtab:`, subtabAttr);
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clickedSubtab = target.dataset.subtab as PluginsSubTab;
        console.log('[DEBUG] Sub-tab button clicked, subtab:', clickedSubtab);
        this.switchPluginsSubTab(clickedSubtab);
      });
    });

    // Initialize active sub-tab component
    console.log('[DEBUG] Calling renderActivePluginSubTab from attachPluginsTabListeners...');
    await this.renderActivePluginSubTab();
  }

  /**
   * Switch plugin sub-tab
   */
  private async switchPluginsSubTab(subtab: PluginsSubTab): Promise<void> {
    console.log('[DEBUG] switchPluginsSubTab called with:', subtab);
    this.activePluginsSubTab = subtab;

    // Update sub-tab button states
    const subTabButtons = document.querySelectorAll('.plugin-subtab');
    console.log('[DEBUG] Found sub-tab buttons:', subTabButtons.length);
    subTabButtons.forEach(btn => {
      const btnSubtab = (btn as HTMLElement).dataset.subtab;
      if (btnSubtab === subtab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Render active component
    console.log('[DEBUG] Calling renderActivePluginSubTab...');
    await this.renderActivePluginSubTab();
    console.log('[DEBUG] renderActivePluginSubTab completed');
  }

  /**
   * Render the active plugin sub-tab component
   */
  private async renderActivePluginSubTab(): Promise<void> {
    console.log('[DEBUG] renderActivePluginSubTab called, activePluginsSubTab:', this.activePluginsSubTab);
    const container = document.getElementById('plugin-content-container');
    console.log('[DEBUG] Container found:', !!container);
    if (!container) {
      console.error('[ERROR] plugin-content-container not found in DOM');
      return;
    }

    // Clear container
    container.innerHTML = '';
    console.log('[DEBUG] Container cleared');

    if (this.activePluginsSubTab === 'installed') {
      console.log('[DEBUG] Loading PluginManagerUI...');
      // Initialize PluginManagerUI
      if (!this.pluginManagerUI) {
        this.pluginManagerUI = new PluginManagerUI('plugin-content-container');
        await this.pluginManagerUI.initialize();
      } else {
        // Refresh if already initialized
        await this.pluginManagerUI.refresh();
      }
      console.log('[DEBUG] PluginManagerUI loaded');
    } else if (this.activePluginsSubTab === 'store') {
      console.log('[DEBUG] Loading PluginStore...');
      try {
        // Initialize PluginStore
        if (!this.pluginStore) {
          const { initPluginStore } = await import('./plugin-store');
          console.log('[DEBUG] plugin-store module imported');
          this.pluginStore = await initPluginStore('plugin-content-container');
          console.log('[DEBUG] PluginStore initialized');
        } else {
          // Refresh if already initialized
          console.log('[DEBUG] Refreshing existing PluginStore');
          await this.pluginStore.refresh();
          console.log('[DEBUG] PluginStore refreshed');
        }

        // Scroll to top to show plugin cards
        const contentContainer = this.modalElement?.querySelector('.settings-content');
        if (contentContainer) {
          contentContainer.scrollTop = 0;
          console.log('[DEBUG] Scrolled content to top');
        }
      } catch (error) {
        console.error('[ERROR] Failed to load PluginStore:', error);
      }
    }
  }

  /**
   * Render Theme tab content
   */
  private renderThemeTab(): string {
    const s = this.currentSettings;
    return `
      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="settings-field-radio">
          <input type="radio" id="theme-light" name="theme" value="light" ${s.theme === 'light' ? 'checked' : ''}>
          <label for="theme-light">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2m0 18v2M3.5 3.5l1.4 1.4m14.2 14.2l1.4 1.4M1 12h2m18 0h2M3.5 20.5l1.4-1.4m14.2-14.2l1.4-1.4"/>
            </svg>
            <span>Light</span>
          </label>
        </div>
        <div class="settings-field-radio">
          <input type="radio" id="theme-dark" name="theme" value="dark" ${s.theme === 'dark' ? 'checked' : ''}>
          <label for="theme-dark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>
            </svg>
            <span>Dark</span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>Preview</h3>
        <div class="theme-preview">
          <div class="theme-preview-content" data-theme="${s.theme}">
            <p class="preview-text-primary">Primary text color</p>
            <p class="preview-text-secondary">Secondary text color</p>
            <div class="preview-button">Sample Button</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach Theme tab event listeners
   */
  private attachThemeTabListeners(): void {
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this.currentSettings.theme = target.value;
          this.updateThemePreview(target.value);
          this.handleSettingChange();
        }
      });
    });
  }

  /**
   * Update theme preview and apply theme globally
   */
  private updateThemePreview(theme: string): void {
    // Update preview
    const preview = document.querySelector('.theme-preview-content');
    if (preview) {
      preview.setAttribute('data-theme', theme);
    }

    // Apply theme globally to <html> element
    document.documentElement.setAttribute('data-theme', theme);

    // Save to localStorage
    localStorage.setItem('vcpchat-theme', theme);

    console.log(`[Settings] Theme changed to: ${theme}`);
  }

  /**
   * Render Language tab content (CORE-069)
   * Updated to remove emoji flags and provide i18n integration info
   */
  private renderLanguageTab(): string {
    const s = this.currentSettings;
    return `
      <div class="settings-section">
        <h3>Language / 语言</h3>
        <div class="settings-field-radio">
          <input type="radio" id="lang-en" name="language" value="en-US" ${s.language === 'en-US' ? 'checked' : ''}>
          <label for="lang-en">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              <path d="M6.5 9L4 11.5l2.5 2.5V9zm11 6l-2.5-2.5V18l2.5-2.5z"/>
            </svg>
            <span>English (US)</span>
          </label>
        </div>
        <div class="settings-field-radio">
          <input type="radio" id="lang-zh" name="language" value="zh-CN" ${s.language === 'zh-CN' ? 'checked' : ''}>
          <label for="lang-zh">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>中文（简体）</span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>Note / 注意</h3>
        <p class="settings-description">
          Language changes take effect immediately. The UI will update in real-time to reflect your selected language.
          <br>
          语言更改将立即生效。界面将实时更新以反映您选择的语言。
        </p>
      </div>
    `;
  }

  /**
   * Attach Language tab event listeners (CORE-069)
   * Integrates with I18nManager for dynamic language switching
   */
  private attachLanguageTabListeners(): void {
    const i18n = I18nManager.getInstance();
    const langRadios = document.querySelectorAll('input[name="language"]');

    langRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          const langValue = target.value as 'zh-CN' | 'en-US';
          this.currentSettings.language = langValue;

          // Map setting language to i18n Language enum
          const i18nLang = langValue === 'zh-CN' ? Language.ZH_CN : Language.EN_US;

          // Update i18n manager immediately for real-time effect
          i18n.setLanguage(i18nLang);

          this.handleSettingChange();

          // Show notification that language changed
          this.showStatus(
            langValue === 'zh-CN'
              ? '语言已更改为中文'
              : 'Language changed to English',
            'success'
          );

          console.log('[SettingsUI] Language changed to:', i18nLang);
        }
      });
    });
  }

  /**
   * Handle setting change (mark dirty)
   */
  private handleSettingChange(): void {
    this.isDirty = true;
    this.updateSaveButton();
    console.log('[SettingsUI] Setting changed, isDirty set to true');
  }

  /**
   * Update save button state
   */
  private updateSaveButton(): void {
    const saveBtn = this.modalElement?.querySelector('.settings-save-btn') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = !this.isDirty;
    }
  }

  /**
   * Handle save button click
   */
  private async handleSave(): Promise<void> {
    console.log('[SettingsUI] handleSave() called, isDirty:', this.isDirty);

    if (!this.isDirty) {
      console.log('[SettingsUI] Skipping save - isDirty is false');
      return;
    }

    try {
      // Collect all form values
      const updates = this.collectFormValues();
      console.log('[SettingsUI] Collected form values:', updates);

      // Save via SettingsManager
      await this.settingsManager.updateSettings(updates);

      this.isDirty = false;
      this.updateSaveButton();
      this.showStatus('Settings saved successfully!', 'success');
      console.log('[SettingsUI] Settings saved:', updates);
    } catch (error) {
      this.showStatus(`Error: ${error}`, 'error');
      console.error('[SettingsUI] Save failed:', error);
    }
  }

  /**
   * Collect form values into partial settings object
   */
  private collectFormValues(): Partial<GlobalSettings> {
    const getValue = (id: string): string => (document.getElementById(id) as HTMLInputElement)?.value || '';
    const getChecked = (id: string): boolean => (document.getElementById(id) as HTMLInputElement)?.checked || false;
    const getNumber = (id: string): number => parseInt(getValue(id), 10) || 0;

    // Get language from selected radio button to ensure correct format ('en-US'/'zh-CN')
    const getSelectedLanguage = (): 'zh-CN' | 'en-US' => {
      const langRadio = document.querySelector('input[name="language"]:checked') as HTMLInputElement;
      return (langRadio?.value as 'zh-CN' | 'en-US') || 'en-US';
    };

    // Get theme from selected radio button
    const getSelectedTheme = (): string => {
      const themeRadio = document.querySelector('input[name="theme"]:checked') as HTMLInputElement;
      return themeRadio?.value || 'light';
    };

    return {
      backend_url: getValue('backend-url') || this.currentSettings.backend_url,
      api_key: getValue('api-key') || this.currentSettings.api_key,
      websocket_url: getValue('websocket-url') || undefined,
      websocket_key: getValue('websocket-key') || undefined,
      user_name: getValue('user-name') || this.currentSettings.user_name,
      user_avatar: getValue('user-avatar') || this.currentSettings.user_avatar,
      theme: getSelectedTheme(),
      language: getSelectedLanguage(),
      window_preferences: {
        ...this.currentSettings.window_preferences,
        always_on_top: getChecked('always-on-top'),
        transparency: getNumber('transparency') / 100,  // Convert percentage to decimal (50-100 → 0.5-1.0)
        startup_behavior: getValue('startup-behavior') as any
      },
      sidebar_widths: {
        agents_list: getNumber('agents-width'),
        notifications: getNumber('notifications-width')
      },
      streaming_preferences: {
        ...this.currentSettings.streaming_preferences,
        smooth_streaming: getChecked('smooth-streaming'),
        chunk_delay_ms: getNumber('chunk-delay'),
        enable_morphdom: getChecked('enable-morphdom')
      }
    };
  }

  /**
   * Handle reset button click
   */
  private async handleReset(): Promise<void> {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      await this.settingsManager.resetToDefaults();
      this.currentSettings = this.settingsManager.getSettings();
      this.isDirty = false;
      this.renderTabContent();
      this.showStatus('Settings reset to defaults', 'success');
      console.log('[SettingsUI] Settings reset to defaults');
    } catch (error) {
      this.showStatus(`Error: ${error}`, 'error');
      console.error('[SettingsUI] Reset failed:', error);
    }
  }

  /**
   * Show status message
   */
  private showStatus(message: string, type: 'success' | 'error'): void {
    const statusElem = this.modalElement?.querySelector('.settings-status');
    if (!statusElem) return;

    statusElem.textContent = message;
    statusElem.className = `settings-status ${type}`;

    setTimeout(() => {
      statusElem.textContent = '';
      statusElem.className = 'settings-status';
    }, 3000);
  }

  /**
   * Handle close button click
   */
  private handleClose(): void {
    if (this.isDirty) {
      if (!confirm('You have unsaved changes. Close without saving?')) {
        return;
      }
    }
    this.hide();
  }

  /**
   * Handle keyboard events
   */
  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.modalElement) return;

    if (e.key === 'Escape') {
      this.handleClose();
    }
  };

  /**
   * Focus first input field
   */
  private focusFirstInput(): void {
    const firstInput = this.modalElement?.querySelector('input, textarea, select') as HTMLElement;
    firstInput?.focus();
  }

  /**
   * Cleanup (remove event listeners)
   */
  public cleanup(): void {
    document.removeEventListener('keydown', this.handleKeydown);
    this.hide();
  }
}

/**
 * Initialize SettingsUI and export singleton instance
 */
export function initSettingsUI(): SettingsUI {
  return SettingsUI.getInstance();
}

/**
 * Global keyboard shortcut for opening settings (Ctrl+,)
 */
export function registerSettingsShortcut(): void {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      SettingsUI.getInstance().show();
    }
  });
  console.log('[SettingsUI] Registered global shortcut: Ctrl+,');
}
