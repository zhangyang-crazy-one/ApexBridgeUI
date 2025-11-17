/**
 * TitleBar Component (US5-014)
 *
 * Custom drag-to-move title bar for Tauri application
 * Provides:
 * - Drag-to-move functionality
 * - App title/icon display
 * - Integration with WindowControls
 */

import { t } from '../core/i18n/i18nHelper';

export class TitleBar {
  private container: HTMLElement;
  private appName: string = 'VCP Chat';
  private appIcon: string = 'assets/icons/app-icon.png';

  constructor(container: HTMLElement, appName?: string, appIcon?: string) {
    this.container = container;
    if (appName) this.appName = appName;
    if (appIcon) this.appIcon = appIcon;

    this.render();
  }

  /**
   * Render the title bar
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="title-bar" data-tauri-drag-region>
        <!-- App Icon and Title -->
        <div class="title-bar-left">
          <img src="${this.appIcon}" alt="${this.appName}" class="app-icon" />
          <span class="app-title">${this.appName}</span>
        </div>

        <!-- Center Area (draggable) -->
        <div class="title-bar-center" data-tauri-drag-region></div>

        <!-- Window Controls (right side) -->
        <div class="title-bar-right" id="window-controls-container"></div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Get draggable regions
    const dragRegions = this.container.querySelectorAll('[data-tauri-drag-region]');

    // Add visual feedback on drag
    dragRegions.forEach(region => {
      region.addEventListener('mousedown', (e) => {
        // Prevent text selection during drag
        e.preventDefault();

        // Add dragging class for visual feedback
        this.container.querySelector('.title-bar')?.classList.add('dragging');
      });

      region.addEventListener('mouseup', () => {
        this.container.querySelector('.title-bar')?.classList.remove('dragging');
      });
    });

    // Double-click to maximize/restore
    const titleBarCenter = this.container.querySelector('.title-bar-center');
    titleBarCenter?.addEventListener('dblclick', async () => {
      try {
        const { appWindow } = await import('@tauri-apps/api/window');
        const isMaximized = await appWindow.isMaximized();

        if (isMaximized) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
      } catch (error) {
        console.error('Failed to toggle maximize:', error);
      }
    });
  }

  /**
   * Get the window controls container for external components
   */
  public getWindowControlsContainer(): HTMLElement | null {
    return this.container.querySelector('#window-controls-container');
  }

  /**
   * Update app title dynamically
   */
  public setTitle(title: string): void {
    this.appName = title;
    const titleElement = this.container.querySelector('.app-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Update app icon dynamically
   */
  public setIcon(iconPath: string): void {
    this.appIcon = iconPath;
    const iconElement = this.container.querySelector('.app-icon') as HTMLImageElement;
    if (iconElement) {
      iconElement.src = iconPath;
    }
  }
}
