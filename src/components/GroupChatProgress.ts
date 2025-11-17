/**
 * GroupChatProgress Component - Shows progress bar for multi-turn conversations
 * Displays current turn, total turns, and completion percentage
 */

export interface GroupChatProgressOptions {
  currentTurn: number;         // Current turn number (1-based)
  totalTurns: number;          // Total number of turns
  agentCount: number;          // Number of agents in the group
  completedAgents: number;     // Number of agents completed in current turn
}

export class GroupChatProgress {
  private container: HTMLElement;
  private options: GroupChatProgressOptions;

  constructor(container: HTMLElement, options: GroupChatProgressOptions) {
    this.container = container;
    this.options = options;
    this.render();
  }

  render(): void {
    const { currentTurn, totalTurns, agentCount, completedAgents } = this.options;

    // Calculate overall progress percentage
    const totalMessages = totalTurns * agentCount;
    const completedMessages = (currentTurn - 1) * agentCount + completedAgents;
    const progressPercentage = Math.min(100, (completedMessages / totalMessages) * 100);

    // Calculate current turn progress
    const turnProgressPercentage = (completedAgents / agentCount) * 100;

    this.container.innerHTML = `
      <div class="group-chat-progress">
        <div class="progress-header">
          <div class="progress-label">
            <span class="progress-turn">Turn ${currentTurn} of ${totalTurns}</span>
            <span class="progress-agents">(${completedAgents}/${agentCount} agents completed)</span>
          </div>
          <div class="progress-percentage">${Math.round(progressPercentage)}%</div>
        </div>

        <!-- Overall progress bar -->
        <div class="progress-bar-container">
          <div class="progress-bar-bg">
            <div
              class="progress-bar-fill"
              style="width: ${progressPercentage}%"
              role="progressbar"
              aria-valuenow="${progressPercentage}"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </div>

        <!-- Current turn progress (mini bars for each agent) -->
        <div class="progress-turn-indicators">
          ${Array.from({ length: agentCount }, (_, index) => `
            <div class="turn-indicator ${index < completedAgents ? 'completed' : ''}"
                 title="Agent ${index + 1}">
              <div class="turn-indicator-fill"></div>
            </div>
          `).join('')}
        </div>

        <!-- Turn navigation -->
        <div class="progress-turn-nav">
          ${Array.from({ length: totalTurns }, (_, index) => `
            <div class="turn-dot ${index + 1 === currentTurn ? 'active' : ''} ${index + 1 < currentTurn ? 'completed' : ''}"
                 title="Turn ${index + 1}">
              ${index + 1 < currentTurn ?
                `<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>` :
                `<span>${index + 1}</span>`}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Update progress
   */
  updateProgress(currentTurn: number, completedAgents: number): void {
    this.options.currentTurn = currentTurn;
    this.options.completedAgents = completedAgents;

    // Calculate progress
    const { totalTurns, agentCount } = this.options;
    const totalMessages = totalTurns * agentCount;
    const completedMessages = (currentTurn - 1) * agentCount + completedAgents;
    const progressPercentage = Math.min(100, (completedMessages / totalMessages) * 100);

    // Update progress bar
    const progressBar = this.container.querySelector('.progress-bar-fill') as HTMLElement;
    if (progressBar) {
      progressBar.style.width = `${progressPercentage}%`;
      progressBar.setAttribute('aria-valuenow', progressPercentage.toString());
    }

    // Update percentage text
    const percentageElement = this.container.querySelector('.progress-percentage');
    if (percentageElement) {
      percentageElement.textContent = `${Math.round(progressPercentage)}%`;
    }

    // Update turn text
    const turnElement = this.container.querySelector('.progress-turn');
    if (turnElement) {
      turnElement.textContent = `Turn ${currentTurn} of ${totalTurns}`;
    }

    // Update agents text
    const agentsElement = this.container.querySelector('.progress-agents');
    if (agentsElement) {
      agentsElement.textContent = `(${completedAgents}/${agentCount} agents completed)`;
    }

    // Update turn indicators
    const turnIndicators = this.container.querySelectorAll('.turn-indicator');
    turnIndicators.forEach((indicator, index) => {
      if (index < completedAgents) {
        indicator.classList.add('completed');
      } else {
        indicator.classList.remove('completed');
      }
    });

    // Update turn dots
    const turnDots = this.container.querySelectorAll('.turn-dot');
    turnDots.forEach((dot, index) => {
      const turnNumber = index + 1;
      if (turnNumber === currentTurn) {
        dot.classList.add('active');
        dot.classList.remove('completed');
      } else if (turnNumber < currentTurn) {
        dot.classList.remove('active');
        dot.classList.add('completed');
      } else {
        dot.classList.remove('active');
        dot.classList.remove('completed');
      }
    });
  }

  /**
   * Mark as complete
   */
  markComplete(): void {
    const progressBar = this.container.querySelector('.progress-bar-fill') as HTMLElement;
    if (progressBar) {
      progressBar.style.width = '100%';
      progressBar.setAttribute('aria-valuenow', '100');
      progressBar.classList.add('complete');
    }

    const percentageElement = this.container.querySelector('.progress-percentage');
    if (percentageElement) {
      percentageElement.textContent = '100%';
    }

    // Add completion animation
    this.container.classList.add('completed');

    // Optional: Add confetti or celebration effect
    setTimeout(() => {
      this.container.classList.add('celebration');
    }, 300);
  }

  /**
   * Show/hide the progress bar
   */
  setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Reset progress
   */
  reset(): void {
    this.options.currentTurn = 1;
    this.options.completedAgents = 0;
    this.container.classList.remove('completed', 'celebration');
    this.render();
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}

/**
 * Render group chat progress to HTML string
 */
export function renderGroupChatProgressHTML(options: GroupChatProgressOptions): string {
  const { currentTurn, totalTurns, agentCount, completedAgents } = options;

  // Calculate progress
  const totalMessages = totalTurns * agentCount;
  const completedMessages = (currentTurn - 1) * agentCount + completedAgents;
  const progressPercentage = Math.min(100, (completedMessages / totalMessages) * 100);

  return `
    <div class="group-chat-progress">
      <div class="progress-header">
        <div class="progress-label">
          <span class="progress-turn">Turn ${currentTurn} of ${totalTurns}</span>
          <span class="progress-agents">(${completedAgents}/${agentCount} agents completed)</span>
        </div>
        <div class="progress-percentage">${Math.round(progressPercentage)}%</div>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            style="width: ${progressPercentage}%"
            role="progressbar"
            aria-valuenow="${progressPercentage}"
            aria-valuemin="0"
            aria-valuemax="100"
          ></div>
        </div>
      </div>

      <div class="progress-turn-indicators">
        ${Array.from({ length: agentCount }, (_, index) => `
          <div class="turn-indicator ${index < completedAgents ? 'completed' : ''}"
               title="Agent ${index + 1}">
            <div class="turn-indicator-fill"></div>
          </div>
        `).join('')}
      </div>

      <div class="progress-turn-nav">
        ${Array.from({ length: totalTurns }, (_, index) => `
          <div class="turn-dot ${index + 1 === currentTurn ? 'active' : ''} ${index + 1 < currentTurn ? 'completed' : ''}"
               title="Turn ${index + 1}">
            ${index + 1 < currentTurn ?
              `<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>` :
              `<span>${index + 1}</span>`}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
