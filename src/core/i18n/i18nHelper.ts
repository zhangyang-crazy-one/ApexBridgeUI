/**
 * i18n Helper - Applies translations to DOM elements
 * Automatically detects and applies translations based on data-i18n attributes
 */

import type { Language, Translations } from './translations';
import { getTranslations, t as translate } from './translations';

let currentLanguage: Language = 'zh-CN'; // Default to Chinese

/**
 * Initialize i18n system with language from settings
 */
export function initI18n(language: Language) {
  currentLanguage = language;
  applyTranslations();
  console.log(`[i18n] Initialized with language: ${language}`);
}

/**
 * Change language and re-apply translations
 */
export function changeLanguage(language: Language) {
  currentLanguage = language;
  applyTranslations();
  console.log(`[i18n] Language changed to: ${language}`);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Translate a key to current language
 */
export function t(key: keyof Translations): string {
  return translate(currentLanguage, key);
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
export function applyTranslations() {
  const trans = getTranslations(currentLanguage);

  // Translate text content (data-i18n="key")
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n') as keyof Translations;
    if (key && trans[key]) {
      element.textContent = trans[key];
    }
  });

  // Translate placeholders (data-i18n-placeholder="key")
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder') as keyof Translations;
    if (key && trans[key]) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.placeholder = trans[key];
      }
    }
  });

  // Translate titles (data-i18n-title="key")
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title') as keyof Translations;
    if (key && trans[key]) {
      element.setAttribute('title', trans[key]);
    }
  });

  // Update HTML lang attribute
  document.documentElement.lang = currentLanguage;

  // Update document title
  document.title = currentLanguage === 'zh-CN' ? 'VCPChat - AI助手' : 'VCPChat - AI Assistant';

  console.log('[i18n] Applied translations to DOM');
}

/**
 * Get formatted time string
 */
export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);

  if (diffMinutes < 1) {
    return t('time_now');
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${t('time_minutes_ago')}`;
  } else if (diffHours < 24) {
    return `${diffHours} ${t('time_hours_ago')}`;
  } else if (diffDays < 7) {
    return `${diffDays} ${t('time_days_ago')}`;
  } else {
    return `${diffWeeks} ${t('time_weeks_ago')}`;
  }
}

/**
 * Format character count
 */
export function formatCharCount(count: number): string {
  return `${count} ${t('char_count')}`;
}
