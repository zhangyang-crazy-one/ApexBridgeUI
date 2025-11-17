/**
 * GroupChatIndicator Component - Shows current speaker in sequential mode
 * Displays which agent is currently responding with visual indicator
 */

export interface GroupChatIndicatorOptions {
  currentSpeakerId: string;
  currentSpeakerName: string;
  agentNames: string[];          // All agent names in order
  currentAgentIndex: number;     // Index of current speaker (0-based)
}

export class GroupChatIndicator {
  private container: HTMLElement;
  private options: GroupChatIndicatorOptions;

  constructor(container: HTMLElement, options: GroupChatIndicatorOptions) {
    this.container = container;
    this.options = options;
    this.render();
  }

  render(): void {
    const { currentSpeakerName, agentNames, currentAgentIndex } = this.options;

    this.container.innerHTML = `
      <div class="group-chat-indicator">
        <div class="indicator-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="indicator-content">
          <div class="indicator-label">Currently Speaking:</div>
          <div class="indicator-speaker">${this.escapeHtml(currentSpeakerName)}</div>
        </div>
        <div class="indicator-agents">
          ${agentNames.map((name, index) => `
            <div class="indicator-agent ${index === currentAgentIndex ? 'active' : ''}" title="${this.escapeHtml(name)}">
              ${name.charAt(0).toUpperCase()}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Update the current speaker
   */
  updateSpeaker(speakerName: string, agentIndex: number): void {
    this.options.currentSpeakerName = speakerName;
    this.options.currentAgentIndex = agentIndex;

    // Update speaker name
    const speakerElement = this.container.querySelector('.indicator-speaker');
    if (speakerElement) {
      speakerElement.textContent = speakerName;
    }

    // Update active agent indicator
    const agentIndicators = this.container.querySelectorAll('.indicator-agent');
    agentIndicators.forEach((indicator, index) => {
      if (index === agentIndex) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });
  }

  /**
   * Show/hide the indicator
   */
  setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.innerHTML = '';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Render group chat indicator to HTML string
 */
export function renderGroupChatIndicatorHTML(options: GroupChatIndicatorOptions): string {
  const { currentSpeakerName, agentNames, currentAgentIndex } = options;

  return `
    <div class="group-chat-indicator">
      <div class="indicator-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="indicator-content">
        <div class="indicator-label">Currently Speaking:</div>
        <div class="indicator-speaker">${escapeHtmlForIndicator(currentSpeakerName)}</div>
      </div>
      <div class="indicator-agents">
        ${agentNames.map((name, index) => `
          <div class="indicator-agent ${index === currentAgentIndex ? 'active' : ''}" title="${escapeHtmlForIndicator(name)}">
            ${name.charAt(0).toUpperCase()}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function escapeHtmlForIndicator(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
