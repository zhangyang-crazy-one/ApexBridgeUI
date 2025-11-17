/**
 * Sidebar Tab Manager
 *
 * Handles tab switching in the left sidebar between:
 * - 助手 (Agents): Agent/Group selection
 * - 话题 (Topics): Topic list
 * - 设置 (Settings): Agent settings panel
 */

export class SidebarTabManager {
  private static instance: SidebarTabManager;
  private tabButtons: NodeListOf<HTMLElement> | null = null;
  private tabContents: NodeListOf<HTMLElement> | null = null;
  private activeTab: string = 'agents';

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SidebarTabManager {
    if (!SidebarTabManager.instance) {
      SidebarTabManager.instance = new SidebarTabManager();
    }
    return SidebarTabManager.instance;
  }

  /**
   * Initialize tab manager and bind events
   */
  public initialize(): void {
    console.log('[SidebarTabManager] Starting initialization...');

    this.tabButtons = document.querySelectorAll('.sidebar-tab-button');
    this.tabContents = document.querySelectorAll('.sidebar-tab-content');

    console.log('[SidebarTabManager] Found elements:', {
      buttons: this.tabButtons?.length || 0,
      contents: this.tabContents?.length || 0
    });

    if (!this.tabButtons || this.tabButtons.length === 0) {
      console.error('[SidebarTabManager] Tab buttons not found');
      return;
    }

    if (!this.tabContents || this.tabContents.length === 0) {
      console.error('[SidebarTabManager] Tab contents not found');
      return;
    }

    // Log each button found
    this.tabButtons.forEach((button, index) => {
      console.log(`[SidebarTabManager] Button ${index}:`, {
        text: button.textContent?.trim(),
        dataTab: button.getAttribute('data-tab'),
        classes: button.className
      });
    });

    this.bindEvents();
    console.log('[SidebarTabManager] ✅ Initialized with', this.tabButtons.length, 'tabs');
  }

  /**
   * Bind click events to tab buttons
   */
  private bindEvents(): void {
    if (!this.tabButtons) return;

    console.log('[SidebarTabManager] Binding events to', this.tabButtons.length, 'buttons...');

    this.tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab');
        console.log(`[SidebarTabManager] Button ${index} clicked, tab="${tab}"`);

        if (tab) {
          this.switchTab(tab);
        } else {
          console.error('[SidebarTabManager] Button has no data-tab attribute');
        }
      });

      console.log(`[SidebarTabManager] ✓ Event listener bound to button ${index}`);
    });

    console.log('[SidebarTabManager] ✅ All event listeners bound');
  }

  /**
   * Switch to a different tab
   * @param tab - Tab identifier ('agents', 'topics', 'settings')
   */
  public switchTab(tab: string): void {
    if (!this.tabButtons || !this.tabContents) {
      console.error('[SidebarTabManager] Not initialized');
      return;
    }

    console.log('[SidebarTabManager] Switching to tab:', tab);

    // Remove active class from all buttons and contents
    this.tabButtons.forEach(btn => btn.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to selected button and content
    const selectedButton = document.querySelector(`[data-tab="${tab}"]`);
    const selectedContent = document.getElementById(`tab-content-${tab}`);

    if (selectedButton) {
      selectedButton.classList.add('active');
    } else {
      console.error('[SidebarTabManager] Tab button not found:', tab);
    }

    if (selectedContent) {
      selectedContent.classList.add('active');
    } else {
      console.error('[SidebarTabManager] Tab content not found:', tab);
    }

    this.activeTab = tab;

    // Dispatch custom event for tab change
    const event = new CustomEvent('tab-changed', {
      detail: { tab: this.activeTab }
    });
    window.dispatchEvent(event);
  }

  /**
   * Get currently active tab
   */
  public getActiveTab(): string {
    return this.activeTab;
  }
}

/**
 * Initialize and return singleton instance
 */
export function initSidebarTabManager(): SidebarTabManager {
  const manager = SidebarTabManager.getInstance();
  manager.initialize();
  return manager;
}
