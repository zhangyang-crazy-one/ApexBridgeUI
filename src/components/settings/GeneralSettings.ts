/**
 * GeneralSettings Tab Component (US5-002)
 *
 * Provides user interface for general settings:
 * - User name
 * - User avatar upload
 * - Theme selector
 * - Language switcher (中文/English) - CRITICAL FEATURE added 2025-10-28
 */

import { GlobalSettings } from '../../core/models/settings';
import { t } from '../../core/i18n/i18nManager';

export class GeneralSettings {
  private container: HTMLElement;
  private settings: GlobalSettings;
  private avatarPreview: HTMLImageElement | null = null;

  constructor(container: HTMLElement, settings: GlobalSettings) {
    this.container = container;
    this.settings = settings;
    this.render();
  }

  /**
   * Render the general settings tab
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="settings-section">
        <h3>${t('settings.general.userInfo')}</h3>

        <!-- User Name -->
        <div class="settings-field">
          <label for="user-name">${t('settings.general.userName')}</label>
          <input
            type="text"
            id="user-name"
            value="${this.settings.user_name}"
            placeholder="${t('settings.general.userNamePlaceholder')}"
            maxlength="50"
          />
          <p class="field-description">${t('settings.general.userNameHint')}</p>
        </div>

        <!-- User Avatar -->
        <div class="settings-field">
          <label>${t('settings.general.userAvatar')}</label>
          <div class="avatar-upload">
            <img
              id="avatar-preview"
              src="${this.settings.user_avatar}"
              alt="User avatar"
              class="avatar-preview"
            />
            <button type="button" class="btn-secondary" id="upload-avatar-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${t('settings.general.uploadAvatar')}
            </button>
          </div>
          <p class="field-description">${t('settings.general.avatarHint')}</p>
        </div>
      </div>

      <div class="settings-section">
        <h3>${t('settings.general.appearance')}</h3>

        <!-- Theme Selector -->
        <div class="settings-field">
          <label for="theme-select">${t('settings.general.theme')}</label>
          <select id="theme-select">
            <option value="claude-light" ${this.settings.theme === 'claude-light' ? 'selected' : ''}>
              ${t('settings.general.themes.claudeLight')}
            </option>
            <option value="claude-dark" ${this.settings.theme === 'claude-dark' ? 'selected' : ''}>
              ${t('settings.general.themes.claudeDark')}
            </option>
            <option value="classic" ${this.settings.theme === 'classic' ? 'selected' : ''}>
              ${t('settings.general.themes.classic')}
            </option>
            <option value="high-contrast" ${this.settings.theme === 'high-contrast' ? 'selected' : ''}>
              ${t('settings.general.themes.highContrast')}
            </option>
          </select>
          <p class="field-description">${t('settings.general.themeHint')}</p>
        </div>

        <!-- Language Switcher (CRITICAL - User requirement added 2025-10-28) -->
        <div class="settings-field">
          <label for="language-select">${t('settings.general.language')}</label>
          <div class="language-switcher">
            <select id="language-select">
              <option value="zh-CN" ${this.settings.language === 'zh-CN' ? 'selected' : ''}>
                🇨🇳 中文 (简体)
              </option>
              <option value="en-US" ${this.settings.language === 'en-US' ? 'selected' : ''}>
                🇺🇸 English (US)
              </option>
            </select>
          </div>
          <p class="field-description">${t('settings.general.languageHint')}</p>

          <!-- Language switch warning -->
          <div class="language-warning" style="display: none;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B35">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke-width="2"/>
              <path d="M12 9v4M12 17h.01" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>${t('settings.general.languageRestartWarning')}</span>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Avatar upload button
    const uploadBtn = this.container.querySelector('#upload-avatar-btn');
    uploadBtn?.addEventListener('click', () => this.handleAvatarUpload());

    // Avatar preview
    this.avatarPreview = this.container.querySelector('#avatar-preview');

    // Language selector - show warning on change
    const languageSelect = this.container.querySelector('#language-select') as HTMLSelectElement;
    const languageWarning = this.container.querySelector('.language-warning') as HTMLElement;

    languageSelect?.addEventListener('change', () => {
      if (languageSelect.value !== this.settings.language) {
        languageWarning.style.display = 'flex';
      } else {
        languageWarning.style.display = 'none';
      }
    });

    // Theme selector - apply live preview
    const themeSelect = this.container.querySelector('#theme-select') as HTMLSelectElement;
    themeSelect?.addEventListener('change', () => {
      this.previewTheme(themeSelect.value);
    });
  }

  /**
   * Handle avatar upload
   */
  private async handleAvatarUpload(): Promise<void> {
    // Check if running in Tauri environment
    if (typeof (window as any).__TAURI__ === 'undefined') {
      console.warn('[GeneralSettings] Avatar upload requires Tauri desktop app');
      this.showFeedback('Avatar upload is only available in the desktop app. In browser mode, you can use a URL or default avatar.', 'error');
      return;
    }

    try {
      console.log('[GeneralSettings] Starting avatar upload...');

      // Import Tauri v2 plugin APIs
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { copyFile, BaseDirectory, exists, create } = await import('@tauri-apps/plugin-fs');
      const { basename, appDataDir, join } = await import('@tauri-apps/api/path');

      console.log('[GeneralSettings] Tauri APIs imported successfully');

      // Use Tauri dialog API to select image file
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
        }]
      });

      console.log('[GeneralSettings] File selected:', selected);

      if (!selected || typeof selected !== 'string') {
        console.log('[GeneralSettings] No file selected or invalid selection');
        return;
      }

      // Get filename from selected path
      const filename = await basename(selected);
      console.log('[GeneralSettings] Filename:', filename);

      // Create avatars directory if it doesn't exist
      const appData = await appDataDir();
      const avatarsDir = await join(appData, 'assets', 'avatars');
      console.log('[GeneralSettings] Avatars directory path:', avatarsDir);

      // Check if directory exists, create if not
      const dirExists = await exists(avatarsDir);
      if (!dirExists) {
        console.log('[GeneralSettings] Creating avatars directory...');
        await create(avatarsDir, { recursive: true });
      }

      // Destination path
      const destPath = await join(avatarsDir, filename);
      console.log('[GeneralSettings] Destination path:', destPath);

      // Copy file to AppData/assets/avatars/
      await copyFile(selected, destPath);
      console.log('[GeneralSettings] File copied successfully');

      // Update preview with relative path for display
      const relativePath = `assets/avatars/${filename}`;
      console.log('[GeneralSettings] Updating preview with path:', relativePath);

      if (this.avatarPreview) {
        // Convert path for preview (Tauri will handle asset protocol)
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        this.avatarPreview.src = convertFileSrc(destPath);

        // Store relative path for settings
        this.avatarPreview.dataset.avatarPath = relativePath;
      }

      // Show success feedback
      this.showFeedback(t('settings.general.avatarUploadSuccess'), 'success');
      console.log('[GeneralSettings] ✅ Avatar upload completed successfully');

    } catch (error) {
      console.error('[GeneralSettings] ❌ Avatar upload failed:', error);
      this.showFeedback(t('settings.general.avatarUploadError'), 'error');
    }
  }

  /**
   * Preview theme changes (live preview without saving)
   */
  private previewTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Show feedback message
   */
  private showFeedback(message: string, type: 'success' | 'error'): void {
    const feedback = document.createElement('div');
    feedback.className = `feedback-message feedback-${type}`;
    feedback.textContent = message;

    this.container.appendChild(feedback);

    setTimeout(() => feedback.remove(), 3000);
  }

  /**
   * Get updated settings from form
   */
  public getSettings(): Partial<GlobalSettings> {
    const userNameInput = this.container.querySelector('#user-name') as HTMLInputElement;
    const themeSelect = this.container.querySelector('#theme-select') as HTMLSelectElement;
    const languageSelect = this.container.querySelector('#language-select') as HTMLSelectElement;
    const avatarPreview = this.container.querySelector('#avatar-preview') as HTMLImageElement;

    // Get avatar path from dataset (set during upload) or fallback to src
    const avatarPath = avatarPreview.dataset.avatarPath || avatarPreview.src;

    return {
      user_name: userNameInput.value.trim(),
      theme: themeSelect.value,
      language: languageSelect.value as 'zh-CN' | 'en-US',
      user_avatar: avatarPath
    };
  }
}
