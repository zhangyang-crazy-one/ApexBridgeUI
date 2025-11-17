/**
 * Agent Settings Panel
 *
 * Displays and handles editing of Agent configuration in the Settings tab.
 * Provides form for modifying agent properties and actions for saving/deleting.
 */

import type { Agent } from '@/core/models/agent';
import { AgentManager } from '@/core/managers/agentManager';

export class AgentSettingsPanel {
  private static instance: AgentSettingsPanel;
  private container: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;
  private currentAgent: Agent | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AgentSettingsPanel {
    if (!AgentSettingsPanel.instance) {
      AgentSettingsPanel.instance = new AgentSettingsPanel();
    }
    return AgentSettingsPanel.instance;
  }

  /**
   * Initialize panel with container element
   */
  public initialize(container: HTMLElement): void {
    this.container = container;
    console.log('[AgentSettingsPanel] Initialized');
  }

  /**
   * Render agent settings form or empty state
   * @param agent - Agent to display settings for, or null for empty state
   */
  public render(agent: Agent | null): void {
    if (!this.container) {
      console.error('[AgentSettingsPanel] Not initialized');
      return;
    }

    if (!agent) {
      this.renderEmptyState();
    } else {
      this.renderAgentForm(agent);
    }
  }

  /**
   * Render empty state when no agent is selected
   */
  private renderEmptyState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <p class="settings-empty-message">
        请先在"助手"标签页选择一个Agent以查看或修改其设置。
      </p>
    `;

    this.currentAgent = null;
    this.form = null;
  }

  /**
   * Render agent settings form
   * @param agent - Agent to display settings for
   */
  private renderAgentForm(agent: Agent): void {
    if (!this.container) return;

    this.currentAgent = agent;

    this.container.innerHTML = `
      <h3 class="settings-title">
        助手设置: <span class="agent-name">${this.escapeHtml(agent.name)}</span>
      </h3>

      <form id="agent-settings-form" class="agent-settings-form">
        <input type="hidden" name="agentId" value="${agent.id}">

        <div class="form-group">
          <label for="agent-name-input">Agent 名称:</label>
          <input
            type="text"
            id="agent-name-input"
            name="name"
            value="${this.escapeHtml(agent.name)}"
            required
          >
        </div>

        <div class="form-group">
          <label for="agent-avatar-input">Agent 头像路径:</label>
          <input
            type="text"
            id="agent-avatar-path"
            name="avatarPath"
            value="${this.escapeHtml(agent.avatar)}"
            placeholder="/assets/avatars/agent.svg"
          >
          <img
            id="agent-avatar-preview"
            src="${agent.avatar}"
            alt="头像预览"
            class="avatar-preview"
            onerror="this.src='/assets/avatars/default.svg'"
          >
        </div>

        <div class="form-group">
          <label for="agent-system-prompt">系统提示词:</label>
          <textarea
            id="agent-system-prompt"
            name="systemPrompt"
            rows="6"
            placeholder="输入系统提示词..."
          >${this.escapeHtml(agent.system_prompt)}</textarea>
        </div>

        <div class="form-group">
          <label for="agent-model">模型名称:</label>
          <input
            type="text"
            id="agent-model"
            name="model"
            value="${this.escapeHtml(agent.model)}"
            placeholder="例如 glm-4-flash"
          >
        </div>

        <div class="form-group">
          <label for="agent-temperature">Temperature (0-1):</label>
          <input
            type="number"
            id="agent-temperature"
            name="temperature"
            value="${agent.temperature}"
            min="0"
            max="1"
            step="0.1"
          >
        </div>

        <div class="form-group">
          <label for="agent-context-limit">上下文Token上限:</label>
          <input
            type="number"
            id="agent-context-limit"
            name="contextTokenLimit"
            value="${agent.context_token_limit}"
            min="0"
            step="100"
          >
        </div>

