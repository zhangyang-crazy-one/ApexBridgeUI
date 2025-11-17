/**
 * ThemeManager - Light/Dark Theme Switching
 *
 * Manages theme switching between light and dark modes
 * following Anthropic design system specifications from CLAUDE.md
 *
 * Features:
 * - localStorage persistence (key: 'vcpchat-theme')
 * - System preference detection
 * - Smooth 300ms CSS variable transitions
 * - Theme toggle button with SVG icons
 * - Event-driven theme changes
 *
 * Usage:
 * ```typescript
 * const themeManager = ThemeManager.getInstance();
 * themeManager.toggleTheme(); // Switch between light/dark
 * ```
 */

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: 'light' | 'dark' = 'light';
  private toggleButton: HTMLElement | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Initialize theme system
   * Call this after DOM is ready
   */
  public initialize(): void {
    // Load saved theme or detect system preference
    this.loadTheme();

    // Apply theme to <html> element
    this.applyTheme();

    // Find and bind toggle button if it exists
    this.bindToggleButton();

    // Listen for system theme changes
    this.listenToSystemChanges();

    console.log(`[ThemeManager] Initialized with theme: ${this.currentTheme}`);
  }

  /**
   * Load theme from localStorage or system preference
   */
  private loadTheme(): void {
    // Priority: localStorage > system preference > default (light)
    const savedTheme = localStorage.getItem('vcpchat-theme');

    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.currentTheme = savedTheme;
      console.log('[ThemeManager] Loaded theme from localStorage:', savedTheme);
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.currentTheme = prefersDark ? 'dark' : 'light';
      console.log('[ThemeManager] Detected system theme:', this.currentTheme);
    }
  }

  /**
   * Apply current theme to DOM
   */
  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.currentTheme);

    // Update toggle button icon if it exists
    this.updateToggleIcon();

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { theme: this.currentTheme }
    }));
  }

  /**
   * Toggle between light and dark themes
   */
  public toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.saveTheme();
    this.applyTheme();

    console.log(`[ThemeManager] Theme toggled to: ${this.currentTheme}`);
  }

  /**
   * Set specific theme
   */
  public setTheme(theme: 'light' | 'dark'): void {
    if (this.currentTheme === theme) return;

    this.currentTheme = theme;
    this.saveTheme();
    this.applyTheme();

    console.log(`[ThemeManager] Theme set to: ${this.currentTheme}`);
  }

  /**
   * Get current theme
   */
  public getTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }

  /**
   * Save theme to localStorage
   */
  private saveTheme(): void {
    localStorage.setItem('vcpchat-theme', this.currentTheme);
  }

  /**
   * Bind theme toggle button
   */
  private bindToggleButton(): void {
    this.toggleButton = document.getElementById('theme-toggle-btn');

    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => {
        this.toggleTheme();
      });

      // Initial icon update
      this.updateToggleIcon();

      console.log('[ThemeManager] Toggle button bound');
    }
  }

  /**
   * Update toggle button icon based on current theme
   */
  private updateToggleIcon(): void {
    if (!this.toggleButton) return;

    // Sun icon for light mode (click to go dark)
    // Moon icon for dark mode (click to go light)
    const sunSVG = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2.5a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm0 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 1.5a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-7-5a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zm12 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM5.05 5.05a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm9.9 9.9a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zm-9.9 0a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zm9.9-9.9a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z"/>
      </svg>
    `;

    const moonSVG = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
      </svg>
    `;

    // Show sun in light mode, moon in dark mode
    this.toggleButton.innerHTML = this.currentTheme === 'light' ? sunSVG : moonSVG;
    this.toggleButton.title = this.currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
  }

  /**
   * Listen for system theme preference changes
   */
  private listenToSystemChanges(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a theme
      const savedTheme = localStorage.getItem('vcpchat-theme');
      if (!savedTheme) {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme();
        console.log('[ThemeManager] Auto-switched to system theme:', this.currentTheme);
      }
    });
  }
}

/**
 * Initialize ThemeManager singleton
 * Call this in main.ts after DOM is ready
 */
export function initThemeManager(): ThemeManager {
  const manager = ThemeManager.getInstance();
  manager.initialize();
  return manager;
}
