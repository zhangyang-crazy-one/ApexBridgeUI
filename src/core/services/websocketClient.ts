/**
 * WebSocket Client (CORE-061)
 *
 * Real-time Notifications Client with Auto-Reconnection
 *
 * Features:
 * - WebSocket connection to VCPToolBox for real-time notifications
 * - Automatic reconnection with exponential backoff
 * - Integration with SettingsManager for dynamic configuration
 * - Heartbeat mechanism to keep connection alive
 * - Type-safe message handling
 * - Connection state tracking and events
 *
 * Enhancements for CORE-061:
 * - Dynamic URL and key from SettingsManager
 * - Connection status integration with CORE-062
 * - Automatic reconnection on settings change
 */

import type { Notification } from '@core/models/notification';
import { SettingsManager } from '../managers/settingsManager';

/**
 * WebSocket Connection State
 */
export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * WebSocket Message Types
 */
export interface WebSocketMessage {
  type: 'notification' | 'status' | 'plugin_complete' | 'error';
  data: any;
  timestamp?: string;
}

/**
 * WebSocket Configuration (legacy, kept for backward compatibility)
 */
export interface WebSocketConfig {
  url: string;
  key: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

/**
 * WebSocket Event Handlers
 */
export interface WebSocketEventHandlers {
  onNotification?: (notification: Notification) => void;
  onPluginComplete?: (data: any) => void;
  onStateChange?: (state: WebSocketState) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket Client with automatic reconnection
 */
export class WebSocketClient {
  private config: WebSocketConfig;
  private ws: WebSocket | null = null;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private handlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private shouldReconnect = true;
  private settingsManager: SettingsManager;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };
    this.settingsManager = SettingsManager.getInstance();
  }

  /**
   * Get WebSocket URL from settings (with fallback to config)
   */
  private getWebSocketUrl(): string {
    const settings = this.settingsManager.getSettings();
    return settings.websocket_url || this.config.url;
  }

  /**
   * Get WebSocket key from settings (with fallback to config)
   */
  private getWebSocketKey(): string {
    const settings = this.settingsManager.getSettings();
    return settings.websocket_key || this.config.key;
  }

  /**
   * Connect to WebSocket server
   * Now uses dynamic URL and key from SettingsManager
   */
  connect(): void {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      console.warn('WebSocket already connected or connecting');
      return;
    }

    this.shouldReconnect = true;
    this.setState(WebSocketState.CONNECTING);

    try {
      // Get current URL and key from settings
      const url = this.getWebSocketUrl();
      const key = this.getWebSocketKey();

      if (!url) {
        throw new Error('WebSocket URL not configured in settings');
      }

      // If key is provided and URL doesn't already contain it, add as query parameter
      // Otherwise, use URL as-is (key might be embedded in path like /VCPlog/VCP_Key=xxx)
      let wsUrl = url;
      if (key && !url.includes('VCP_Key=')) {
        const urlObj = new URL(url);
        urlObj.searchParams.set('key', key);
        wsUrl = urlObj.toString();
      }

      console.log('[WebSocketClient] Connecting to:', wsUrl.replace(/VCP_Key=\w+/, 'VCP_Key=***'));
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(new Error(`Failed to create WebSocket: ${error}`));
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState(WebSocketState.DISCONNECTED);
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (this.state !== WebSocketState.CONNECTED || !this.ws) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      this.handleError(new Error(`Failed to send message: ${error}`));
    }
  }

  /**
   * Register event handlers
   */
  on(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.setState(WebSocketState.CONNECTED);
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.handleError(new Error('WebSocket connection error'));
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      this.cleanup();
      this.setState(WebSocketState.DISCONNECTED);

      // Reconnect if not explicitly disconnected
      if (this.shouldReconnect && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'notification':
        if (this.handlers.onNotification) {
          this.handlers.onNotification(message.data as Notification);
        }
        break;

      case 'plugin_complete':
        if (this.handlers.onPluginComplete) {
          this.handlers.onPluginComplete(message.data);
        }
        break;

      case 'error':
        this.handleError(new Error(message.data?.message || 'Server error'));
        break;

      case 'status':
        // Handle status updates (heartbeat, etc.)
        console.debug('WebSocket status:', message.data);
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('Max reconnection attempts reached');
      this.handleError(new Error('Failed to reconnect after maximum attempts'));
      this.shouldReconnect = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateBackoff(this.reconnectAttempts);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.config.reconnectInterval!;
    const maxDelay = 30000; // Max 30 seconds
    const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), maxDelay);
    return delay;
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = window.setInterval(() => {
      if (this.state === WebSocketState.CONNECTED) {
        this.send({
          type: 'status',
          data: { ping: Date.now() },
        });
      }
    }, this.config.heartbeatInterval!);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Update connection state and notify handlers
   */
  private setState(state: WebSocketState): void {
    if (this.state === state) return;

    this.state = state;

    if (this.handlers.onStateChange) {
      this.handlers.onStateChange(state);
    }
  }

  /**
   * Handle errors and notify handlers
   */
  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    this.setState(WebSocketState.ERROR);

    if (this.handlers.onError) {
      this.handlers.onError(error);
    }
  }

  /**
   * Cleanup timers and resources
   */
  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Update WebSocket configuration
   */
  updateConfig(config: Partial<WebSocketConfig>): void {
    const needsReconnect = this.isConnected() && (
      config.url !== undefined && config.url !== this.config.url ||
      config.key !== undefined && config.key !== this.config.key
    );

    this.config = { ...this.config, ...config };

    if (needsReconnect) {
      this.disconnect();
      setTimeout(() => this.connect(), 100);
    }
  }
}

/**
 * Singleton WebSocket client instance
 */
let wsClientInstance: WebSocketClient | null = null;

/**
 * Initialize WebSocket client with configuration
 */
export function initWebSocketClient(config: WebSocketConfig): WebSocketClient {
  // Disconnect existing client if any
  if (wsClientInstance) {
    wsClientInstance.disconnect();
  }

  wsClientInstance = new WebSocketClient(config);
  return wsClientInstance;
}

/**
 * Get the singleton WebSocket client instance
 */
export function getWebSocketClient(): WebSocketClient {
  if (!wsClientInstance) {
    throw new Error('WebSocket client not initialized. Call initWebSocketClient() first.');
  }
  return wsClientInstance;
}

/**
 * Auto-connect WebSocket if configuration is available
 */
export function autoConnectWebSocket(config: WebSocketConfig): void {
  const client = initWebSocketClient(config);
  client.connect();
}
