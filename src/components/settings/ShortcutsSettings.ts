/**
 * ShortcutsSettings Tab Component (US5-005)
 *
 * Provides keyboard shortcut editor with:
 * - List of all configurable shortcuts
 * - Keyboard capture for editing
 * - Conflict detection
 * - Reset to defaults
 */

import { GlobalSettings, KeyboardShortcut } from '../../core/models/settings';
import { t } from '../../core/i18n/i18nManager';

interface ShortcutDefinition {
  action: string;
  label: string;
  defaultKeys: string;
  description: string;
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    action: 'send_message',
    label: 'shortcuts.sendMessage',
    defaultKeys: 'Ctrl+Enter',
    description: 'shortcuts.sendMessageDesc'
  },
  {
    action: 'new_topic',
    label: 'shortcuts.newTopic',
    defaultKeys: 'Ctrl+N',
    description: 'shortcuts.newTopicDesc'
  },
  {
    action: 'search',
    label: 'shortcuts.search',
    defaultKeys: 'Ctrl+F',
    description: 'shortcuts.searchDesc'
  },
  {
    action: 'toggle_sidebar',
    label: 'shortcuts.toggleSidebar',
    defaultKeys: 'Ctrl+B',
    description: 'shortcuts.toggleSidebarDesc'
  },
  {
    action: 'open_settings',
    label: 'shortcuts.openSettings',
    defaultKeys: 'Ctrl+,',
    description: 'shortcuts.openSettingsDesc'
  },
  {
    action: 'focus_input',
    label: 'shortcuts.focusInput',
    defaultKeys: 'Ctrl+L',
    description: 'shortcuts.focusInputDesc'
  },
  {
    action: 'toggle_always_on_top',
    label: 'shortcuts.toggleAlwaysOnTop',
    defaultKeys: 'Ctrl+Shift+T',
    description: 'shortcuts.toggleAlwaysOnTopDesc'
  },
  {
    action: 'quit',
    label: 'shortcuts.quit',
    defaultKeys: 'Ctrl+Q',
    description: 'shortcuts.quitDesc'
  }
];

export class ShortcutsSettings {
  private container: HTMLElement;
  private settings: GlobalSettings;
  private shortcuts: KeyboardShortcut[];
  private editingAction: string | null = null;

  constructor(container: HTMLElement, settings: GlobalSettings) {
    this.container = container;
    this.settings = settings;

    // Initialize shortcuts from settings or defaults
    this.shortcuts = this.initializeShortcuts();

    this.render();
  }

  /**
   * Initialize shortcuts from settings or use defaults
   */
  private initializeShortcuts(): KeyboardShortcut[] {
    if (this.settings.keyboard_shortcuts && this.settings.keyboard_shortcuts.length > 0) {
      return [...this.settings.keyboard_shortcuts];
    }

    // Use defaults
    return DEFAULT_SHORTCUTS.map(def => ({
      action: def.action,
      keys: def.defaultKeys
    }));
  }

