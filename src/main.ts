/**
 * VCPChat Main Entry Point
 * Initializes the application and sets up the main window
 */

import { getCurrentWindow } from '@tauri-apps/api/window';
import { initSidebarResize } from './utils/sidebar-resize';
import { initPluginManager } from './utils/plugin-manager';
import { initWindowControls } from './utils/window-controls';
import { initThemeManager } from './utils/theme-manager';
import { bootstrap, getBootstrapContext } from './core/bootstrap';
import { initializeUI } from './core/ui';
import { initDemoData } from './utils/init-demo-data';
import { initSidebarTabManager } from './modules/sidebar/tab-manager';
import { initAgentSettingsPanel } from './modules/settings/agent-settings-panel';
import { initI18n } from './core/i18n/i18nManager';
// import { initSettingsUI, registerSettingsShortcut } from './modules/settings/settings'; // Disabled legacy SettingsUI in favor of new SettingsModal

import { initNotificationCenter } from './utils/notification-center';
import { initWebSocketClient } from './core/services/websocketClient';

// Import rendering libraries (CORE-018F)
import { marked } from 'marked';
import katex from 'katex';
import mermaid from 'mermaid';
import hljs from 'highlight.js';

// Import browser mock layer
import { initBrowserMock } from './core/tauri-browser-mock';

// Import KaTeX CSS
import 'katex/dist/katex.min.css';
import './styles/custom-modal.css';

// Extend Window interface to include __TAURI__ and rendering libraries
declare global {
  interface Window {
    __TAURI__?: any;
    marked?: typeof marked;
    katex?: typeof katex;
    mermaid?: typeof mermaid;
    hljs?: typeof hljs;
  }
}

console.log('VCPChat Tauri - Frontend initialized');

// Initialize rendering libraries (CORE-018F)
// Expose to window for use by renderers
window.marked = marked;
window.katex = katex;
window.mermaid = mermaid;
window.hljs = hljs;

console.log('✓ Rendering libraries initialized:', {
  marked: !!window.marked,
  katex: !!window.katex,
  mermaid: !!window.mermaid,
  hljs: !!window.hljs
});

// Log platform information
console.log(`Platform: ${navigator.platform}`);
console.log(`User Agent: ${navigator.userAgent}`);

// Test Tauri API availability
const isTauri = Boolean(window.__TAURI__);
if (isTauri) {
  console.log('✓ Tauri API is available');
  console.log('✓ Running in Tauri webview');
} else {
  console.warn('⚠ Tauri API not available - running in browser (web debug mirror mode)');
}

/**
 * Initialize main window
 */
async function initMainWindow() {
  console.log('Initializing main window...');

  // Set up custom title bar behavior (only in Tauri)
  if (isTauri) {
    try {
      // Get window title bar element
      const titlebar = document.getElementById('titlebar');
      if (titlebar) {
        // Make title bar draggable (already has data-tauri-drag-region attribute)
        console.log('✓ Title bar drag region configured');
      }

      // Get the current window instance
      const appWindow = getCurrentWindow();

      // Update window title
      const titleElement = document.querySelector('.titlebar-title');
      if (titleElement) {
        titleElement.textContent = await appWindow.title();
      }

      // Listen for window title changes
      await appWindow.onTitleChanged(({ payload: title }) => {
        const titleElement = document.querySelector('.titlebar-title');
        if (titleElement) {
          titleElement.textContent = title;
        }
      });

      console.log('✓ Main window initialized');
    } catch (error) {
      console.error('Error initializing window:', error);
    }
  }
}

/**
 * Initialize application layout and managers
 */
