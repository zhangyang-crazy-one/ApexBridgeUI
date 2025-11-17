/**
 * AgentCard Component - Displays agent information in card format
 * Shows avatar, name, model, and action buttons (edit, delete)
 */

import type { Agent } from '../core/models';

export interface AgentCardOptions {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  onClick?: (agent: Agent) => void;
}

export class AgentCard {
  private container: HTMLElement;
  private options: AgentCardOptions;

  constructor(container: HTMLElement, options: AgentCardOptions) {
    this.container = container;
    this.options = options;
    this.render();
  }

  render(): void {
    const { agent } = this.options;

    this.container.innerHTML = `
      <div class="agent-card" data-agent-id="${agent.id}">
        <div class="agent-card-avatar">
          <img src="${agent.avatar}" alt="${agent.name}" />
        </div>
        <div class="agent-card-content">
          <h3 class="agent-card-name">${this.escapeHtml(agent.name)}</h3>
          <p class="agent-card-model">${this.escapeHtml(agent.model)}</p>
          <div class="agent-card-meta">
            <span class="agent-meta-temp">🌡️ ${agent.temperature.toFixed(1)}</span>
            <span class="agent-meta-tokens">📝 ${agent.max_output_tokens}</span>
          </div>
        </div>
        <div class="agent-card-actions">
          <button class="button-icon agent-edit-btn" title="Edit Agent" data-action="edit">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
          <button class="button-icon agent-delete-btn" title="Delete Agent" data-action="delete">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const card = this.container.querySelector('.agent-card') as HTMLElement;
    if (!card) return;

    // Card click (except on action buttons)
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.agent-card-actions')) return;

      if (this.options.onClick) {
        this.options.onClick(this.options.agent);
      }
    });

    // Edit button
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onEdit) {
          this.options.onEdit(this.options.agent);
        }
      });
    }

    // Delete button
    const deleteBtn = card.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onDelete) {
          this.options.onDelete(this.options.agent);
        }
      });
    }
  }

  update(agent: Agent): void {
    this.options.agent = agent;
    this.render();
  }

  destroy(): void {
    this.container.innerHTML = '';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
