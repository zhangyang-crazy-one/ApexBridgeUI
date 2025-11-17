// PLUGIN-032 to PLUGIN-037: Event Bus implementation
// Inter-plugin communication without direct references
// Provides publish-subscribe pattern with namespacing and latency tracking

/**
 * Event callback function type
 */
export type EventCallback = (data: any) => void | Promise<void>;

/**
 * Disposable interface for event listener cleanup
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Event subscription info for tracking
 */
interface EventSubscription {
  callback: EventCallback;
  pluginId?: string;
}

/**
 * PLUGIN-032 to PLUGIN-037: EventBus class
 * Manages event subscriptions and broadcasts with plugin namespace isolation
 */
export class EventBus {
  // PLUGIN-032: Map<event_name, Set<callback>>
  private listeners: Map<string, Set<EventSubscription>>;

  // PLUGIN-036: Latency tracking threshold (20ms)
  private readonly LATENCY_THRESHOLD_MS = 20;

  // Statistics for monitoring
  private eventStats: Map<string, { count: number; totalLatency: number }>;

  constructor() {
    this.listeners = new Map();
    this.eventStats = new Map();
  }

  /**
   * PLUGIN-033: Register event listener
   * @param eventName - Event name (supports namespacing: "plugin:eventName")
   * @param callback - Callback function to invoke when event is emitted
   * @param pluginId - Optional plugin ID for tracking
   * @returns Disposable for cleanup
   */
  on(eventName: string, callback: EventCallback, pluginId?: string): Disposable {
    // PLUGIN-037: Normalize event name with namespace
    const normalizedName = this.normalizeEventName(eventName, pluginId);

    if (!this.listeners.has(normalizedName)) {
      this.listeners.set(normalizedName, new Set());
    }

    const subscription: EventSubscription = { callback, pluginId };
    this.listeners.get(normalizedName)!.add(subscription);

    // Return disposable for cleanup
    return {
      dispose: () => this.off(eventName, callback, pluginId),
    };
  }

  /**
   * PLUGIN-034: Broadcast event to all subscribers
   * @param eventName - Event name to emit
   * @param data - Data to pass to subscribers
   */
  async emit(eventName: string, data?: any): Promise<void> {
    const normalizedName = this.normalizeEventName(eventName);
    const subscriptions = this.listeners.get(normalizedName);

    if (!subscriptions || subscriptions.size === 0) {
      return;
    }

    // PLUGIN-036: Track latency
    const startTime = performance.now();

    // PLUGIN-034: Broadcast to all subscribers asynchronously
    const promises: Promise<void>[] = [];

    for (const subscription of subscriptions) {
      const promise = this.invokeCallback(subscription.callback, data, eventName);
      promises.push(promise);
    }

    await Promise.all(promises);

    // PLUGIN-036: Check latency and warn if exceeds threshold
    const latency = performance.now() - startTime;
    this.trackEventLatency(eventName, latency);

    if (latency > this.LATENCY_THRESHOLD_MS) {
      console.warn(
        `[EventBus] Event "${eventName}" took ${latency.toFixed(2)}ms (threshold: ${this.LATENCY_THRESHOLD_MS}ms)`
      );
    }
  }

  /**
   * PLUGIN-035: Unregister event listener
   * @param eventName - Event name
   * @param callback - Callback to remove
   * @param pluginId - Optional plugin ID
   */
  off(eventName: string, callback: EventCallback, pluginId?: string): void {
    const normalizedName = this.normalizeEventName(eventName, pluginId);
    const subscriptions = this.listeners.get(normalizedName);

    if (!subscriptions) {
      return;
    }

    // Find and remove matching subscription
    for (const subscription of subscriptions) {
      if (subscription.callback === callback) {
        subscriptions.delete(subscription);
        break;
      }
    }

    // Clean up empty event entries
    if (subscriptions.size === 0) {
      this.listeners.delete(normalizedName);
    }
  }

  /**
   * Remove all listeners for a specific event
   * @param eventName - Event name to clear
   */
  clear(eventName: string): void {
    const normalizedName = this.normalizeEventName(eventName);
    this.listeners.delete(normalizedName);
  }

  /**
   * Remove all listeners for a specific plugin
   * Useful for cleanup when plugin is deactivated
   * @param pluginId - Plugin ID
   */
  clearPlugin(pluginId: string): void {
    for (const [eventName, subscriptions] of this.listeners.entries()) {
      for (const subscription of subscriptions) {
        if (subscription.pluginId === pluginId) {
          subscriptions.delete(subscription);
        }
      }

      // Clean up empty event entries
      if (subscriptions.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Get listener count for an event
   * @param eventName - Event name
   * @returns Number of listeners
   */
  getListenerCount(eventName: string): number {
    const normalizedName = this.normalizeEventName(eventName);
    return this.listeners.get(normalizedName)?.size ?? 0;
  }

  /**
   * Get all event names that have listeners
   * @returns Array of event names
   */
  getEventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get event statistics for monitoring
   * @param eventName - Event name
   * @returns Statistics or null
   */
  getEventStats(eventName: string): { count: number; avgLatency: number } | null {
    const stats = this.eventStats.get(eventName);
    if (!stats) return null;

    return {
      count: stats.count,
      avgLatency: stats.count > 0 ? stats.totalLatency / stats.count : 0,
    };
  }

  /**
   * PLUGIN-037: Normalize event name with namespace
   * Ensures plugin events are properly namespaced to prevent conflicts
   * @param eventName - Event name
   * @param pluginId - Optional plugin ID
   * @returns Normalized event name
   */
  private normalizeEventName(eventName: string, pluginId?: string): string {
    // If event name already has namespace (contains ":"), use as-is
    if (eventName.includes(':')) {
      return eventName;
    }

    // If plugin ID is provided and event doesn't have namespace, add it
    if (pluginId) {
      return `${pluginId}:${eventName}`;
    }

    // Otherwise, use event name as-is (global event)
    return eventName;
  }

  /**
   * Invoke callback with error handling
   * @param callback - Callback to invoke
   * @param data - Data to pass
   * @param eventName - Event name for error logging
   */
  private async invokeCallback(
    callback: EventCallback,
    data: any,
    eventName: string
  ): Promise<void> {
    try {
      await callback(data);
    } catch (error) {
      console.error(`[EventBus] Error in event handler for "${eventName}":`, error);
    }
  }

  /**
   * PLUGIN-036: Track event latency for monitoring
   * @param eventName - Event name
   * @param latency - Latency in milliseconds
   */
  private trackEventLatency(eventName: string, latency: number): void {
    const stats = this.eventStats.get(eventName) ?? { count: 0, totalLatency: 0 };
    stats.count++;
    stats.totalLatency += latency;
    this.eventStats.set(eventName, stats);
  }

  /**
   * Clear all statistics
   */
  clearStats(): void {
    this.eventStats.clear();
  }
}

// Global singleton instance
export const eventBus = new EventBus();
