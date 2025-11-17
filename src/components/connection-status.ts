/**
 * Connection Status Indicator (CORE-062)
 *
 * Visual indicator showing connection status to VCPToolBox backend
 *
 * Responsibilities:
 * - Display API connection status (from ApiClient)
 * - Display WebSocket connection status (from WebSocketClient)
 * - Visual indicators: connected (green), connecting (yellow), disconnected (gray), error (red)
 * - Tooltip with detailed connection information
 * - Click to test connection
 * - Auto-refresh status every 30 seconds
 *
 * Features:
 * - Dual status display (API + WebSocket)
 * - Real-time status updates via events
 * - Connection test button
 * - Status tooltip with backend URL
 * - Color-coded indicators (Anthropic design system)
 * - Smooth transitions
 *
 * Usage:
 * ```typescript
 * import { ConnectionStatusIndicator } from './components/connection-status';
 *
 * const statusIndicator = new ConnectionStatusIndicator();
 * document.querySelector('.titlebar').appendChild(statusIndicator.render());
 * ```
 */

import { ApiClient, ConnectionStatus as ApiConnectionStatus } from '../core/services/apiClient';
import { WebSocketClient, WebSocketState } from '../core/services/websocketClient';

/**
 * Combined connection status
 */
interface ConnectionState {
  api: ApiConnectionStatus;
  websocket: WebSocketState;
  lastChecked: Date;
}

/**
 * Connection Status Indicator Component
 */
export class ConnectionStatusIndicator {
  private apiClient: ApiClient;
  private wsClient: WebSocketClient | null = null;
  private element: HTMLElement | null = null;
  private state: ConnectionState;
  private refreshTimer: number | null = null;

  constructor() {
    this.apiClient = ApiClient.getInstance();

    try {
      // WebSocket client may not be initialized yet
      const { getWebSocketClient } = require('../core/services/websocketClient');
      this.wsClient = getWebSocketClient();
    } catch {
      console.log('[ConnectionStatus] WebSocket client not initialized yet');
    }

    this.state = {
      api: this.apiClient.getConnectionStatus(),
      websocket: this.wsClient?.getState() || WebSocketState.DISCONNECTED,
      lastChecked: new Date()
    };

    this.setupEventListeners();
  }

  /**
   * Render the connection status indicator
   */
  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'connection-status-indicator';
    container.innerHTML = `
      <button class="connection-status-btn" title="Connection Status">
        <svg class="connection-icon" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <circle class="api-status" cx="7" cy="10" r="4" />
          <circle class="ws-status" cx="13" cy="10" r="4" />
        </svg>
      </button>

      <div class="connection-status-tooltip">
        <div class="connection-status-header">
          <span class="connection-status-title">Connection Status</span>
          <button class="connection-test-btn" title="Test Connection">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.65 6.35A7.96 7.96 0 0010 2a7.96 7.96 0 00-7.65 4.35c-.4.87-.5 1.83-.27 2.73.23.9.75 1.73 1.5 2.37.75.64 1.68 1.05 2.66 1.17.98.13 1.96-.05 2.82-.51.86-.46 1.56-1.15 2.03-2 .47-.85.68-1.81.6-2.77-.08-.96-.47-1.87-1.12-2.58l-1.42 1.42c.39.42.65.96.74 1.54.08.58-.02 1.17-.3 1.69-.27.52-.7.95-1.22 1.21-.52.26-1.1.35-1.66.26-.56-.09-1.08-.35-1.48-.74-.4-.39-.66-.9-.75-1.45-.08-.55.01-1.12.27-1.63.26-.51.67-.93 1.17-1.2.5-.27 1.07-.37 1.63-.3.56.08 1.1.32 1.52.71l1.42-1.42c-.71-.65-1.62-1.04-2.58-1.12-.96-.08-1.92.13-2.77.6-.85.47-1.54 1.17-2 2.03-.46.86-.64 1.84-.51 2.82.12.98.53 1.91 1.17 2.66.64.75 1.47 1.27 2.37 1.5.9.23 1.86.13 2.73-.27A7.96 7.96 0 0018 10a7.96 7.96 0 00-.35-3.65z"/>
            </svg>
          </button>
        </div>
        <div class="connection-status-body">
          <div class="connection-item">
            <span class="connection-label">API:</span>
            <span class="connection-value api-status-text"></span>
          </div>
          <div class="connection-item">
            <span class="connection-label">WebSocket:</span>
            <span class="connection-value ws-status-text"></span>
          </div>
          <div class="connection-item">
            <span class="connection-label">Last checked:</span>
            <span class="connection-value last-checked-text"></span>
          </div>
        </div>
      </div>
    `;

    this.element = container;
    this.updateVisuals();
    this.attachEventListeners();
    this.startAutoRefresh();

