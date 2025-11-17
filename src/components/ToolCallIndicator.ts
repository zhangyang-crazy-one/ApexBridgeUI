/**
 * ToolCallIndicator Component (US5-023)
 *
 * Shows tool execution status in the chat UI:
 * - Pending state (spinner)
 * - Success state (check mark)
 * - Error state (error icon)
 * - Tool name and parameters display
 */

import { VCPToolCall, VCPToolResult } from '../core/services/vcpProtocol';
import { t } from '../core/i18n/i18nHelper';

export type ToolCallStatus = 'pending' | 'success' | 'error';

export class ToolCallIndicator {
  private container: HTMLElement;
  private toolCall: VCPToolCall;
  private status: ToolCallStatus = 'pending';
  private result: VCPToolResult | null = null;

  constructor(toolCall: VCPToolCall) {
    this.toolCall = toolCall;
    this.container = document.createElement('div');
    this.render();
  }

  /**
   * Render the tool call indicator
   */
  private render(): void {
    this.container.className = `tool-call-indicator status-${this.status}`;
    this.container.dataset.toolName = this.toolCall.tool_name;

    this.container.innerHTML = `
      <div class="tool-call-header">
        <div class="tool-call-icon">
          ${this.getStatusIcon()}
        </div>

        <div class="tool-call-info">
          <div class="tool-call-title">
            <span class="tool-name">${this.toolCall.tool_name}</span>
            <span class="tool-maid">${t('toolCall.by')} ${this.toolCall.maid}</span>
          </div>
          <div class="tool-call-status-text">
            ${this.getStatusText()}
          </div>
        </div>

        <button type="button" class="tool-call-toggle" data-action="toggle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="6 9 12 15 18 9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="tool-call-details" style="display: none;">
        ${this.renderDetails()}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Get status icon SVG
   */
  private getStatusIcon(): string {
    switch (this.status) {
      case 'pending':
        return `
          <div class="spinner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        `;

      case 'success':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;

      case 'error':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke-width="2" stroke-linecap="round"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;
    }
  }

  /**
   * Get status text
   */
  private getStatusText(): string {
    switch (this.status) {
      case 'pending':
        return t('toolCall.executing');
      case 'success':
        return t('toolCall.completed');
      case 'error':
        return t('toolCall.failed');
    }
  }

  /**
   * Render details section
   */
  private renderDetails(): string {
    let html = '';

    // Parameters
    if (Object.keys(this.toolCall.parameters).length > 0) {
      html += `
        <div class="tool-call-section">
          <h5>${t('toolCall.parameters')}</h5>
          <div class="tool-call-params">
            ${this.renderParameters()}
          </div>
        </div>
      `;
    }

    // Result (if completed)
    if (this.result) {
      html += `
        <div class="tool-call-section">
          <h5>${t('toolCall.result')}</h5>
          <div class="tool-call-result">
            ${this.renderResult()}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render parameters
   */
  private renderParameters(): string {
    return Object.entries(this.toolCall.parameters)
      .map(([key, value]) => `
        <div class="tool-param">
          <span class="tool-param-key">${key}:</span>
          <span class="tool-param-value">${this.escapeHtml(value)}</span>
        </div>
      `)
      .join('');
  }

  /**
   * Render result
   */
  private renderResult(): string {
    if (!this.result) return '';

    if (this.result.status === 'error') {
      return `<pre class="tool-result-error">${this.escapeHtml(this.result.error || 'Unknown error')}</pre>`;
    }

    // Format result based on type
    if (typeof this.result.result === 'string') {
      return `<pre>${this.escapeHtml(this.result.result)}</pre>`;
    }

    // JSON result
    return `<pre>${this.escapeHtml(JSON.stringify(this.result.result, null, 2))}</pre>`;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const toggleBtn = this.container.querySelector('[data-action="toggle"]');
    const details = this.container.querySelector('.tool-call-details') as HTMLElement;

    toggleBtn?.addEventListener('click', () => {
      if (details.style.display === 'none') {
        details.style.display = 'block';
        toggleBtn.classList.add('expanded');
      } else {
        details.style.display = 'none';
        toggleBtn.classList.remove('expanded');
      }
    });
  }

  /**
   * Update status to success
   */
  public setSuccess(result: VCPToolResult): void {
    this.status = 'success';
    this.result = result;
    this.render();
  }

  /**
   * Update status to error
   */
  public setError(result: VCPToolResult): void {
    this.status = 'error';
    this.result = result;
    this.render();
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Get current status
   */
  public getStatus(): ToolCallStatus {
    return this.status;
  }
}
