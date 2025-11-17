/**
 * WindowControls Component (US5-011, US5-012, US5-013)
 *
 * Provides window control buttons and quick settings:
 * - Minimize, Maximize, Close buttons
 * - Always-on-top toggle
 * - Transparency slider with live preview
 */

import {
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  setWindowAlwaysOnTop,
  setWindowTransparency
} from '../core/ipc/commands';
import { readSettings, writeSettings } from '../core/ipc/commands';
import { GlobalSettings } from '../core/models/settings';
import { t } from '../core/i18n/i18nHelper';

export class WindowControls {
  private container: HTMLElement;
  private settings: GlobalSettings | null = null;
  private transparencySlider: HTMLInputElement | null = null;
  private alwaysOnTopBtn: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.render();
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await readSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Render window controls
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="window-controls">
        <!-- Always on Top Toggle -->
        <button
          type="button"
          class="window-control-btn ${this.settings?.window_preferences.always_on_top ? 'active' : ''}"
          id="always-on-top-btn"
          title="${t('windowControls.alwaysOnTop')}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Transparency Slider Toggle -->
        <button
          type="button"
          class="window-control-btn"
          id="transparency-toggle-btn"
          title="${t('windowControls.transparency')}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Transparency Slider Panel (hidden by default) -->
        <div class="transparency-panel" id="transparency-panel" style="display: none;">
          <div class="transparency-header">
            <span>${t('windowControls.transparencyLabel')}</span>
            <span class="transparency-value" id="transparency-value">${Math.round((this.settings?.window_preferences.transparency || 1) * 100)}%</span>
          </div>
          <input
            type="range"
            id="transparency-slider"
            class="transparency-slider"
            min="20"
            max="100"
            step="5"
            value="${Math.round((this.settings?.window_preferences.transparency || 1) * 100)}"
          />
        </div>

        <!-- Minimize Button -->
        <button
          type="button"
          class="window-control-btn"
          id="minimize-btn"
          title="${t('windowControls.minimize')}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="5" y1="12" x2="19" y2="12" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Maximize Button -->
        <button
          type="button"
          class="window-control-btn"
          id="maximize-btn"
          title="${t('windowControls.maximize')}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
          </svg>
        </button>

        <!-- Close Button -->
        <button
          type="button"
          class="window-control-btn window-control-close"
          id="close-btn"
          title="${t('windowControls.close')}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18" stroke-width="2" stroke-linecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Always on top toggle
    this.alwaysOnTopBtn = this.container.querySelector('#always-on-top-btn');
    this.alwaysOnTopBtn?.addEventListener('click', () => this.toggleAlwaysOnTop());

    // Transparency toggle button
    const transparencyToggleBtn = this.container.querySelector('#transparency-toggle-btn');
    transparencyToggleBtn?.addEventListener('click', () => this.toggleTransparencyPanel());

    // Transparency slider
    this.transparencySlider = this.container.querySelector('#transparency-slider');
    const transparencyValue = this.container.querySelector('#transparency-value');

    this.transparencySlider?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (transparencyValue) {
        transparencyValue.textContent = `${value}%`;
      }
    });

    this.transparencySlider?.addEventListener('change', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value) / 100;
      this.applyTransparency(value);
    });

    // Minimize button
    const minimizeBtn = this.container.querySelector('#minimize-btn');
    minimizeBtn?.addEventListener('click', () => this.minimize());

    // Maximize button
    const maximizeBtn = this.container.querySelector('#maximize-btn');
    maximizeBtn?.addEventListener('click', () => this.maximize());

    // Close button
    const closeBtn = this.container.querySelector('#close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Close transparency panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = this.container.querySelector('#transparency-panel');
      const toggleBtn = this.container.querySelector('#transparency-toggle-btn');

      if (panel && panel.style.display !== 'none') {
        if (!panel.contains(e.target as Node) && !toggleBtn?.contains(e.target as Node)) {
          panel.style.display = 'none';
        }
      }
    });
  }

  /**
   * Toggle always on top
   */
  private async toggleAlwaysOnTop(): Promise<void> {
    if (!this.settings) return;

    const newValue = !this.settings.window_preferences.always_on_top;

    try {
      await setWindowAlwaysOnTop(newValue);

      // Update settings
      this.settings.window_preferences.always_on_top = newValue;
      await writeSettings(this.settings);

      // Update button state
      if (this.alwaysOnTopBtn) {
        if (newValue) {
          this.alwaysOnTopBtn.classList.add('active');
        } else {
          this.alwaysOnTopBtn.classList.remove('active');
        }
      }

      this.showFeedback(t('windowControls.alwaysOnTopToggled'));
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
      this.showFeedback(t('windowControls.error'), 'error');
    }
  }

  /**
   * Toggle transparency panel
   */
  private toggleTransparencyPanel(): void {
    const panel = this.container.querySelector('#transparency-panel') as HTMLElement;

    if (panel) {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    }
  }

  /**
   * Apply transparency
   */
  private async applyTransparency(value: number): Promise<void> {
    if (!this.settings) return;

    try {
      await setWindowTransparency(value);

      // Update settings
      this.settings.window_preferences.transparency = value;
      await writeSettings(this.settings);

      this.showFeedback(t('windowControls.transparencyApplied'));
    } catch (error) {
      console.error('Failed to apply transparency:', error);
      this.showFeedback(t('windowControls.error'), 'error');
    }
  }

  /**
   * Minimize window
   */
  private async minimize(): Promise<void> {
    try {
      await minimizeWindow();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  }

  /**
   * Maximize window
   */
  private async maximize(): Promise<void> {
    try {
      await maximizeWindow();
    } catch (error) {
      console.error('Failed to maximize window:', error);
    }
  }

  /**
   * Close window
   */
  private async close(): Promise<void> {
    try {
      await closeWindow();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }

  /**
   * Show feedback message
   */
  private showFeedback(message: string, type: 'success' | 'error' = 'success'): void {
    const feedback = document.createElement('div');
    feedback.className = `window-control-feedback feedback-${type}`;
    feedback.textContent = message;

    this.container.appendChild(feedback);

    setTimeout(() => feedback.remove(), 2000);
  }
}
