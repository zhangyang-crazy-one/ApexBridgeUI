/**
 * Window Controls
 * Custom minimize, maximize, and close buttons for Tauri window
 * Complies with Anthropic Design System (Constitution v1.1.0 Section V)
 *
 * Bug #4 Fix:
 * - Uses SVG icons instead of emoji symbols
 * - Checks __TAURI__ availability before API calls
 * - Provides user feedback when Tauri is not available
 */

import { getCurrentWindow } from '@tauri-apps/api/window';

export class WindowControls {
  private static instance: WindowControls;
  private appWindow: ReturnType<typeof getCurrentWindow> | null = null;
  private container: HTMLElement;
  private isMaximized: boolean = false;
  private isTauriAvailable: boolean = false;

  private constructor() {
    // Lightweight constructor: only check for Tauri availability.
    this.isTauriAvailable = Boolean((window as any).__TAURI__);
    if (this.isTauriAvailable) {
      this.appWindow = getCurrentWindow();
    }
  }

  public static getInstance(): WindowControls {
    if (!WindowControls.instance) {
      WindowControls.instance = new WindowControls();
    }
    return WindowControls.instance;
  }

  /**
   * Initialize window controls
   */
  public async init(): Promise<void> {
    const container = document.getElementById('window-controls');
    if (!container) {
      throw new Error('Window controls container not found in DOM');
    }
    this.container = container;

    // Create buttons first
    this.createControlButtons();

    // If in Tauri, attach listeners and get state
    if (this.isTauriAvailable && this.appWindow) {
      try {
        this.isMaximized = await this.appWindow.isMaximized();
        this.updateMaximizeIcon();

        this.appWindow.onResized(async () => {
          this.isMaximized = await this.appWindow.isMaximized();
          this.updateMaximizeIcon();
        });

        console.log('✓ Window controls initialized for Tauri');
      } catch (error) {
        console.error('Error setting up Tauri window listeners:', error);
      }
    } else {
      console.warn('[WindowControls] Running in browser mode. Controls are visual only.');
    }
  }

  /**
   * Create window control buttons with SVG icons
   */
  private createControlButtons(): void {
    // Clear existing content
    this.container.innerHTML = '';

    // Minimize button - horizontal line SVG
    const minimizeBtn = this.createButton(
      'minimize',
      this.getMinimizeSVG(),
      'Minimize window',
      () => this.minimizeWindow()
    );

    // Maximize/Restore button - square/double square SVG
    const maximizeBtn = this.createButton(
      'maximize',
      this.getMaximizeSVG(false),
      'Maximize window',
      () => this.toggleMaximize()
    );

    // Close button - X SVG
    const closeBtn = this.createButton(
      'close',
      this.getCloseSVG(),
      'Close window',
      () => this.closeWindow()
    );

    // Append buttons
    this.container.appendChild(minimizeBtn);
    this.container.appendChild(maximizeBtn);
    this.container.appendChild(closeBtn);
  }

  /**
   * Get minimize icon SVG (horizontal line)
   */
  private getMinimizeSVG(): string {
    return `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
      </svg>
    `;
  }

  /**
   * Get maximize icon SVG (square or double square)
   */
  private getMaximizeSVG(isMaximized: boolean): string {
    if (isMaximized) {
      // Restore icon - double overlapping squares
      return `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="2" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <rect x="2" y="0" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      `;
    } else {
      // Maximize icon - single square
      return `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      `;
    }
  }

  /**
   * Get close icon SVG (X)
   */
  private getCloseSVG(): string {
    return `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  /**
   * Create a control button with SVG icon
   */
  private createButton(
    className: string,
    svgContent: string,
    ariaLabel: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `window-control-btn ${className}`;
    button.setAttribute('aria-label', ariaLabel);
    button.innerHTML = svgContent;
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Minimize window
   */
  private async minimizeWindow(): Promise<void> {
    if (!this.isTauriAvailable || !this.appWindow) {
      // Use browser mock for testing
      const { BrowserWindowControls } = await import('@core/tauri-browser-mock');
      await BrowserWindowControls.minimize();
      return;
    }

    try {
      await this.appWindow.minimize();
      console.log('[WindowControls] Window minimized');
    } catch (error) {
      console.error('[WindowControls] Failed to minimize window:', error);
      alert('Failed to minimize window. Please check Tauri configuration.');
    }
  }

  /**
   * Toggle maximize/restore window
   */
  private async toggleMaximize(): Promise<void> {
    if (!this.isTauriAvailable || !this.appWindow) {
      // Use browser mock for testing
      const { BrowserWindowControls } = await import('@core/tauri-browser-mock');
      await BrowserWindowControls.toggleMaximize();
      this.isMaximized = BrowserWindowControls.isMaximized();
      this.updateMaximizeIcon();
      return;
    }

    try {
      await this.appWindow.toggleMaximize();
      this.isMaximized = !this.isMaximized;
      this.updateMaximizeIcon();
      console.log(`[WindowControls] Window ${this.isMaximized ? 'maximized' : 'restored'}`);
    } catch (error) {
      console.error('[WindowControls] Failed to toggle maximize:', error);
      alert('Failed to toggle window maximize. Please check Tauri configuration.');
    }
  }

  /**
   * Close window
   */
  private async closeWindow(): Promise<void> {
    if (!this.isTauriAvailable || !this.appWindow) {
      // Use browser mock for testing
      const { BrowserWindowControls } = await import('@core/tauri-browser-mock');
      await BrowserWindowControls.close();
      return;
    }

    try {
      await this.appWindow.close();
      console.log('[WindowControls] Window closed');
    } catch (error) {
      console.error('[WindowControls] Failed to close window:', error);
      alert('Failed to close window. Please check Tauri configuration.');
    }
  }

  /**
   * Update maximize button icon based on current state
   */
  private updateMaximizeIcon(): void {
    const maximizeBtn = this.container.querySelector('.window-control-btn.maximize');
    if (maximizeBtn) {
      maximizeBtn.innerHTML = this.getMaximizeSVG(this.isMaximized);
      maximizeBtn.setAttribute(
        'aria-label',
        this.isMaximized ? 'Restore window' : 'Maximize window'
      );
    }
  }

  /**
   * Get current maximize state
   */
  public isWindowMaximized(): boolean {
    return this.isMaximized;
  }
}

/**
 * Initialize window controls
 */
export async function initWindowControls(): Promise<WindowControls> {
  const instance = WindowControls.getInstance();
  await instance.init();
  return instance;
}
