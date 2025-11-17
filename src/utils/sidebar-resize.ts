/**
 * Sidebar Resize Utility
 * Handles resizable sidebar functionality with localStorage persistence
 * Complies with Anthropic Design System (Constitution v1.1.0 Section V)
 */

export type SidebarPosition = 'left' | 'right';

interface SidebarResizeConfig {
  position: SidebarPosition;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  storageKey: string;
}

export class SidebarResizeManager {
  private sidebar: HTMLElement;
  private resizeHandle: HTMLElement;
  private config: SidebarResizeConfig;
  private isResizing: boolean = false;
  private startX: number = 0;
  private startWidth: number = 0;

  constructor(
    sidebarId: string,
    resizeHandleId: string,
    config: Partial<SidebarResizeConfig> = {}
  ) {
    // Get DOM elements
    const sidebar = document.getElementById(sidebarId);
    const resizeHandle = document.getElementById(resizeHandleId);

    if (!sidebar || !resizeHandle) {
      throw new Error(`Sidebar or resize handle not found: ${sidebarId}, ${resizeHandleId}`);
    }

    this.sidebar = sidebar;
    this.resizeHandle = resizeHandle;

    // Merge default config
    this.config = {
      position: config.position || 'left',
      minWidth: config.minWidth || 180,
      maxWidth: config.maxWidth || 400,
      defaultWidth: config.defaultWidth || 260,
      storageKey: config.storageKey || `sidebar-width-${config.position || 'left'}`,
    };

    this.init();
  }

  /**
   * Initialize resize functionality
   */
  private init(): void {
    // Load saved width from localStorage
    this.loadSavedWidth();

    // Attach event listeners
    this.resizeHandle.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));

    // Touch support for mobile
    this.resizeHandle.addEventListener('touchstart', this.onTouchStart.bind(this));
    document.addEventListener('touchmove', this.onTouchMove.bind(this));
    document.addEventListener('touchend', this.onTouchEnd.bind(this));
  }

  /**
   * Load saved width from localStorage
   */
  private loadSavedWidth(): void {
    const savedWidth = localStorage.getItem(this.config.storageKey);

    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width)) {
        this.setWidth(width);
        return;
      }
    }

    // Use default width if no saved value
    this.setWidth(this.config.defaultWidth);
  }

  /**
   * Set sidebar width
   */
  private setWidth(width: number): void {
    // Clamp width to min/max constraints
    const clampedWidth = Math.max(
      this.config.minWidth,
      Math.min(this.config.maxWidth, width)
    );

    this.sidebar.style.width = `${clampedWidth}px`;
  }

  /**
   * Save current width to localStorage
   */
  private saveWidth(): void {
    const currentWidth = this.sidebar.offsetWidth;
    localStorage.setItem(this.config.storageKey, currentWidth.toString());
  }

  /**
   * Mouse down handler - Start resizing
   */
  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.startResize(event.clientX);
  }

  /**
   * Touch start handler
   */
  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startResize(event.touches[0].clientX);
    }
  }

  /**
   * Start resize operation
   */
  private startResize(clientX: number): void {
    this.isResizing = true;
    this.startX = clientX;
    this.startWidth = this.sidebar.offsetWidth;

    // Add resizing class for visual feedback
    this.resizeHandle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Mouse move handler - Perform resize
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    this.performResize(event.clientX);
  }

  /**
   * Touch move handler
   */
  private onTouchMove(event: TouchEvent): void {
    if (!this.isResizing || event.touches.length !== 1) return;

    this.performResize(event.touches[0].clientX);
  }

  /**
   * Perform resize calculation
   */
  private performResize(clientX: number): void {
    const deltaX = this.config.position === 'left'
      ? clientX - this.startX
      : this.startX - clientX;

    const newWidth = this.startWidth + deltaX;
    this.setWidth(newWidth);
  }

  /**
   * Mouse up handler - End resizing
   */
  private onMouseUp(): void {
    if (!this.isResizing) return;

    this.endResize();
  }

  /**
   * Touch end handler
   */
  private onTouchEnd(): void {
    if (!this.isResizing) return;

    this.endResize();
  }

  /**
   * End resize operation
   */
  private endResize(): void {
    this.isResizing = false;

    // Remove resizing class
    this.resizeHandle.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save the new width
    this.saveWidth();
  }

  /**
   * Collapse sidebar to zero width
   */
  public collapse(): void {
    this.sidebar.classList.add('collapsed');
    this.setWidth(0);
    this.saveWidth();
  }

  /**
   * Expand sidebar to default or last saved width
   */
  public expand(): void {
    this.sidebar.classList.remove('collapsed');
    this.loadSavedWidth();
  }

  /**
   * Toggle sidebar collapsed state
   */
  public toggle(): void {
    if (this.sidebar.classList.contains('collapsed')) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Reset sidebar to default width
   */
  public reset(): void {
    this.setWidth(this.config.defaultWidth);
    this.saveWidth();
  }

  /**
   * Destroy event listeners
   */
  public destroy(): void {
    this.resizeHandle.removeEventListener('mousedown', this.onMouseDown.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));

    this.resizeHandle.removeEventListener('touchstart', this.onTouchStart.bind(this));
    document.removeEventListener('touchmove', this.onTouchMove.bind(this));
    document.removeEventListener('touchend', this.onTouchEnd.bind(this));
  }
}

/**
 * Initialize all sidebar resize managers
 */
export function initSidebarResize(): {
  leftSidebar: SidebarResizeManager;
  rightSidebar: SidebarResizeManager;
} {
  const leftSidebar = new SidebarResizeManager(
    'sidebar-left',
    'resize-handle-left',
    {
      position: 'left',
      minWidth: 180,
      maxWidth: 400,
      defaultWidth: 260,
      storageKey: 'vcpchat-sidebar-left-width',
    }
  );

  const rightSidebar = new SidebarResizeManager(
    'sidebar-right',
    'resize-handle-right',
    {
      position: 'right',
      minWidth: 180,
      maxWidth: 400,
      defaultWidth: 260,
      storageKey: 'vcpchat-sidebar-right-width',
    }
  );

  return { leftSidebar, rightSidebar };
}