async function initLayout() {
  console.log('Initializing application layout and managers...');

  try {
    // Phase 0: Initialize i18n system (CRITICAL - must be first to support translations in all components)
    console.log('Phase 0: Initializing i18n...');
    initI18n();
    console.log('✓ i18n initialized successfully');

    // Phase 0.5: Initialize demo data (if needed)
    initDemoData();

    // Phase 1: Bootstrap all managers
    console.log('Phase 1: Bootstrapping managers...');
    const context = await bootstrap();
    console.log('✓ Managers bootstrapped successfully');

    // Phase 2: Initialize UI
    console.log('Phase 2: Initializing UI...');
    await initializeUI(
      context.agentManager,
      context.groupManager,
      context.chatManager
    );
    console.log('✓ UI initialized successfully');

    // Phase 2.5: Initialize sidebar tab manager
    console.log('Phase 2.5: Initializing sidebar tabs...');
    const tabManager = initSidebarTabManager();
    console.log('✓ Sidebar tab manager initialized');

    // Phase 2.6: Initialize agent settings panel
    console.log('Phase 2.6: Initializing agent settings panel...');
    const settingsContainer = document.querySelector('#agent-settings-container');
    if (settingsContainer) {
      const settingsPanel = initAgentSettingsPanel(settingsContainer as HTMLElement);

      // Listen for agent selection events
      window.addEventListener('agent-selected', (e: Event) => {
        const customEvent = e as CustomEvent;
        settingsPanel.render(customEvent.detail.agent);
      });

      // Listen for agent updates to refresh the panel
      window.addEventListener('agent-updated', () => {
        const activeAgent = context.agentManager.getActiveAgent();
        if (activeAgent) {
          settingsPanel.render(activeAgent);
        }
      });

      console.log('✓ Agent settings panel initialized');
    } else {
      console.warn('⚠ Agent settings container not found');
    }

    // Phase 2.7: Initialize global Settings UI modal
    console.log('Phase 2.7: Skipped legacy Settings UI (using SettingsModal)');
    // const settingsUI = initSettingsUI();
    // registerSettingsShortcut();

    // Connect global settings button to Settings UI
    /* Disabled legacy SettingsUI global button binding
    const globalSettingsBtn = document.getElementById('global-settings-btn');
    if (globalSettingsBtn) {
      globalSettingsBtn.addEventListener('click', () => {
        settingsUI.show('global');
      });
      console.log('✓ Global settings button connected');
    }

    console.log('✓ Global Settings UI initialized');
    */

    // Phase 2.8: Initialize Notification Center
    console.log('Phase 2.8: Initializing Notification Center...');
    const notificationCenter = initNotificationCenter();
    console.log('✓ Notification Center initialized');

    // Store notification center globally for potential access
    (window as any).notificationCenter = notificationCenter;

    // Phase 2.9: Initialize WebSocket Client and connect to backend
    console.log('Phase 2.9: Initializing WebSocket Client...');
    try {
      const settings = context.settingsManager.getSettings();

      if (settings.websocket_url) {
        const wsClient = initWebSocketClient({
          url: settings.websocket_url,
          key: settings.websocket_key || '' // Key may be embedded in URL path
        });

        // Connect WebSocket to Notification Center
        notificationCenter.setupWebSocketListener(wsClient);

        // Connect to backend
        wsClient.connect();

        console.log('✓ WebSocket Client initialized and connected');
      } else {
        console.warn('⚠ WebSocket not configured in settings - skipping WebSocket initialization');
      }
    } catch (error) {
      console.error('❌ WebSocket initialization failed:', error);
      // Don't fail the entire app if WebSocket fails
    }

    console.log('✅ Layout initialization complete');
  } catch (error) {
    console.error('❌ Layout initialization failed:', error);

    // Show error in UI
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="error-state">
          <h2>Initialization Error</h2>
          <p>${(error as Error).message}</p>
          <button onclick="location.reload()">Reload Application</button>
        </div>
      `;
    }
  }
}

/**
 * Main initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - Starting initialization...');

  try {
    // Initialize browser mock layer first (for non-Tauri environments)
    initBrowserMock();

    // Initialize window
    await initMainWindow();

    // Initialize theme manager (EARLY - before layout)
    const themeManager = initThemeManager();
    console.log('✓ Theme manager initialized');

    // Initialize layout and managers
    await initLayout();

    // Initialize sidebar resize functionality (CORE-006, CORE-007)
    const { leftSidebar, rightSidebar } = initSidebarResize();
    console.log('✓ Sidebar resize managers initialized');

    // Store sidebar managers globally for potential future access
    (window as any).sidebarManagers = { leftSidebar, rightSidebar };

    // Initialize plugin manager (CORE-008)
    const pluginManager = initPluginManager();
    console.log('✓ Plugin manager initialized');

    // Store plugin manager globally
    (window as any).pluginManager = pluginManager;

    // Initialize window controls (CORE-009) - now works in both Tauri and browser
    const windowControls = await initWindowControls();
    console.log('✓ Window controls initialized');

    // Store window controls globally
    (window as any).windowControls = windowControls;

    console.log('✅ Application initialization complete');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
  }
});

// Handle window close event
if (isTauri) {
  window.addEventListener('beforeunload', (e) => {
    console.log('Window closing...');
    // Could add confirmation dialog here
  });
}