  /**
   * Render the shortcuts settings tab
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="settings-section">
        <div class="shortcuts-header">
          <h3>${t('settings.shortcuts.title')}</h3>
          <button type="button" class="btn-secondary btn-sm" id="reset-shortcuts-btn">
            ${t('settings.shortcuts.resetToDefaults')}
          </button>
        </div>

        <p class="settings-field-description">${t('settings.shortcuts.hint')}</p>

        <div class="shortcuts-list">
          ${this.renderShortcutsList()}
        </div>
      </div>

      <!-- Keyboard Capture Modal -->
      <div class="shortcut-capture-modal" id="shortcut-capture-modal" style="display: none;">
        <div class="capture-content">
          <h4>${t('settings.shortcuts.pressKeys')}</h4>
          <div class="captured-keys" id="captured-keys">${t('settings.shortcuts.waitingForKeys')}</div>
          <div class="capture-actions">
            <button type="button" class="btn-secondary" id="cancel-capture-btn">
              ${t('settings.shortcuts.cancel')}
            </button>
            <button type="button" class="btn-primary" id="save-capture-btn" disabled>
              ${t('settings.shortcuts.save')}
            </button>
          </div>
          <div class="conflict-warning" id="conflict-warning" style="display: none;"></div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render the list of shortcuts
   */
  private renderShortcutsList(): string {
    return DEFAULT_SHORTCUTS.map(def => {
      const shortcut = this.shortcuts.find(s => s.action === def.action);
      const currentKeys = shortcut?.keys || def.defaultKeys;

      return `
        <div class="shortcut-item" data-action="${def.action}">
          <div class="shortcut-info">
            <div class="shortcut-label">${t(def.label)}</div>
            <div class="settings-field-description">${t(def.description)}</div>
          </div>
          <div class="shortcut-keys">
            <kbd class="shortcut-kbd">${this.formatKeys(currentKeys)}</kbd>
            <button type="button" class="btn-icon edit-shortcut-btn" data-action="${def.action}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Format keys for display (e.g., "Ctrl+Enter" → "Ctrl + Enter")
   */
  private formatKeys(keys: string): string {
    return keys.split('+').map(key => `<span>${key}</span>`).join('<span class="key-separator">+</span>');
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Edit shortcut buttons
    const editBtns = this.container.querySelectorAll('.edit-shortcut-btn');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action) {
          this.startCapture(action);
        }
      });
    });

    // Reset to defaults button
    const resetBtn = this.container.querySelector('#reset-shortcuts-btn');
    resetBtn?.addEventListener('click', () => this.resetToDefaults());

    // Capture modal buttons
    const cancelBtn = this.container.querySelector('#cancel-capture-btn');
    cancelBtn?.addEventListener('click', () => this.cancelCapture());

    const saveBtn = this.container.querySelector('#save-capture-btn');
    saveBtn?.addEventListener('click', () => this.saveCapture());
  }

  /**
   * Start keyboard capture for editing a shortcut
   */
  private startCapture(action: string): void {
    this.editingAction = action;

    const modal = this.container.querySelector('#shortcut-capture-modal') as HTMLElement;
    modal.style.display = 'flex';

    // Reset captured keys display
    const capturedKeysEl = this.container.querySelector('#captured-keys');
    if (capturedKeysEl) {
      capturedKeysEl.textContent = t('settings.shortcuts.waitingForKeys');
    }

    const saveBtn = this.container.querySelector('#save-capture-btn') as HTMLButtonElement;
    saveBtn.disabled = true;

    // Listen for keyboard input
    document.addEventListener('keydown', this.handleKeyCapture);
  }

  /**
   * Handle keyboard capture
   */
  private handleKeyCapture = (e: KeyboardEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    // Build shortcut string
    const keys: string[] = [];

    if (e.ctrlKey || e.metaKey) keys.push(e.ctrlKey ? 'Ctrl' : 'Cmd');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    // Add main key (exclude modifiers)
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      const mainKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      keys.push(mainKey);
    }

    const capturedKeys = keys.join('+');

    // Update display
    const capturedKeysEl = this.container.querySelector('#captured-keys');
    if (capturedKeysEl) {
      capturedKeysEl.innerHTML = this.formatKeys(capturedKeys);
    }

    // Enable save button if we have a valid shortcut
    const saveBtn = this.container.querySelector('#save-capture-btn') as HTMLButtonElement;
    if (keys.length >= 2) {
      saveBtn.disabled = false;

      // Check for conflicts
      this.checkConflict(capturedKeys);
    } else {
      saveBtn.disabled = true;
    }

    // Store captured keys temporarily
    (saveBtn as any).capturedKeys = capturedKeys;
  };

  /**
   * Check for shortcut conflicts
   */
  private checkConflict(keys: string): void {
    const conflictWarning = this.container.querySelector('#conflict-warning') as HTMLElement;

    const existingShortcut = this.shortcuts.find(s =>
      s.keys === keys && s.action !== this.editingAction
    );

    if (existingShortcut) {
      const def = DEFAULT_SHORTCUTS.find(d => d.action === existingShortcut.action);
      conflictWarning.textContent = t('settings.shortcuts.conflictWarning', {
        action: def ? t(def.label) : existingShortcut.action
      });
      conflictWarning.style.display = 'block';
    } else {
      conflictWarning.style.display = 'none';
    }
  }

  /**
   * Save captured shortcut
   */
  private saveCapture(): void {
    if (!this.editingAction) return;

    const saveBtn = this.container.querySelector('#save-capture-btn') as any;
    const capturedKeys = saveBtn.capturedKeys;

    if (!capturedKeys) return;

    // Update shortcuts array
    const existingIndex = this.shortcuts.findIndex(s => s.action === this.editingAction);

    if (existingIndex >= 0) {
      this.shortcuts[existingIndex].keys = capturedKeys;
    } else {
      this.shortcuts.push({
        action: this.editingAction,
        keys: capturedKeys
      });
    }

    // Re-render shortcuts list
    const shortcutsList = this.container.querySelector('.shortcuts-list');
    if (shortcutsList) {
      shortcutsList.innerHTML = this.renderShortcutsList();
      this.attachEventListeners(); // Reattach listeners
    }

    this.cancelCapture();
  }

  /**
   * Cancel keyboard capture
   */
  private cancelCapture(): void {
    const modal = this.container.querySelector('#shortcut-capture-modal') as HTMLElement;
    modal.style.display = 'none';

    document.removeEventListener('keydown', this.handleKeyCapture);
    this.editingAction = null;
  }

  /**
   * Reset all shortcuts to defaults
   */
  private resetToDefaults(): void {
    const confirmed = confirm(t('settings.shortcuts.resetConfirm'));
    if (!confirmed) return;

    this.shortcuts = DEFAULT_SHORTCUTS.map(def => ({
      action: def.action,
      keys: def.defaultKeys
    }));

    // Re-render
    const shortcutsList = this.container.querySelector('.shortcuts-list');
    if (shortcutsList) {
      shortcutsList.innerHTML = this.renderShortcutsList();
      this.attachEventListeners();
    }

    this.showFeedback(t('settings.shortcuts.resetSuccess'), 'success');
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
   * Get updated shortcuts
   */
  public getSettings(): KeyboardShortcut[] {
    return this.shortcuts;
  }
}