    return container;
  }

  /**
   * Update visual indicators based on current state
   */
  private updateVisuals(): void {
    if (!this.element) return;

    const apiStatusCircle = this.element.querySelector('.api-status') as SVGCircleElement;
    const wsStatusCircle = this.element.querySelector('.ws-status') as SVGCircleElement;
    const apiStatusText = this.element.querySelector('.api-status-text') as HTMLSpanElement;
    const wsStatusText = this.element.querySelector('.ws-status-text') as HTMLSpanElement;
    const lastCheckedText = this.element.querySelector('.last-checked-text') as HTMLSpanElement;

    // Update API status
    apiStatusCircle.style.fill = this.getStatusColor(this.state.api);
    apiStatusText.textContent = this.getStatusLabel(this.state.api);
    apiStatusText.style.color = this.getStatusColor(this.state.api);

    // Update WebSocket status
    wsStatusCircle.style.fill = this.getWsStatusColor(this.state.websocket);
    wsStatusText.textContent = this.getWsStatusLabel(this.state.websocket);
    wsStatusText.style.color = this.getWsStatusColor(this.state.websocket);

    // Update last checked time
    lastCheckedText.textContent = this.formatTime(this.state.lastChecked);
  }

  /**
   * Get color for API connection status
   */
  private getStatusColor(status: ApiConnectionStatus): string {
    switch (status) {
      case ApiConnectionStatus.Connected:
        return '#28a745'; // Green
      case ApiConnectionStatus.Connecting:
        return '#ffc107'; // Yellow
      case ApiConnectionStatus.Error:
        return '#dc3545'; // Red
      case ApiConnectionStatus.Disconnected:
      default:
        return '#999999'; // Gray
    }
  }

  /**
   * Get label for API connection status
   */
  private getStatusLabel(status: ApiConnectionStatus): string {
    switch (status) {
      case ApiConnectionStatus.Connected:
        return 'Connected';
      case ApiConnectionStatus.Connecting:
        return 'Connecting...';
      case ApiConnectionStatus.Error:
        return 'Error';
      case ApiConnectionStatus.Disconnected:
      default:
        return 'Disconnected';
    }
  }

  /**
   * Get color for WebSocket connection status
   */
  private getWsStatusColor(status: WebSocketState): string {
    switch (status) {
      case WebSocketState.CONNECTED:
        return '#28a745'; // Green
      case WebSocketState.CONNECTING:
        return '#ffc107'; // Yellow
      case WebSocketState.ERROR:
        return '#dc3545'; // Red
      case WebSocketState.DISCONNECTED:
      default:
        return '#999999'; // Gray
    }
  }

  /**
   * Get label for WebSocket connection status
   */
  private getWsStatusLabel(status: WebSocketState): string {
    switch (status) {
      case WebSocketState.CONNECTED:
        return 'Connected';
      case WebSocketState.CONNECTING:
        return 'Connecting...';
      case WebSocketState.ERROR:
        return 'Error';
      case WebSocketState.DISCONNECTED:
      default:
        return 'Disconnected';
    }
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleTimeString();
  }

  /**
   * Setup event listeners for connection status changes
   */
  private setupEventListeners(): void {
    window.addEventListener('connection-status-changed', ((e: CustomEvent) => {
      this.state.api = e.detail.status;
      this.state.lastChecked = new Date();
      this.updateVisuals();
    }) as EventListener);

    // WebSocket state change listener
    if (this.wsClient) {
      this.wsClient.on({
        onStateChange: (state: WebSocketState) => {
          this.state.websocket = state;
          this.state.lastChecked = new Date();
          this.updateVisuals();
        }
      });
    }
  }

  /**
   * Attach click event listeners
   */
  private attachEventListeners(): void {
    if (!this.element) return;

    const btn = this.element.querySelector('.connection-status-btn');
    const tooltip = this.element.querySelector('.connection-status-tooltip');
    const testBtn = this.element.querySelector('.connection-test-btn');

    // Toggle tooltip
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltip?.classList.toggle('active');
    });

    // Close tooltip when clicking outside
    document.addEventListener('click', () => {
      tooltip?.classList.remove('active');
    });

    // Test connection
    testBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.testConnection();
    });
  }

  /**
   * Test connection to backend
   */
  private async testConnection(): Promise<void> {
    console.log('[ConnectionStatus] Testing connection...');

    const testBtn = this.element?.querySelector('.connection-test-btn') as HTMLButtonElement;
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.style.opacity = '0.5';
    }

    try {
      await this.apiClient.testConnection();
      this.state.lastChecked = new Date();
      this.updateVisuals();
    } catch (error) {
      console.error('[ConnectionStatus] Connection test failed:', error);
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.style.opacity = '1';
      }
    }
  }

  /**
   * Start auto-refresh timer (every 30 seconds)
   */
  private startAutoRefresh(): void {
    this.refreshTimer = window.setInterval(() => {
      this.state.api = this.apiClient.getConnectionStatus();
      this.state.websocket = this.wsClient?.getState() || WebSocketState.DISCONNECTED;
      this.updateVisuals();
    }, 30000); // 30 seconds
  }

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Cleanup and destroy component
   */
  public destroy(): void {
    this.stopAutoRefresh();
    this.element?.remove();
    this.element = null;
  }
}

/**
 * Initialize connection status indicator
 */
export function initConnectionStatusIndicator(): ConnectionStatusIndicator {
  return new ConnectionStatusIndicator();
}
