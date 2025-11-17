/**
 * GroupCard Component - Card display for agent groups
 * Shows group avatar, name, agent count, collaboration mode badge
 */

import type { Group } from '../core/models';

export interface GroupCardOptions {
  group: Group;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
  onClick?: (group: Group) => void;
}

export class GroupCard {
  private container: HTMLElement;
  private options: GroupCardOptions;

  constructor(container: HTMLElement, options: GroupCardOptions) {
    this.container = container;
    this.options = options;
    this.render();
    this.attachEventListeners();
  }

  render(): void {
    const { group } = this.options;

    // Get mode badge styling
    const modeBadge = this.getModeBadge(group.collaboration_mode);

    this.container.innerHTML = `
      <div class="group-card" data-group-id="${group.id}">
        <div class="group-card-avatar">
          <img src="${group.avatar}" alt="${this.escapeHtml(group.name)}" onerror="this.src='assets/avatars/default-group.png'" />
        </div>

        <div class="group-card-content">
          <h3 class="group-card-name">${this.escapeHtml(group.name)}</h3>

          <div class="group-card-meta">
            <span class="group-meta-agents" title="Number of agents">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              ${group.agent_ids.length} agents
            </span>

            ${modeBadge}

            ${group.collaboration_mode === 'sequential' ? `
              <span class="group-meta-turns" title="Turn count">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                ${group.turn_count} turns
              </span>
            ` : ''}
          </div>

          ${group.speaking_rules ? `
            <div class="group-card-rules">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span class="rules-text" title="${this.escapeHtml(group.speaking_rules)}">
                ${this.truncate(group.speaking_rules, 50)}
              </span>
            </div>
          ` : ''}
        </div>

        <div class="group-card-actions">
          <button class="button-icon group-edit-btn" title="Edit Group" data-action="edit">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
          <button class="button-icon group-delete-btn" title="Delete Group" data-action="delete">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private getModeBadge(mode: 'sequential' | 'free'): string {
    if (mode === 'sequential') {
      return `
        <span class="group-mode-badge badge-sequential" title="Sequential mode: agents respond in turn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
          Sequential
        </span>
      `;
    } else {
      return `
        <span class="group-mode-badge badge-free" title="Free mode: agents respond based on relevance">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
          </svg>
          Free
        </span>
      `;
    }
  }

  private attachEventListeners(): void {
    const card = this.container.querySelector('.group-card') as HTMLElement;
    if (!card) return;

    // Edit button
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn && this.options.onEdit) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onEdit!(this.options.group);
      });
    }

    // Delete button
    const deleteBtn = card.querySelector('[data-action="delete"]');
    if (deleteBtn && this.options.onDelete) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onDelete!(this.options.group);
      });
    }

    // Card click
    if (this.options.onClick) {
      card.addEventListener('click', () => {
        this.options.onClick!(this.options.group);
      });
    }

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Update the card with new group data
  update(group: Group): void {
    this.options.group = group;
    this.render();
    this.attachEventListeners();
  }

  // Destroy the card
  destroy(): void {
    this.container.innerHTML = '';
  }
}
