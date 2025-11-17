/**
 * i18n Manager (CORE-068)
 *
 * Internationalization framework for VCPChat
 * Supports Chinese and English with dynamic language switching
 *
 * Features:
 * - Simple translation key lookup with nested object support
 * - Dynamic language switching with localStorage persistence
 * - Event-driven language change notifications
 * - Fallback to English if translation key missing
 * - Template string interpolation
 *
 * Usage:
 * ```typescript
 * import { I18nManager, t } from '@core/i18n/i18nManager';
 *
 * // Get translation
 * const greeting = t('common.greeting'); // "Hello" or "你好"
 *
 * // With interpolation
 * const welcome = t('common.welcome', { name: 'Alice' }); // "Welcome, Alice!"
 *
 * // Change language
 * const i18n = I18nManager.getInstance();
 * i18n.setLanguage('zh'); // Switch to Chinese
 *
 * // Listen to language changes
 * window.addEventListener('language-changed', (e: CustomEvent) => {
 *   console.log('New language:', e.detail.language);
 * });
 * ```
 */

import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';

/**
 * Supported languages
 */
export enum Language {
  EN_US = 'en',
  ZH_CN = 'zh'
}

/**
 * Translation dictionary type
 */
export type TranslationDict = Record<string, any>;

/**
 * Interpolation parameters
 */
export type InterpolationParams = Record<string, string | number>;

/**
 * i18n Manager Singleton
 * Handles all translation logic and language switching
 */
export class I18nManager {
  private static instance: I18nManager;
  private currentLanguage: Language;
  private translations: Map<Language, TranslationDict>;
  private readonly STORAGE_KEY = 'vcpchat-language';

  private constructor() {
    // Load translations
    this.translations = new Map([
      [Language.EN_US, enUS],
      [Language.ZH_CN, zhCN]
    ]);

    // Load saved language from localStorage or use system default
    const savedLanguage = this.loadSavedLanguage();
    this.currentLanguage = savedLanguage || this.getSystemLanguage();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }

  /**
   * Get current language
   */
  public getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set current language and notify listeners
   */
  public setLanguage(language: Language): void {
    if (!this.translations.has(language)) {
      console.warn(`Language "${language}" not supported, falling back to English`);
      language = Language.EN_US;
    }

    const oldLanguage = this.currentLanguage;
    this.currentLanguage = language;

    // Save to localStorage
    localStorage.setItem(this.STORAGE_KEY, language);

    // Update HTML lang attribute
    const langCode = language === Language.ZH_CN ? 'zh-CN' : 'en-US';
    document.documentElement.setAttribute('lang', langCode);

    // Update font family based on language
    // English: Georgia serif (warm, professional)
    // Chinese: Microsoft YaHei (clear, readable)
    if (language === Language.EN_US) {
      document.documentElement.style.setProperty('--font-body',
        'Georgia, "Times New Roman", Times, serif');
    } else {
      document.documentElement.style.setProperty('--font-body',
        '"Microsoft YaHei", Georgia, "Times New Roman", Times, serif');
    }

    console.log(`[I18n] Language changed to: ${language} (${langCode})`);

    // Emit language change event
    if (oldLanguage !== language) {
      this.emitLanguageChanged(language);
    }
  }

  /**
   * Get translation for a key
   * Supports nested keys with dot notation: "common.greeting"
   */
  public translate(key: string, params?: InterpolationParams): string {
    const translation = this.getNestedValue(
      this.translations.get(this.currentLanguage)!,
      key
    );

    if (translation === undefined) {
      // Fallback to English
      const fallback = this.getNestedValue(
        this.translations.get(Language.EN_US)!,
        key
      );

      if (fallback === undefined) {
        console.warn(`Translation key "${key}" not found in any language`);
        return key; // Return key itself as last resort
      }

      return this.interpolate(fallback, params);
    }

    return this.interpolate(translation, params);
  }

  /**
   * Get nested value from object using dot notation
   * Example: getNestedValue({ common: { greeting: "Hello" } }, "common.greeting") => "Hello"
   */
  private getNestedValue(obj: any, key: string): string | undefined {
    const keys = key.split('.');
    let current = obj;

    for (const k of keys) {
      if (current === undefined || current[k] === undefined) {
        return undefined;
      }
      current = current[k];
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Interpolate template string with parameters
   * Example: interpolate("Hello, {name}!", { name: "Alice" }) => "Hello, Alice!"
   */
  private interpolate(template: string, params?: InterpolationParams): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Load saved language from localStorage
   */
  private loadSavedLanguage(): Language | null {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved && Object.values(Language).includes(saved as Language)) {
      return saved as Language;
    }
    return null;
  }

  /**
   * Detect system language from browser
   */
  private getSystemLanguage(): Language {
    const systemLang = navigator.language.toLowerCase();

    if (systemLang.startsWith('zh')) {
      return Language.ZH_CN;
    }

    return Language.EN_US;
  }

  /**
   * Emit language changed event
   */
  private emitLanguageChanged(language: Language): void {
    const event = new CustomEvent('language-changed', {
      detail: { language }
    });
    window.dispatchEvent(event);

    console.log(`[i18n] Language changed to: ${language}`);
  }

  /**
   * Get all available languages
   */
  public getAvailableLanguages(): Language[] {
    return Array.from(this.translations.keys());
  }

  /**
   * Check if a language is supported
   */
  public isLanguageSupported(language: string): boolean {
    return this.translations.has(language as Language);
  }
}

/**
 * Convenience function for translations
 * Usage: t('common.greeting')
 */
export function t(key: string, params?: InterpolationParams): string {
  return I18nManager.getInstance().translate(key, params);
}

/**
 * Initialize i18n manager
 * Call this on app startup
 */
export function initI18n(): I18nManager {
  const i18n = I18nManager.getInstance();
  console.log(`[i18n] Initialized with language: ${i18n.getLanguage()}`);
  return i18n;
}
