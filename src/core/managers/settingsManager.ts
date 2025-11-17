/**
 * SettingsManager (CORE-057)
 *
 * Global Settings Manager with Persistence
 *
 * Responsibilities:
 * - Load and save global application settings
 * - Validate settings before persistence
 * - Provide hot-reload notifications via events
 * - Manage user preferences, theme, language, backend config
 * - Persist to Tauri backend + localStorage fallback
 * - Singleton pattern for centralized access
 *
 * Features:
 * - Dual persistence (Tauri backend + localStorage)
 * - Settings validation with error reporting
 * - Event-driven hot reload (settings-changed event)
 * - Deep merge for partial updates
 * - Rollback support on validation failure
 * - Default settings fallback
 * - Type-safe settings access
 * - Window preferences application
 * - Sidebar widths application
 * - Keyboard shortcuts management
 */

import { GlobalSettings, getDefaultSettings, validateSettings } from '../models/settings';
import { readSettings, writeSettings, setWindowAlwaysOnTop, setWindowTransparency } from '../ipc/commands';
import { I18nManager, Language } from '../i18n/i18nManager';

export type PartialSettings = Partial<GlobalSettings>;

export interface SettingsChangedEvent {
  settings: GlobalSettings;
  previousSettings: GlobalSettings;
  changedKeys: string[];
}

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: GlobalSettings;
  private previousSettings: GlobalSettings;

  private constructor() {
    this.settings = getDefaultSettings();
    this.previousSettings = getDefaultSettings();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  public async loadSettings(): Promise<GlobalSettings> {
    try {
      const tauriSettings = await readSettings();
      if (tauriSettings && Object.keys(tauriSettings).length > 0) {
        this.settings = this.mergeWithDefaults(tauriSettings);
        console.log('[SettingsManager] Loaded from Tauri');
        return this.settings;
      }
    } catch (error) {
      console.warn('[SettingsManager] Tauri load failed:', error);
    }

    try {
      const localData = localStorage.getItem('vcpchat-settings');
      if (localData) {
        this.settings = this.mergeWithDefaults(JSON.parse(localData));
        console.log('[SettingsManager] Loaded from localStorage');
        return this.settings;
      }
    } catch (error) {
      console.warn('[SettingsManager] localStorage load failed:', error);
    }

    this.settings = getDefaultSettings();
    console.log('[SettingsManager] Using defaults');
    return this.settings;
  }

  public getSettings(): Readonly<GlobalSettings> {
    return { ...this.settings };
  }

  public async updateSettings(updates: PartialSettings): Promise<GlobalSettings> {
    this.previousSettings = { ...this.settings };
    const newSettings = this.deepMerge(this.settings, updates);

    const error = validateSettings(newSettings);
    if (error) throw new Error(`Validation failed: ${error}`);

    this.settings = newSettings;
    await this.persistSettings();

    const changedKeys = this.getChangedKeys(this.previousSettings, newSettings);
    await this.applySettings(changedKeys);
    this.dispatchEvent(changedKeys);

    console.log('[SettingsManager] Updated:', changedKeys);
    return this.settings;
  }

  public async resetToDefaults(): Promise<GlobalSettings> {
    this.previousSettings = { ...this.settings };
    this.settings = getDefaultSettings();
    await this.persistSettings();
    await this.applyAllSettings();
    this.dispatchEvent(Object.keys(this.settings));
    return this.settings;
  }

  private async persistSettings(): Promise<void> {
    // Try Tauri backend first (will fail silently in browser mode)
    try {
      await writeSettings(this.settings);
      console.log('[SettingsManager] Saved to Tauri backend');
    } catch (error) {
      console.warn('[SettingsManager] Tauri save failed (expected in browser mode):', error);
    }

    // Always save to localStorage as fallback/primary storage in browser mode
    try {
      localStorage.setItem('vcpchat-settings', JSON.stringify(this.settings));
      console.log('[SettingsManager] Saved to localStorage');
    } catch (error) {
      console.error('[SettingsManager] localStorage save failed:', error);
    }
  }

  private async applySettings(changedKeys: string[]): Promise<void> {
    if (changedKeys.includes('window_preferences')) await this.applyWindowPreferences();
    if (changedKeys.includes('sidebar_widths')) this.applySidebarWidths();
    if (changedKeys.includes('keyboard_shortcuts')) this.applyKeyboardShortcuts();
    if (changedKeys.includes('theme')) this.applyTheme();
    if (changedKeys.includes('language')) this.applyLanguage();
  }

  public async applyAllSettings(): Promise<void> {
    await this.applyWindowPreferences();
    this.applySidebarWidths();
    this.applyKeyboardShortcuts();
    this.applyTheme();
    this.applyLanguage();
  }

  private async applyWindowPreferences(): Promise<void> {
    const prefs = this.settings.window_preferences;
    try {
      await setWindowAlwaysOnTop(prefs.always_on_top);
      await setWindowTransparency(prefs.transparency);
    } catch (error) {
      console.error('[SettingsManager] Window prefs apply failed:', error);
    }
  }

  private applySidebarWidths(): void {
    const widths = this.settings.sidebar_widths;
    document.documentElement.style.setProperty('--sidebar-agents-width', `${widths.agents_list}px`);
    document.documentElement.style.setProperty('--sidebar-notifications-width', `${widths.notifications}px`);
  }

  private applyKeyboardShortcuts(): void {
    // Simplified: shortcuts handled by input-area.ts
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
  }

  private applyLanguage(): void {
    // Convert settings language format to i18n Language enum
    // settings.language: 'zh-CN' | 'en-US'
    // i18n Language enum: 'zh' | 'en'
    const i18nLang = this.settings.language === 'zh-CN' ? Language.ZH_CN : Language.EN_US;

    // Trigger i18n manager to update translations and emit language-changed event
    I18nManager.getInstance().setLanguage(i18nLang);

    console.log(`[SettingsManager] Applied language: ${this.settings.language} -> i18n: ${i18nLang}`);
  }

  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];
        if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
            targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
          result[key] = this.deepMerge(targetValue, sourceValue as any) as any;
        } else {
          result[key] = sourceValue as any;
        }
      }
    }
    return result;
  }

  private mergeWithDefaults(settings: GlobalSettings): GlobalSettings {
    return this.deepMerge(getDefaultSettings(), settings);
  }

  private getChangedKeys(prev: GlobalSettings, current: GlobalSettings): string[] {
    const changed: string[] = [];
    for (const key in current) {
      if (JSON.stringify(prev[key as keyof GlobalSettings]) !== JSON.stringify(current[key as keyof GlobalSettings])) {
        changed.push(key);
      }
    }
    return changed;
  }

  private dispatchEvent(changedKeys: string[]): void {
    window.dispatchEvent(new CustomEvent<SettingsChangedEvent>('settings-changed', {
      detail: { settings: this.settings, previousSettings: this.previousSettings, changedKeys }
    }));
  }
}

export async function initSettingsManager(): Promise<SettingsManager> {
  const manager = SettingsManager.getInstance();
  await manager.loadSettings();
  await manager.applyAllSettings();
  console.log('[SettingsManager] Initialized');
  return manager;
}

// Export singleton instance for direct access
export const settingsManager = SettingsManager.getInstance();
