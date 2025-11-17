/**
 * AgentEditor Component - Modal form for creating/editing agents
 * Includes form validation and default values
 */

import type { Agent } from '../core/models';
import type { CreateAgentOptions, UpdateAgentOptions } from '../core/managers/agentManager';
import { getAPIClient } from '../core/services/apiClient';
import type { ModelInfo } from '../core/services/apiClient';
import { t } from '../core/i18n/i18nManager';

export interface AgentEditorOptions {
  mode: 'create' | 'edit';
  agent?: Agent;
  onSave?: (data: CreateAgentOptions | UpdateAgentOptions) => void;
  onCancel?: () => void;
}

export class AgentEditor {
  private container: HTMLElement;
  private options: AgentEditorOptions;
  private modal: HTMLElement | null = null;
  private availableModels: ModelInfo[] = []; // Cached models list

  constructor(container: HTMLElement, options: AgentEditorOptions) {
    this.container = container;
    this.options = options;
  }

  async show(): Promise<void> {
    // Load models before rendering
    await this.loadModels();

    this.render();
    this.attachEventListeners();

    // Show modal with animation
    setTimeout(() => {
      this.modal?.classList.add('active');
    }, 10);
  }

  /**
   * Load available models from backend
   */
  private async loadModels(): Promise<void> {
    try {
      console.log('[AgentEditor] Loading models from backend...');
      const apiClient = getAPIClient();
      this.availableModels = await apiClient.listModels();
      console.log('[AgentEditor] Loaded models:', this.availableModels.length);
    } catch (error) {
      console.error('[AgentEditor] Failed to load models:', error);
      // Fallback to default models
      this.availableModels = this.getDefaultModels();
      console.warn('[AgentEditor] Using fallback default models');
    }
  }

