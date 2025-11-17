/**
 * GroupEditor Component - Modal form for creating/editing groups
 * Includes agent selection, collaboration mode, turn count, speaking rules
 */

import type { Group, Agent } from '../core/models';
import type { CreateGroupOptions, UpdateGroupOptions } from '../core/managers/groupManager';
import { t } from '../core/i18n/i18nManager';

export interface GroupEditorOptions {
  mode: 'create' | 'edit';
  group?: Group;
  availableAgents: Agent[];
  onSave?: (data: CreateGroupOptions | UpdateGroupOptions) => void;
  onCancel?: () => void;
}

export class GroupEditor {
  private container: HTMLElement;
  private options: GroupEditorOptions;
  private modal: HTMLElement | null = null;

  constructor(container: HTMLElement, options: GroupEditorOptions) {
    this.container = container;
    this.options = options;
  }

  show(): void {
    this.render();
    this.attachEventListeners();

    // Show modal with animation
    setTimeout(() => {
      this.modal?.classList.add('active');
    }, 10);
  }

  hide(): void {
    if (this.modal) {
      this.modal.classList.remove('active');
      setTimeout(() => {
        this.destroy();
      }, 300);
    }
  }

  private render(): void {
    const { mode, group, availableAgents } = this.options;
    const isEdit = mode === 'edit' && group;

    // Get selected agent IDs
    const selectedAgentIds = isEdit ? new Set(group.agent_ids) : new Set<string>();

    const modalHtml = `
      <div class="modal-overlay group-editor-modal">
        <div class="modal-content modal-large">
          <div class="modal-header">
            <h2>${isEdit ? t('group.edit') : t('group.create')}</h2>
            <button class="button-icon modal-close-btn" data-action="cancel">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <form class="group-editor-form" id="group-editor-form">
              <!-- Name -->
              <div class="form-group">
                <label for="group-name">${t('group.name')} <span class="required">*</span></label>
                <input
                  type="text"
                  id="group-name"
                  name="name"
                  class="form-input"
                  value="${isEdit ? this.escapeHtml(group.name) : ''}"
                  placeholder="${t('group.namePlaceholder')}"
                  maxlength="50"
                  required
                />
                <div class="form-help">${t('group.nameHint')}</div>
                <div class="form-error" id="name-error"></div>
              </div>

              <!-- Agent Selection -->
              <div class="form-group">
                <label>${t('group.members')} <span class="required">*</span> (minimum 2)</label>
                <div class="agent-selection-grid" id="agent-selection-grid">
                  ${availableAgents.length === 0 ? `
                    <div class="empty-state-inline">
                      <p>No agents available. Please create agents first.</p>
                    </div>
                  ` : availableAgents.map(agent => `
                    <label class="agent-checkbox-item">
                      <input
                        type="checkbox"
                        name="agent_ids"
                        value="${agent.id}"
                        ${selectedAgentIds.has(agent.id) ? 'checked' : ''}
                      />
                      <div class="agent-checkbox-content">
                        <img src="${agent.avatar}" alt="${this.escapeHtml(agent.name)}" class="agent-checkbox-avatar" />
                        <div class="agent-checkbox-info">
                          <span class="agent-checkbox-name">${this.escapeHtml(agent.name)}</span>
                          <span class="agent-checkbox-model">${this.escapeHtml(agent.model)}</span>
                        </div>
                      </div>
                    </label>
                  `).join('')}
                </div>
                <div class="form-help">
                  <span id="selected-count">${selectedAgentIds.size}</span> ${t('group.membersHint')}
                </div>
                <div class="form-error" id="agent_ids-error"></div>
              </div>

              <!-- Collaboration Mode -->
              <div class="form-group">
                <label>${t('group.collaborationMode')} <span class="required">*</span></label>
                <div class="collaboration-mode-selector">
                  <label class="mode-option ${!isEdit || group.collaboration_mode === 'sequential' ? 'selected' : ''}">
                    <input
                      type="radio"
                      name="collaboration_mode"
                      value="sequential"
                      ${!isEdit || group.collaboration_mode === 'sequential' ? 'checked' : ''}
                    />
                    <div class="mode-option-content">
                      <div class="mode-option-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                          <polyline points="12 5 19 12 12 19"/>
                        </svg>
                        <span class="mode-option-title">${t('group.modes.turnBased')}</span>
                      </div>
                      <p class="mode-option-description">
                        Agents respond in turn for a fixed number of rounds. Each agent sees all previous responses.
                      </p>
                    </div>
                  </label>

                  <label class="mode-option ${isEdit && group.collaboration_mode === 'free' ? 'selected' : ''}">
                    <input
                      type="radio"
                      name="collaboration_mode"
                      value="free"
                      ${isEdit && group.collaboration_mode === 'free' ? 'checked' : ''}
                    />
                    <div class="mode-option-content">
                      <div class="mode-option-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                        </svg>
                        <span class="mode-option-title">${t('group.modes.freeDiscussion')}</span>
                      </div>
                      <p class="mode-option-description">
                        Agents respond based on relevance. The system intelligently selects which agents should participate.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Turn Count (only for sequential mode) -->
              <div class="form-group" id="turn-count-group" style="${!isEdit || group.collaboration_mode === 'sequential' ? '' : 'display: none;'}">
                <label for="group-turn-count">
                  ${t('group.turnCount')}: <span id="turn-count-value">${isEdit ? group.turn_count : 3}</span>
                </label>
                <input
                  type="range"
                  id="group-turn-count"
                  name="turn_count"
                  class="form-range"
                  min="1"
                  max="10"
                  step="1"
                  value="${isEdit ? group.turn_count : 3}"
                />
                <div class="range-labels">
                  <span>1 turn</span>
                  <span>5 turns</span>
                  <span>10 turns</span>
                </div>
                <div class="form-help">${t('group.turnCountHint')}</div>
              </div>

              <!-- Speaking Rules -->
              <div class="form-group">
                <label for="group-speaking-rules">${t('group.speakingRules')} (Optional)</label>
                <textarea
                  id="group-speaking-rules"
                  name="speaking_rules"
                  class="form-textarea"
                  rows="4"
                  placeholder="${t('group.speakingRulesPlaceholder')}"
                  maxlength="500"
                >${isEdit ? this.escapeHtml(group.speaking_rules || '') : ''}</textarea>
                <div class="form-help">
                  <span id="speaking-rules-count">0</span>/500 characters
                </div>
              </div>

              <!-- Avatar (placeholder) -->
              <div class="form-group">
                <label for="group-avatar">${t('group.avatar')}</label>
                <input
                  type="text"
                  id="group-avatar"
                  name="avatar"
                  class="form-input"
                  value="${isEdit ? this.escapeHtml(group.avatar) : 'assets/avatars/default-group.png'}"
                  placeholder="Avatar path or URL"
                />
                <div class="form-help">${t('group.avatarHint')}</div>
              </div>

              <!-- Streaming Response -->
              <div class="form-group">
                <label class="form-checkbox-label">
                  <input
                    type="checkbox"
                    id="group-streaming"
                    name="streaming"
                    class="form-checkbox"
                    ${isEdit && group.streaming === false ? '' : 'checked'}
                  />
                  <span>Enable Streaming Response</span>
                </label>
                <div class="form-help">Show responses as they are generated (recommended for better user experience)</div>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="button button-secondary" data-action="cancel">${t('group.cancel')}</button>
            <button class="button button-primary" data-action="save">
              ${isEdit ? t('group.save') : t('group.createButton')}
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = this.container.querySelector('.group-editor-modal');

    // Update character count
    this.updateCharacterCount();
  }

  private attachEventListeners(): void {
    if (!this.modal) return;

    // Collaboration mode radio buttons
    const modeOptions = this.modal.querySelectorAll('.mode-option');
    const modeRadios = this.modal.querySelectorAll('input[name="collaboration_mode"]');
    const turnCountGroup = this.modal.querySelector('#turn-count-group') as HTMLElement;

    modeRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        // Update selected state
        modeOptions.forEach(option => option.classList.remove('selected'));
        const selectedOption = (radio as HTMLInputElement).closest('.mode-option');
        selectedOption?.classList.add('selected');

        // Show/hide turn count based on mode
        const mode = (radio as HTMLInputElement).value;
        if (turnCountGroup) {
          turnCountGroup.style.display = mode === 'sequential' ? '' : 'none';
        }
      });
    });

    // Turn count slider update
    const turnSlider = this.modal.querySelector('#group-turn-count') as HTMLInputElement;
    const turnValue = this.modal.querySelector('#turn-count-value');
    if (turnSlider && turnValue) {
      turnSlider.addEventListener('input', () => {
        turnValue.textContent = turnSlider.value;
      });
    }

    // Agent selection checkboxes
    const agentCheckboxes = this.modal.querySelectorAll('input[name="agent_ids"]');
    const selectedCount = this.modal.querySelector('#selected-count');
    agentCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const checked = Array.from(agentCheckboxes).filter((cb: any) => cb.checked).length;
        if (selectedCount) {
          selectedCount.textContent = checked.toString();
        }
      });
    });

    // Speaking rules character count
    const speakingRulesTextarea = this.modal.querySelector('#group-speaking-rules') as HTMLTextAreaElement;
    if (speakingRulesTextarea) {
      speakingRulesTextarea.addEventListener('input', () => {
        this.updateCharacterCount();
      });
    }

    // Cancel button
    const cancelBtns = this.modal.querySelectorAll('[data-action="cancel"]');
    cancelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.options.onCancel) {
          this.options.onCancel();
        }
        this.hide();
      });
    });

    // Save button
    const saveBtn = this.modal.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.handleSave();
      });
    }

    // Form submit
    const form = this.modal.querySelector('#group-editor-form') as HTMLFormElement;
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSave();
      });
    }

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        if (this.options.onCancel) {
          this.options.onCancel();
        }
        this.hide();
      }
    });
  }

  private handleSave(): void {
    const form = this.modal?.querySelector('#group-editor-form') as HTMLFormElement;
    if (!form) return;

    // Clear previous errors
    this.clearErrors();

    // Get form data
    const formData = new FormData(form);
    const data: any = {};

    // Get name
    data.name = formData.get('name') as string;

    // Get selected agent IDs
    const selectedAgents = Array.from(form.querySelectorAll('input[name="agent_ids"]:checked'))
      .map((checkbox: any) => checkbox.value);
    data.agent_ids = selectedAgents;

    // Get collaboration mode
    data.collaboration_mode = formData.get('collaboration_mode') as 'sequential' | 'free';

    // Get turn count (only for sequential)
    if (data.collaboration_mode === 'sequential') {
      data.turn_count = parseInt(formData.get('turn_count') as string, 10);
    }

    // Get speaking rules
    data.speaking_rules = formData.get('speaking_rules') as string || '';

    // Get avatar
    data.avatar = formData.get('avatar') as string;

    // Get streaming (checkbox field - will only be present if checked)
    data.streaming = formData.get('streaming') === 'on';

    // Validate
    const errors = this.validate(data);
    if (Object.keys(errors).length > 0) {
      this.showErrors(errors);
      return;
    }

    // Call save callback
    if (this.options.onSave) {
      this.options.onSave(data);
    }

    this.hide();
  }

  private validate(data: any): Record<string, string> {
    const errors: Record<string, string> = {};

    // Name validation
    if (!data.name || data.name.trim().length === 0) {
      errors.name = t('validation.required');
    } else if (data.name.length > 50) {
      errors.name = t('validation.maxLength', { max: '50' });
    }

    // Agent IDs validation
    if (!data.agent_ids || data.agent_ids.length < 2) {
      errors.agent_ids = 'Please select at least 2 agents';
    }

    // Turn count validation (for sequential mode)
    if (data.collaboration_mode === 'sequential') {
      if (data.turn_count < 1 || data.turn_count > 10) {
        errors.turn_count = t('validation.minValue', { min: '1' }) + ' - ' + t('validation.maxValue', { max: '10' });
      }
    }

    return errors;
  }

  private showErrors(errors: Record<string, string>): void {
    Object.keys(errors).forEach(field => {
      const errorElement = this.modal?.querySelector(`#${field}-error`);
      if (errorElement) {
        errorElement.textContent = errors[field];
        errorElement.classList.add('active');
      }

      const inputElement = this.modal?.querySelector(`[name="${field}"]`);
      if (inputElement) {
        inputElement.classList.add('error');
      }
    });
  }

  private clearErrors(): void {
    const errorElements = this.modal?.querySelectorAll('.form-error');
    errorElements?.forEach(el => {
      el.textContent = '';
      el.classList.remove('active');
    });

    const inputElements = this.modal?.querySelectorAll('.form-input, .form-textarea, .form-range');
    inputElements?.forEach(el => {
      el.classList.remove('error');
    });
  }

  private updateCharacterCount(): void {
    const textarea = this.modal?.querySelector('#group-speaking-rules') as HTMLTextAreaElement;
    const countElement = this.modal?.querySelector('#speaking-rules-count');
    if (textarea && countElement) {
      countElement.textContent = textarea.value.length.toString();
    }
  }

  private destroy(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
