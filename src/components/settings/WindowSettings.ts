/**
 * WindowSettings Tab Component (US5-004)
 *
 * Provides configuration for window behavior:
 * - Always on top toggle
 * - Transparency slider
 * - Startup behavior (normal/minimized/hidden)
 * - Window size (width/height)
 */

import { GlobalSettings, WindowPreferences } from '../../core/models/settings';
import { t } from '../../core/i18n/i18nManager';
import {
  setWindowAlwaysOnTop,
  setWindowTransparency,
  minimizeWindow,
  maximizeWindow
} from '../../core/ipc/commands';

export class WindowSettings {
  private container: HTMLElement;
  private settings: GlobalSettings;

  constructor(container: HTMLElement, settings: GlobalSettings) {
    this.container = container;
    this.settings = settings;
    this.render();
  }

  /**
   * Render the window settings tab
   */
  private render(): void {
    const prefs = this.settings.window_preferences;

    this.container.innerHTML = `
      <div class="settings-section">
        <h3>${t('settings.window.windowBehavior')}</h3>

        <!-- Always on Top -->
        <div class="settings-field">
          <div class="settings-row">
            <label for="always-on-top" class="toggle-text-label">${t('settings.window.alwaysOnTop')}</label>
            <div class="toggle-switch-container">
              <input
                type="checkbox"
                id="always-on-top"
                ${prefs.always_on_top ? 'checked' : ''}
              />
              <label class="toggle-slider" for="always-on-top"></label>
            </div>
          </div>
          <p class="settings-field-description">${t('settings.window.alwaysOnTopHint')}</p>
        </div>

        <!-- Transparency -->
        <div class="settings-field">
          <label for="transparency-slider">${t('settings.window.transparency')}</label>
          <div class="slider-with-value">
            <input
              type="range"
              id="transparency-slider"
              min="0"
              max="100"
              step="5"
              value="${Math.round(prefs.transparency * 100)}"
            />
            <span class="slider-value">${Math.round(prefs.transparency * 100)}%</span>
          </div>
          <p class="settings-field-description">${t('settings.window.transparencyHint')}</p>

          <!-- Live Preview Button -->
          <button type="button" class="btn-secondary" id="preview-transparency-btn">
            ${t('settings.window.previewTransparency')}
          </button>
        </div>

        <!-- Startup Behavior -->
        <div class="settings-field">
          <label for="startup-behavior">${t('settings.window.startupBehavior')}</label>
          <select id="startup-behavior">
            <option value="normal" ${prefs.startup_behavior === 'normal' ? 'selected' : ''}>
              ${t('settings.window.startupNormal')}
            </option>
            <option value="minimized" ${prefs.startup_behavior === 'minimized' ? 'selected' : ''}>
              ${t('settings.window.startupMinimized')}
            </option>
            <option value="hidden" ${prefs.startup_behavior === 'hidden' ? 'selected' : ''}>
              ${t('settings.window.startupHidden')}
            </option>
          </select>
          <p class="settings-field-description">${t('settings.window.startupBehaviorHint')}</p>
        </div>
      </div>

      <div class="settings-section">
        <h3>${t('settings.window.windowSize')}</h3>

        <!-- Width -->
        <div class="settings-field">
          <label for="window-width">${t('settings.window.width')}</label>
          <div class="input-with-unit">
            <input
              type="number"
              id="window-width"
              value="${prefs.width}"
              min="800"
              max="3840"
              step="10"
            />
            <span class="input-unit">px</span>
          </div>
          <p class="settings-field-description">${t('settings.window.widthHint')}</p>
        </div>

        <!-- Height -->
        <div class="settings-field">
          <label for="window-height">${t('settings.window.height')}</label>
          <div class="input-with-unit">
            <input
              type="number"
              id="window-height"
              value="${prefs.height}"
              min="600"
              max="2160"
              step="10"
            />
            <span class="input-unit">px</span>
          </div>
          <p class="settings-field-description">${t('settings.window.heightHint')}</p>
        </div>

        <!-- Quick Size Presets -->
        <div class="settings-field">
          <label>${t('settings.window.quickPresets')}</label>
          <div class="button-group">
            <button type="button" class="btn btn-secondary" data-preset="1280x720">
              HD (1280×720)
            </button>
            <button type="button" class="btn btn-secondary" data-preset="1920x1080">
              Full HD (1920×1080)
            </button>
            <button type="button" class="btn btn-secondary" data-preset="2560x1440">
              2K (2560×1440)
            </button>
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
    // Transparency slider - update value display
    const transparencySlider = this.container.querySelector('#transparency-slider') as HTMLInputElement;
    const sliderValue = this.container.querySelector('.slider-value');

    transparencySlider?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (sliderValue) {
        sliderValue.textContent = `${value}%`;
      }
    });

    // Preview transparency button
    const previewBtn = this.container.querySelector('#preview-transparency-btn');
    previewBtn?.addEventListener('click', () => this.previewTransparency());

    // Always on top toggle - apply immediately
    const alwaysOnTopCheckbox = this.container.querySelector('#always-on-top') as HTMLInputElement;
    alwaysOnTopCheckbox?.addEventListener('change', async (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      try {
        await setWindowAlwaysOnTop(isChecked);
        this.showFeedback(t('settings.window.applied'), 'success');
      } catch (error) {
        console.error('Failed to set always on top:', error);
        this.showFeedback(t('settings.window.applyError'), 'error');
      }
    });

    // Quick size presets
    const presetBtns = this.container.querySelectorAll('[data-preset]');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = (e.currentTarget as HTMLElement).dataset.preset;
        if (preset) {
          this.applyPreset(preset);
        }
      });
    });
  }

  /**
   * Preview transparency setting
   */
  private async previewTransparency(): Promise<void> {
    const transparencySlider = this.container.querySelector('#transparency-slider') as HTMLInputElement;
    const value = parseFloat(transparencySlider.value) / 100;

    try {
      await setWindowTransparency(value);
      this.showFeedback(t('settings.window.transparencyPreview'), 'success');
    } catch (error) {
      console.error('Failed to preview transparency:', error);
      this.showFeedback(t('settings.window.previewError'), 'error');
    }
  }

  /**
   * Apply size preset
   */
  private applyPreset(preset: string): void {
    const [width, height] = preset.split('x').map(Number);

    const widthInput = this.container.querySelector('#window-width') as HTMLInputElement;
    const heightInput = this.container.querySelector('#window-height') as HTMLInputElement;

    if (widthInput && heightInput) {
      widthInput.value = width.toString();
      heightInput.value = height.toString();

      this.showFeedback(t('settings.window.presetApplied'), 'success');
    }
  }

  /**
   * Show feedback message
   */
  private showFeedback(message: string, type: 'success' | 'error'): void {
    const feedback = document.createElement('div');
    feedback.className = `feedback-message feedback-${type}`;
    feedback.textContent = message;

    this.container.appendChild(feedback);

    setTimeout(() => feedback.remove(), 2000);
  }

  /**
   * Get updated settings from form
   */
  public getSettings(): Partial<GlobalSettings> {
    const alwaysOnTopInput = this.container.querySelector('#always-on-top') as HTMLInputElement;
    const transparencyInput = this.container.querySelector('#transparency-slider') as HTMLInputElement;
    const startupBehaviorSelect = this.container.querySelector('#startup-behavior') as HTMLSelectElement;
    const widthInput = this.container.querySelector('#window-width') as HTMLInputElement;
    const heightInput = this.container.querySelector('#window-height') as HTMLInputElement;

    const window_preferences: WindowPreferences = {
      ...this.settings.window_preferences,
      always_on_top: alwaysOnTopInput.checked,
      transparency: parseFloat(transparencyInput.value) / 100,
      startup_behavior: startupBehaviorSelect.value as 'normal' | 'minimized' | 'hidden',
      width: parseInt(widthInput.value),
      height: parseInt(heightInput.value)
    };

    return {
      window_preferences
    };
  }
}