        <div class="form-group">
          <label for="agent-max-tokens">最大输出Token上限:</label>
          <input
            type="number"
            id="agent-max-tokens"
            name="maxOutputTokens"
            value="${agent.max_output_tokens}"
            min="0"
            step="50"
          >
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">保存Agent设置</button>
          <button type="button" id="delete-agent-btn" class="btn-danger">删除此Agent</button>
        </div>
      </form>
    `;

    this.form = this.container.querySelector('#agent-settings-form');
    this.bindFormEvents();
  }

  /**
   * Bind form event handlers
   */
  private bindFormEvents(): void {
    if (!this.form) return;

    // Handle form submission
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveAgentSettings();
    });

    // Handle delete button
    const deleteBtn = this.container?.querySelector('#delete-agent-btn');
    deleteBtn?.addEventListener('click', async () => {
      await this.deleteAgent();
    });

    // Handle avatar path change to update preview
    const avatarPathInput = this.form.querySelector('#agent-avatar-path') as HTMLInputElement;
    const avatarPreview = this.form.querySelector('#agent-avatar-preview') as HTMLImageElement;

    if (avatarPathInput && avatarPreview) {
      avatarPathInput.addEventListener('input', () => {
        avatarPreview.src = avatarPathInput.value;
      });
    }
  }

  /**
   * Save agent settings
   */
  private async saveAgentSettings(): Promise<void> {
    if (!this.form || !this.currentAgent) return;

    const formData = new FormData(this.form);

    const updatedAgent: Agent = {
      ...this.currentAgent,
      name: formData.get('name') as string,
      avatar: formData.get('avatarPath') as string,
      system_prompt: formData.get('systemPrompt') as string,
      model: formData.get('model') as string,
      temperature: parseFloat(formData.get('temperature') as string),
      context_token_limit: parseInt(formData.get('contextTokenLimit') as string),
      max_output_tokens: parseInt(formData.get('maxOutputTokens') as string),
      updated_at: new Date().toISOString(),
    };

    try {
      const agentManager = AgentManager.getInstance();
      await agentManager.updateAgent(updatedAgent.id, updatedAgent);

      console.log('[AgentSettingsPanel] ✅ Agent settings saved:', updatedAgent.name);

      // Dispatch event for UI update
      const event = new CustomEvent('agent-updated', {
        detail: { agent: updatedAgent }
      });
      window.dispatchEvent(event);

      // Show success feedback
      this.showFeedback('设置已保存', 'success');

    } catch (error) {
      console.error('[AgentSettingsPanel] Failed to save agent settings:', error);
      this.showFeedback('保存失败', 'error');
    }
  }

  /**
   * Delete current agent
   */
  private async deleteAgent(): Promise<void> {
    if (!this.currentAgent) return;

    const confirmed = confirm(`确定要删除 Agent "${this.currentAgent.name}" 吗？此操作不可撤销。`);
    if (!confirmed) return;

    try {
      const agentManager = AgentManager.getInstance();
      await agentManager.deleteAgent(this.currentAgent.id);

      console.log('[AgentSettingsPanel] ✅ Agent deleted:', this.currentAgent.name);

      // Dispatch event for UI update
      const event = new CustomEvent('agent-deleted', {
        detail: { agentId: this.currentAgent.id }
      });
      window.dispatchEvent(event);

      // Switch back to agents tab
      const { SidebarTabManager } = await import('../sidebar/tab-manager');
      const tabManager = SidebarTabManager.getInstance();
      tabManager.switchTab('agents');

    } catch (error) {
      console.error('[AgentSettingsPanel] Failed to delete agent:', error);
      this.showFeedback('删除失败', 'error');
    }
  }

  /**
   * Show feedback message
   */
  private showFeedback(message: string, type: 'success' | 'error'): void {
    // Simple console feedback for now
    // TODO: Implement toast notification system
    if (type === 'success') {
      console.log(`✅ ${message}`);
    } else {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Initialize and return singleton instance
 */
export function initAgentSettingsPanel(container: HTMLElement): AgentSettingsPanel {
  const panel = AgentSettingsPanel.getInstance();
  panel.initialize(container);
  return panel;
}