  /**
   * Get default models as fallback
   */
  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'gpt-4', object: 'model', owned_by: 'openai' },
      { id: 'gpt-4-turbo', object: 'model', owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
      { id: 'claude-3-opus', object: 'model', owned_by: 'anthropic' },
      { id: 'claude-3-sonnet', object: 'model', owned_by: 'anthropic' },
      { id: 'claude-3-haiku', object: 'model', owned_by: 'anthropic' },
      { id: 'glm-4.6', object: 'model', owned_by: 'zhipuai' },
      { id: 'glm-4', object: 'model', owned_by: 'zhipuai' },
    ];
  }

  /**
   * Get display name for model
   */
  private getModelDisplayName(model: ModelInfo): string {
    // Use description if available
    if (model.description) {
      return model.description;
    }

    // Format model ID for display
    const name = model.id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Add provider if available
    if (model.owned_by && model.owned_by !== 'system') {
      const providerName = model.owned_by.charAt(0).toUpperCase() + model.owned_by.slice(1);
      return `${name} (${providerName})`;
    }

    return name;
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
    const { mode, agent } = this.options;
    const isEdit = mode === 'edit' && agent;

    // Generate model options HTML dynamically
    const modelOptionsHtml = this.availableModels.map(model => {
      const isSelected = isEdit && agent.model === model.id;
      const displayName = this.getModelDisplayName(model);
      return `<option value="${model.id}" ${isSelected ? 'selected' : ''}>
        ${this.escapeHtml(displayName)}
      </option>`;
    }).join('\n');

    // If no model is selected in edit mode and we have models, select the first one
    const hasDefaultSelection = !isEdit && this.availableModels.length > 0;

    const modalHtml = `
      <div class="modal-overlay agent-editor-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>${isEdit ? t('agent.edit') : t('agent.create')}</h2>
            <button class="button-icon modal-close-btn" data-action="cancel">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <form class="agent-editor-form" id="agent-editor-form">
              <!-- Hidden ID field for edit mode -->
              ${isEdit ? `<input type="hidden" name="id" value="${agent.id}" />` : ''}

              <!-- Name -->
              <div class="form-group">
                <label for="agent-name">${t('agent.name')} <span class="required">*</span></label>
                <input
                  type="text"
                  id="agent-name"
                  name="name"
                  class="form-input"
                  value="${isEdit ? this.escapeHtml(agent.name) : ''}"
                  placeholder="${t('agent.namePlaceholder')}"
                  maxlength="50"
                  required
                />
                <div class="form-help">${t('agent.nameHint')}</div>
                <div class="form-error" id="name-error"></div>
              </div>

              <!-- Model -->
              <div class="form-group">
                <label for="agent-model">${t('agent.model')} <span class="required">*</span></label>
                <select
                  id="agent-model"
                  name="model"
                  class="form-select"
                  required
                >
                  ${modelOptionsHtml}
                </select>
                <div class="form-help">${t('agent.modelHint')}</div>
              </div>

              <!-- System Prompt -->
              <div class="form-group">
                <label for="agent-prompt">${t('agent.systemPrompt')}</label>
                <textarea
                  id="agent-prompt"
                  name="system_prompt"
                  class="form-textarea"
                  rows="4"
                  placeholder="${t('agent.systemPromptPlaceholder')}"
                >${isEdit ? this.escapeHtml(agent.system_prompt || '') : ''}</textarea>
                <div class="form-help">${t('agent.systemPromptHint')}</div>
              </div>

              <!-- Temperature -->
              <div class="form-group">
                <label for="agent-temperature">
                  ${t('agent.temperature')}: <span id="temperature-value">${isEdit ? agent.temperature.toFixed(1) : '0.7'}</span>
                </label>
                <input
                  type="range"
                  id="agent-temperature"
                  name="temperature"
                  class="form-range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value="${isEdit ? agent.temperature : 0.7}"
                />
                <div class="form-help">${t('agent.temperatureHint')}</div>
                <div class="form-error" id="temperature-error"></div>
              </div>

              <!-- Max Output Tokens -->
              <div class="form-group">
                <label for="agent-max-tokens">${t('agent.maxOutputTokens')}</label>
                <input
                  type="number"
                  id="agent-max-tokens"
                  name="max_output_tokens"
                  class="form-input"
                  value="${isEdit ? agent.max_output_tokens : 2000}"
                  min="100"
                  max="8000"
                  step="100"
                />
                <div class="form-help">${t('agent.maxOutputTokensHint')}</div>
              </div>

              <!-- Max Context Tokens -->
              <div class="form-group">
                <label for="agent-context-tokens">${t('agent.maxContextTokens')}</label>
                <input
                  type="number"
                  id="agent-context-tokens"
                  name="max_context_tokens"
                  class="form-input"
                  value="${isEdit ? agent.max_context_tokens : 8000}"
                  min="1000"
                  max="32000"
                  step="1000"
                />
                <div class="form-help">${t('agent.maxContextTokensHint')}</div>
              </div>

              <!-- Avatar (placeholder for future file upload) -->
              <div class="form-group">
                <label for="agent-avatar">${t('agent.avatar')}</label>
                <input
                  type="text"
                  id="agent-avatar"
                  name="avatar"
                  class="form-input"
                  value="${isEdit ? this.escapeHtml(agent.avatar) : 'assets/avatars/default-agent.png'}"
                  placeholder="Avatar path or URL"
                />
                <div class="form-help">${t('agent.avatarHint')}</div>
              </div>

              <!-- Streaming Response -->
              <div class="form-group">
                <label class="form-checkbox-label">
                  <input
                    type="checkbox"
                    id="agent-streaming"
                    name="streaming"
                    class="form-checkbox"
                    ${isEdit && agent.streaming === false ? '' : 'checked'}
                  />
                  <span>${t('agent.enableStreaming')}</span>
                </label>
                <div class="form-help">${t('agent.enableStreamingHint')}</div>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="button button-secondary" data-action="cancel">${t('agent.cancel')}</button>
            <button class="button button-primary" data-action="save">
              ${isEdit ? t('agent.save') : t('agent.createButton')}
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = this.container.querySelector('.agent-editor-modal');
  }

  private attachEventListeners(): void {
    if (!this.modal) return;

    // Temperature slider update
    const tempSlider = this.modal.querySelector('#agent-temperature') as HTMLInputElement;
    const tempValue = this.modal.querySelector('#temperature-value');
    if (tempSlider && tempValue) {
      tempSlider.addEventListener('input', () => {
        tempValue.textContent = parseFloat(tempSlider.value).toFixed(1);
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
    const form = this.modal.querySelector('#agent-editor-form') as HTMLFormElement;
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
    const form = this.modal?.querySelector('#agent-editor-form') as HTMLFormElement;
    if (!form) return;

    // Clear previous errors
    this.clearErrors();

    // Get form data
    const formData = new FormData(form);
    const data: any = {};

    formData.forEach((value, key) => {
      if (key === 'temperature') {
        data[key] = parseFloat(value as string);
      } else if (key === 'max_output_tokens' || key === 'max_context_tokens') {
        data[key] = parseInt(value as string, 10);
      } else if (key === 'streaming') {
        // Checkbox field - will only be present if checked
        data[key] = true;
      } else {
        data[key] = value;
      }
    });

    // Add streaming field with default value if not checked
    if (data.streaming === undefined) {
      data.streaming = false;
    }

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

    // Temperature validation
    if (data.temperature < 0.0 || data.temperature > 2.0) {
      errors.temperature = t('validation.minValue', { min: '0.0' }) + ' - ' + t('validation.maxValue', { max: '2.0' });
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
