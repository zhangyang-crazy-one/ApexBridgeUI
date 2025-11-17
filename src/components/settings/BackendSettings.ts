/**
 * BackendSettings Tab Component (US5-003)
 *
 * Provides configuration for VCPToolBox backend connectivity:
 * - API URL
 * - API Key (Bearer token)
 * - WebSocket URL
 * - WebSocket Key
 */

import { GlobalSettings } from '../../core/models/settings';
import { t } from '../../core/i18n/i18nManager';

export class BackendSettings {
  private container: HTMLElement;
  private settings: GlobalSettings;

  constructor(container: HTMLElement, settings: GlobalSettings) {
    this.container = container;
    this.settings = settings;
    this.render();
  }

  /**
   * Render the backend settings tab
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="settings-section">
        <h3>${t('settings.backend.apiConfiguration')}</h3>

        <!-- API URL -->
        <div class="settings-field">
          <label for="backend-url">${t('settings.backend.apiUrl')}</label>
          <input
            type="url"
            id="backend-url"
            value="${this.settings.backend_url}"
            placeholder="http://localhost:6005/v1/chat/completions"
          />
          <p class="field-description">${t('settings.backend.apiUrlHint')}</p>
        </div>

        <!-- API Key -->
        <div class="settings-field">
          <label for="api-key">${t('settings.backend.apiKey')}</label>
          <div class="input-with-button">
            <input
              type="password"
              id="api-key"
              value="${this.settings.api_key}"
              placeholder="${t('settings.backend.apiKeyPlaceholder')}"
            />
            <button type="button" class="btn-icon" id="toggle-api-key-visibility">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke-width="2"/>
              </svg>
            </button>
          </div>
          <p class="field-description">${t('settings.backend.apiKeyHint')}</p>
        </div>

        <!-- Test Connection Button -->
        <div class="settings-field">
          <button type="button" class="btn-secondary" id="test-connection-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${t('settings.backend.testConnection')}
          </button>
          <div id="connection-status" class="connection-status"></div>
        </div>
      </div>

      <div class="settings-section">
        <h3>${t('settings.backend.websocketConfiguration')}</h3>

        <!-- WebSocket URL -->
        <div class="settings-field">
          <label for="websocket-url">${t('settings.backend.websocketUrl')}</label>
          <input
            type="url"
            id="websocket-url"
            value="${this.settings.websocket_url || ''}"
            placeholder="ws://localhost:6005"
          />
          <p class="field-description">${t('settings.backend.websocketUrlHint')}</p>
        </div>

        <!-- WebSocket Key -->
        <div class="settings-field">
          <label for="websocket-key">${t('settings.backend.websocketKey')}</label>
          <div class="input-with-button">
            <input
              type="password"
              id="websocket-key"
              value="${this.settings.websocket_key || ''}"
              placeholder="${t('settings.backend.websocketKeyPlaceholder')}"
            />
            <button type="button" class="btn-icon" id="toggle-ws-key-visibility">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke-width="2"/>
              </svg>
            </button>
          </div>
          <p class="field-description">${t('settings.backend.websocketKeyHint')}</p>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Toggle API key visibility
    const toggleApiKeyBtn = this.container.querySelector('#toggle-api-key-visibility');
    const apiKeyInput = this.container.querySelector('#api-key') as HTMLInputElement;

    toggleApiKeyBtn?.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
      } else {
        apiKeyInput.type = 'password';
      }
    });

    // Toggle WebSocket key visibility
    const toggleWsKeyBtn = this.container.querySelector('#toggle-ws-key-visibility');
    const wsKeyInput = this.container.querySelector('#websocket-key') as HTMLInputElement;

    toggleWsKeyBtn?.addEventListener('click', () => {
      if (wsKeyInput.type === 'password') {
        wsKeyInput.type = 'text';
      } else {
        wsKeyInput.type = 'password';
      }
    });

    // Test connection button
    const testBtn = this.container.querySelector('#test-connection-btn');
    testBtn?.addEventListener('click', () => this.testConnection());
  }

  /**
   * Test connection to VCPToolBox backend
   */
  private async testConnection(): Promise<void> {
    const statusEl = this.container.querySelector('#connection-status');
    if (!statusEl) return;

    // Get current values from form
    const backendUrl = (this.container.querySelector('#backend-url') as HTMLInputElement).value.trim();
    const apiKey = (this.container.querySelector('#api-key') as HTMLInputElement).value.trim();

    if (!backendUrl || !apiKey) {
      this.showConnectionStatus('error', t('settings.backend.missingCredentials'));
      return;
    }

    // Show loading state
    this.showConnectionStatus('loading', t('settings.backend.testing'));

    try {
      // Send a minimal ChatCompletion request to test connectivity
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'test',
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          max_tokens: 1
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok || response.status === 400) {
        // 200 OK or 400 (model not found) both indicate server is reachable
        this.showConnectionStatus('success', t('settings.backend.connectionSuccess'));
      } else if (response.status === 401) {
        this.showConnectionStatus('error', t('settings.backend.authenticationFailed'));
      } else {
        this.showConnectionStatus('error', `${t('settings.backend.connectionFailed')}: HTTP ${response.status}`);
      }

    } catch (error) {
      console.error('Connection test failed:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        this.showConnectionStatus('error', t('settings.backend.networkError'));
      } else {
        this.showConnectionStatus('error', t('settings.backend.connectionTimeout'));
      }
    }
  }

  /**
   * Show connection status message
   */
  private showConnectionStatus(type: 'loading' | 'success' | 'error', message: string): void {
    const statusEl = this.container.querySelector('#connection-status');
    if (!statusEl) return;

    statusEl.className = `connection-status status-${type}`;

    let icon = '';
    if (type === 'loading') {
      icon = '<div class="spinner"></div>';
    } else if (type === 'success') {
      icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke-width="2" stroke-linecap="round"/></svg>';
    }

    statusEl.innerHTML = `${icon}<span>${message}</span>`;
  }

  /**
   * Get updated settings from form
   */
  public getSettings(): Partial<GlobalSettings> {
    const backendUrlInput = this.container.querySelector('#backend-url') as HTMLInputElement;
    const apiKeyInput = this.container.querySelector('#api-key') as HTMLInputElement;
    const websocketUrlInput = this.container.querySelector('#websocket-url') as HTMLInputElement;
    const websocketKeyInput = this.container.querySelector('#websocket-key') as HTMLInputElement;

    return {
      backend_url: backendUrlInput.value.trim(),
      api_key: apiKeyInput.value.trim(),
      websocket_url: websocketUrlInput.value.trim() || undefined,
      websocket_key: websocketKeyInput.value.trim() || undefined
    };
  }
}
