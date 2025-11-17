/**
 * Logger Utility for VCPChat Frontend
 *
 * Provides a unified logging interface that forwards console logs to the Rust backend
 * for centralized terminal logging in development mode.
 *
 * US6-016: Frontend console.log forwarding to Rust logs
 */

import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogOptions {
  source?: string; // Source component/module name
  data?: any; // Additional data to log
}

/**
 * Check if we're running in Tauri environment
 */
function isTauriEnv(): boolean {
  // @ts-ignore - __TAURI__ is injected by Tauri
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

/**
 * Forward log message to Rust backend
 */
async function forwardToRust(
  level: LogLevel,
  message: string,
  options?: LogOptions
): Promise<void> {
  if (!isTauriEnv()) {
    // Running in browser (web debug mirror), no Tauri commands available
    return;
  }

  try {
    await invoke('log_message', {
      level,
      message: options?.data ? `${message} | Data: ${JSON.stringify(options.data)}` : message,
      source: options?.source,
    });
  } catch (error) {
    // Fallback to console if Tauri command fails
    console.error('[Logger] Failed to forward log to Rust:', error);
  }
}

/**
 * Logger class for unified frontend logging
 */
export class Logger {
  private static instance: Logger;
  private source?: string;

  private constructor(source?: string) {
    this.source = source;
  }

  /**
   * Get global logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Create logger with specific source
   */
  public static create(source: string): Logger {
    return new Logger(source);
  }

  /**
   * Log debug message
   */
  public debug(message: string, data?: any): void {
    console.debug(`[${this.source || 'Frontend'}]`, message, data);
    forwardToRust('debug', message, { source: this.source, data });
  }

  /**
   * Log info message
   */
  public info(message: string, data?: any): void {
    console.info(`[${this.source || 'Frontend'}]`, message, data);
    forwardToRust('info', message, { source: this.source, data });
  }

  /**
   * Log warning message
   */
  public warn(message: string, data?: any): void {
    console.warn(`[${this.source || 'Frontend'}]`, message, data);
    forwardToRust('warn', message, { source: this.source, data });
  }

  /**
   * Log error message
   */
  public error(message: string, data?: any): void {
    console.error(`[${this.source || 'Frontend'}]`, message, data);
    forwardToRust('error', message, { source: this.source, data });
  }

  /**
   * Log with custom level
   */
  public log(level: LogLevel, message: string, data?: any): void {
    switch (level) {
      case 'debug':
        this.debug(message, data);
        break;
      case 'info':
        this.info(message, data);
        break;
      case 'warn':
        this.warn(message, data);
        break;
      case 'error':
        this.error(message, data);
        break;
    }
  }
}

// Export global logger instance
export const logger = Logger.getInstance();

// Export factory function
export function createLogger(source: string): Logger {
  return Logger.create(source);
}
