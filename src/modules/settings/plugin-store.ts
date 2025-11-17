/**
 * Plugin Store UI (Sprint 1.1)
 *
 * Plugin Marketplace/Store Interface
 *
 * Responsibilities:
 * - Browse available plugins (local registry or remote marketplace)
 * - Search and filter plugins by category
 * - Display plugin metadata (name, description, author, ratings)
 * - Show plugin screenshots and preview
 * - Install plugins via ZIP download
 * - Integration with PluginInstaller for installation workflow
 *
 * Features:
 * - Grid-based plugin card layout
 * - Search with real-time filtering
 * - Category filtering (Productivity, Media, Development, Utility)
 * - Sort options (Popular, Recent, Name, Rating)
 * - Plugin detail modal with screenshots
 * - Direct installation from store
 * - Anthropic design system compliance
 *
 * Usage:
 * ```typescript
 * import { PluginStore } from './modules/settings/plugin-store';
 *
 * const store = new PluginStore('plugin-store-container');
 * await store.initialize();
 * ```
 */

import { PluginInstaller } from './plugin-installer';

// Tauri asset protocol conversion for packaged exe
let convertFileSrcFunc: ((filePath: string, protocol?: string) => string) | null = null;

// Dynamically load Tauri API if available
if (typeof window !== 'undefined' && (window as any).__TAURI__) {
  import('@tauri-apps/api/core').then(module => {
    convertFileSrcFunc = module.convertFileSrc;
    console.log('[PluginStore] Tauri convertFileSrc loaded');
  }).catch(err => {
    console.warn('[PluginStore] Failed to load Tauri API:', err);
  });
}

/**
 * Convert asset path to work in both dev and packaged environments
 */
function convertAssetPath(assetPath: string): string {
  if (assetPath.startsWith('asset://') ||
      assetPath.startsWith('http://') ||
      assetPath.startsWith('https://') ||
      assetPath.startsWith('data:')) {
    return assetPath;
  }

  if (convertFileSrcFunc) {
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    return convertFileSrcFunc(cleanPath);
  }

  return assetPath;
}

/**
 * Plugin category enum
 */
export enum PluginCategory {
  All = 'all',
  Productivity = 'productivity',
  Media = 'media',
  Development = 'development',
  Utility = 'utility',
  Communication = 'communication',
  Entertainment = 'entertainment'
}

/**
 * Plugin sort options
 */
export enum PluginSortOption {
  Popular = 'popular',
  Recent = 'recent',
  Name = 'name',
  Rating = 'rating'
}

/**
 * Plugin store item metadata
 */
export interface PluginStoreItem {
  id: string;                          // Plugin unique ID
  name: string;                        // Internal name
  displayName: string;                 // Display name
  description: string;                 // Short description
  longDescription?: string;            // Detailed description
  version: string;                     // Current version
  author: string;                      // Author name
  authorUrl?: string;                  // Author website
  icon?: string;                       // Icon URL or path
  screenshots?: string[];              // Screenshot URLs
  category: PluginCategory;            // Plugin category
  tags: string[];                      // Search tags
  downloads: number;                   // Download count
  rating: number;                      // Average rating (0-5)
  ratingCount: number;                 // Number of ratings
  homepage?: string;                   // Homepage URL
  repository?: string;                 // Repository URL
  license: string;                     // License type
  downloadUrl: string;                 // ZIP download URL
  fileSize?: number;                   // File size in bytes
  publishedAt: string;                 // ISO date string
  updatedAt: string;                   // ISO date string
  requiredVcpVersion?: string;         // Minimum VCP version
  featured?: boolean;                  // Featured plugin flag
}

/**
 * Plugin store data source interface
 */
interface PluginStoreDataSource {
  fetchPlugins(): Promise<PluginStoreItem[]>;
  searchPlugins(query: string): Promise<PluginStoreItem[]>;
}

/**
 * Local registry data source (default implementation)
 * Loads plugins from local JSON file or hardcoded list
 */
class LocalRegistryDataSource implements PluginStoreDataSource {
  private plugins: PluginStoreItem[] = [];

  constructor() {
    // TODO: Load from local JSON file (e.g., plugins-registry.json)
    // For now, use sample data
    this.plugins = this.getSamplePlugins();
  }

  async fetchPlugins(): Promise<PluginStoreItem[]> {
    return this.plugins;
  }

  async searchPlugins(query: string): Promise<PluginStoreItem[]> {
    const lowerQuery = query.toLowerCase();
    return this.plugins.filter(plugin =>
      plugin.displayName.toLowerCase().includes(lowerQuery) ||
      plugin.description.toLowerCase().includes(lowerQuery) ||
      plugin.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      plugin.author.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get sample plugins for demonstration
   * TODO: Replace with actual plugin registry
   */
  private getSamplePlugins(): PluginStoreItem[] {
    return [
      {
        id: 'example-calculator',
        name: 'calculator-plugin',
        displayName: 'Scientific Calculator',
        description: 'Advanced scientific calculator with support for complex expressions',
        longDescription: 'A powerful scientific calculator plugin that supports basic arithmetic, trigonometric functions, logarithms, and complex number calculations. Perfect for mathematical computations within your VCPChat conversations.',
        version: '1.2.0',
        author: 'MathTools Inc.',
        // No emoji icon - will use SVG in render
        category: PluginCategory.Utility,
        tags: ['calculator', 'math', 'science', 'computation'],
        downloads: 15420,
        rating: 4.7,
        ratingCount: 328,
        license: 'MIT',
        downloadUrl: '/plugins/calculator-plugin.zip',
        fileSize: 245000,
        publishedAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-10-20T14:30:00Z',
        featured: true
      },
      {
        id: 'example-code-formatter',
        name: 'code-formatter',
        displayName: 'Code Formatter Pro',
        description: 'Format and beautify code in 50+ programming languages',
        version: '2.0.1',
        author: 'DevTools Team',
        // No emoji icon - will use SVG in render
        category: PluginCategory.Development,
        tags: ['code', 'formatter', 'prettier', 'beautify'],
        downloads: 8932,
        rating: 4.5,
        ratingCount: 156,
        license: 'Apache-2.0',
        downloadUrl: '/plugins/code-formatter.zip',
        publishedAt: '2025-02-01T08:00:00Z',
        updatedAt: '2025-10-15T12:00:00Z'
      },
      {
        id: 'example-image-generator',
        name: 'image-generator',
        displayName: 'AI Image Generator',
        description: 'Generate images using AI models directly in chat',
        version: '1.5.0',
        author: 'CreativeAI Labs',
        // No emoji icon - will use SVG in render
        category: PluginCategory.Media,
        tags: ['image', 'ai', 'generation', 'art'],
        downloads: 12750,
        rating: 4.8,
        ratingCount: 412,
        license: 'MIT',
        downloadUrl: '/plugins/image-generator.zip',
        publishedAt: '2025-03-10T09:00:00Z',
        updatedAt: '2025-11-01T16:00:00Z',
        featured: true
      },
      {
        id: 'example-task-manager',
        name: 'task-manager',
        displayName: 'Task Manager',
        description: 'Manage your tasks and to-do lists within VCPChat',
        version: '1.0.3',
        author: 'ProductivityHub',
        // No emoji icon - will use SVG in render
        category: PluginCategory.Productivity,
        tags: ['tasks', 'todo', 'productivity', 'management'],
        downloads: 6540,
        rating: 4.3,
        ratingCount: 89,
        license: 'GPL-3.0',
        downloadUrl: '/plugins/task-manager.zip',
        publishedAt: '2025-04-05T11:00:00Z',
        updatedAt: '2025-10-25T10:00:00Z'
      },
      {
        id: 'example-weather',
        name: 'weather-widget',
        displayName: 'Weather Widget',
        description: 'Display real-time weather information and forecasts',
        version: '0.9.2',
        author: 'WeatherNow',
        // No emoji icon - will use SVG in render
        category: PluginCategory.Utility,
        tags: ['weather', 'forecast', 'temperature', 'widget'],
        downloads: 4321,
        rating: 4.1,
        ratingCount: 67,
        license: 'MIT',
        downloadUrl: '/plugins/weather-widget.zip',
        publishedAt: '2025-05-12T07:00:00Z',
        updatedAt: '2025-10-18T13:00:00Z'
      },
      {
        id: 'example-translator',
        name: 'multilang-translator',
        displayName: 'Multi-Language Translator',
        description: 'Translate text between 100+ languages using AI',
        version: '1.3.0',
        author: 'LangBridge',
        // No emoji icon - will use SVG in render
        category: PluginCategory.Communication,
        tags: ['translation', 'language', 'multilingual', 'ai'],
        downloads: 9876,
        rating: 4.6,
        ratingCount: 234,
        license: 'MIT',
        downloadUrl: '/plugins/multilang-translator.zip',
        publishedAt: '2025-06-20T10:00:00Z',
        updatedAt: '2025-10-30T15:00:00Z',
        featured: true
      }
    ];
  }
}

/**
 * Plugin Store UI class
 */
export class PluginStore {
  private containerElement: HTMLElement;
  private dataSource: PluginStoreDataSource;
  private plugins: PluginStoreItem[] = [];
  private filteredPlugins: PluginStoreItem[] = [];
  private searchQuery: string = '';
  private selectedCategory: PluginCategory = PluginCategory.All;
  private selectedSort: PluginSortOption = PluginSortOption.Popular;
  private pluginInstaller: PluginInstaller | null = null;

  constructor(containerId: string, dataSource?: PluginStoreDataSource) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.containerElement = container;
    this.dataSource = dataSource || new LocalRegistryDataSource();
  }

  /**
   * Initialize and load plugins
   */
  public async initialize(): Promise<void> {
    await this.loadPlugins();
    this.applyFilters();
    this.render();
    console.log('[PluginStore] Initialized with', this.plugins.length, 'plugins');
  }

  /**
   * Load plugins from data source
   */
  private async loadPlugins(): Promise<void> {
    try {
      this.plugins = await this.dataSource.fetchPlugins();
      console.log('[PluginStore] Loaded', this.plugins.length, 'plugins from registry');
    } catch (error: any) {
      console.error('[PluginStore] Failed to load plugins:', error);
      this.plugins = [];
    }
  }

  /**
   * Apply current filters and sort
   */
  private applyFilters(): void {
    // Filter by category
    let filtered = this.selectedCategory === PluginCategory.All
      ? [...this.plugins]
      : this.plugins.filter(p => p.category === this.selectedCategory);

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.displayName.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query)) ||
        p.author.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = this.sortPlugins(filtered, this.selectedSort);

    this.filteredPlugins = filtered;
  }

  /**
   * Sort plugins by selected option
   */
  private sortPlugins(plugins: PluginStoreItem[], sortOption: PluginSortOption): PluginStoreItem[] {
    const sorted = [...plugins];

    switch (sortOption) {
      case PluginSortOption.Popular:
        return sorted.sort((a, b) => b.downloads - a.downloads);

      case PluginSortOption.Recent:
        return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      case PluginSortOption.Name:
        return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));

      case PluginSortOption.Rating:
        return sorted.sort((a, b) => b.rating - a.rating);

      default:
        return sorted;
    }
  }

  /**
   * Render the plugin store UI
   */
  private render(): void {
    this.containerElement.innerHTML = `
      <div class="plugin-store">
        <!-- Header with search and filters -->
        <div class="store-header">
          <div class="store-title-section">
            <h3 class="store-title">Plugin Store</h3>
            <p class="store-subtitle">Discover and install plugins to extend VCPChat</p>
          </div>

          <div class="store-controls">
            <!-- Search Input -->
            <div class="search-container">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              <input
                type="search"
                class="store-search"
                placeholder="Search plugins..."
                value="${this.searchQuery}"
                id="storeSearchInput"
              >
            </div>

            <!-- Category Filter -->
            <select class="category-filter" id="categoryFilter">
              <option value="${PluginCategory.All}" ${this.selectedCategory === PluginCategory.All ? 'selected' : ''}>
                All Categories
              </option>
              <option value="${PluginCategory.Productivity}" ${this.selectedCategory === PluginCategory.Productivity ? 'selected' : ''}>
                Productivity
              </option>
              <option value="${PluginCategory.Media}" ${this.selectedCategory === PluginCategory.Media ? 'selected' : ''}>
                Media
              </option>
              <option value="${PluginCategory.Development}" ${this.selectedCategory === PluginCategory.Development ? 'selected' : ''}>
                Development
              </option>
              <option value="${PluginCategory.Utility}" ${this.selectedCategory === PluginCategory.Utility ? 'selected' : ''}>
                Utility
              </option>
              <option value="${PluginCategory.Communication}" ${this.selectedCategory === PluginCategory.Communication ? 'selected' : ''}>
                Communication
              </option>
              <option value="${PluginCategory.Entertainment}" ${this.selectedCategory === PluginCategory.Entertainment ? 'selected' : ''}>
                Entertainment
              </option>
            </select>

            <!-- Sort Options -->
            <select class="sort-filter" id="sortFilter">
              <option value="${PluginSortOption.Popular}" ${this.selectedSort === PluginSortOption.Popular ? 'selected' : ''}>
                Popular
              </option>
              <option value="${PluginSortOption.Recent}" ${this.selectedSort === PluginSortOption.Recent ? 'selected' : ''}>
                Recently Updated
              </option>
              <option value="${PluginSortOption.Name}" ${this.selectedSort === PluginSortOption.Name ? 'selected' : ''}>
                Name (A-Z)
              </option>
              <option value="${PluginSortOption.Rating}" ${this.selectedSort === PluginSortOption.Rating ? 'selected' : ''}>
                Highest Rated
              </option>
            </select>
          </div>
        </div>

        <!-- Results Count -->
        <div class="store-results-info">
          <span class="results-count">
            ${this.filteredPlugins.length} plugin${this.filteredPlugins.length !== 1 ? 's' : ''} found
          </span>
          ${this.searchQuery || this.selectedCategory !== PluginCategory.All ? `
            <button class="clear-filters-btn" id="clearFiltersBtn">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
              </svg>
              Clear Filters
            </button>
          ` : ''}
        </div>

        <!-- Empty State or Plugin Grid -->
        ${this.filteredPlugins.length === 0 ? this.renderEmptyState() : ''}

        <div class="store-grid">
          ${this.filteredPlugins.map(plugin => this.renderPluginCard(plugin)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    if (this.searchQuery) {
      return `
        <div class="store-empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M10 18a7.952 7.952 0 004.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0018 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"/>
          </svg>
          <h4>No Plugins Found</h4>
          <p>No plugins match "${this.searchQuery}"</p>
          <button class="clear-filters-btn-secondary" id="clearSearchBtn">
            Clear Search
          </button>
        </div>
      `;
    }

    return `
      <div class="store-empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M3 5h4v4H3V5zm0 6h4v4H3v-4zm6-6h4v4H9V5zm0 6h4v4H9v-4zm6-6h4v4h-4V5zm0 6h4v4h-4v-4z"/>
        </svg>
        <h4>No Plugins Available</h4>
        <p>The plugin store is currently empty</p>
      </div>
    `;
  }

  /**
   * Get SVG icon for plugin category
   * Uses local SVG resources from src/template/pic_resource/icon/Emoji_instead/
   */
  private getCategoryIcon(category: PluginCategory): string {
    // Map categories to local SVG resources
    const iconMap: Record<PluginCategory, string> = {
      [PluginCategory.All]: '/src/template/pic_resource/icon/Emoji_instead/dashboard-4.svg',
      [PluginCategory.Productivity]: '/src/template/pic_resource/icon/Emoji_instead/dashboard-4.svg',
      [PluginCategory.Media]: '/src/template/pic_resource/icon/Emoji_instead/clip.svg',
      [PluginCategory.Development]: '/src/template/pic_resource/icon/Emoji_instead/code-12.svg',
      [PluginCategory.Utility]: '/src/template/pic_resource/icon/Emoji_instead/cpu-6.svg',
      [PluginCategory.Communication]: '/src/template/pic_resource/icon/Emoji_instead/pen-14.svg',
      [PluginCategory.Entertainment]: '/src/template/pic_resource/icon/Emoji_instead/candy-16.svg'
    };

    const iconPath = iconMap[category] || iconMap[PluginCategory.All];
    const convertedPath = convertAssetPath(iconPath);

    // Return <img> tag with proper sizing (48px to match CSS .card-icon)
    return `<img src="${convertedPath}" alt="${category} icon" class="plugin-category-icon" width="48" height="48" />`;
  }

  /**
   * Render individual plugin card
   */
  private renderPluginCard(plugin: PluginStoreItem): string {
    const formatDownloads = (count: number): string => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
      return count.toString();
    };

    const formatFileSize = (bytes?: number): string => {
      if (!bytes) return 'N/A';
      const mb = bytes / (1024 * 1024);
      return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
    };

    return `
      <div class="plugin-store-card ${plugin.featured ? 'featured' : ''}" data-plugin-id="${plugin.id}">
        ${plugin.featured ? '<div class="featured-badge">Featured</div>' : ''}

        <div class="card-icon">
          ${this.getCategoryIcon(plugin.category)}
        </div>

        <div class="card-content">
          <h4 class="card-title">${plugin.displayName}</h4>
          <p class="card-author">by ${plugin.author}</p>
          <p class="card-description">${plugin.description}</p>

          <div class="card-meta">
            <div class="meta-item rating">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" class="star-icon">
                <path d="M10 1l2.928 6.472L20 8.273l-5.455 4.727L16.18 20 10 16.18 3.82 20l1.635-7L0 8.273l7.072-.801z"/>
              </svg>
              <span>${plugin.rating.toFixed(1)}</span>
              <span class="meta-count">(${plugin.ratingCount})</span>
            </div>

            <div class="meta-item downloads">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12l-5-5h3V3h4v4h3l-5 5zm-7 5h14v2H3v-2z"/>
              </svg>
              <span>${formatDownloads(plugin.downloads)}</span>
            </div>

            <div class="meta-item version">
              <span class="version-badge">v${plugin.version}</span>
            </div>
          </div>

          <div class="card-tags">
            ${plugin.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        </div>

        <div class="card-actions">
          <button class="view-details-btn" data-plugin-id="${plugin.id}">
            View Details
          </button>
          <button class="install-btn" data-plugin-id="${plugin.id}" data-download-url="${plugin.downloadUrl}">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12l-5-5h3V3h4v4h3l-5 5zm-7 5h14v2H3v-2z"/>
            </svg>
            Install
          </button>
        </div>

        <div class="card-footer">
          <span class="file-size">${formatFileSize(plugin.fileSize)}</span>
          <span class="license">${plugin.license}</span>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Search input
    const searchInput = document.getElementById('storeSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.applyFilters();
      this.render();
    });

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter') as HTMLSelectElement;
    categoryFilter?.addEventListener('change', (e) => {
      this.selectedCategory = (e.target as HTMLSelectElement).value as PluginCategory;
      this.applyFilters();
      this.render();
    });

    // Sort filter
    const sortFilter = document.getElementById('sortFilter') as HTMLSelectElement;
    sortFilter?.addEventListener('change', (e) => {
      this.selectedSort = (e.target as HTMLSelectElement).value as PluginSortOption;
      this.applyFilters();
      this.render();
    });

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    clearFiltersBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.selectedCategory = PluginCategory.All;
      this.applyFilters();
      this.render();
    });

    // Clear search button (empty state)
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    clearSearchBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.applyFilters();
      this.render();
    });

    // View details buttons
    const viewDetailsBtns = document.querySelectorAll('.view-details-btn');
    viewDetailsBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const pluginId = target.dataset.pluginId;
        if (pluginId) {
          this.showPluginDetails(pluginId);
        }
      });
    });

    // Install buttons
    const installBtns = document.querySelectorAll('.install-btn');
    installBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const pluginId = target.dataset.pluginId;
        const downloadUrl = target.dataset.downloadUrl;
        if (pluginId && downloadUrl) {
          this.installPlugin(pluginId, downloadUrl);
        }
      });
    });
  }

  /**
   * Show plugin details modal
   */
  private showPluginDetails(pluginId: string): void {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin) return;

    // TODO: Create detailed modal with screenshots, full description, changelog, etc.
    // For now, show a basic alert
    alert(`Plugin Details\n\nName: ${plugin.displayName}\nVersion: ${plugin.version}\nAuthor: ${plugin.author}\n\nDescription:\n${plugin.longDescription || plugin.description}\n\nRating: ${plugin.rating}/5 (${plugin.ratingCount} ratings)\nDownloads: ${plugin.downloads}\nLicense: ${plugin.license}`);
  }

  /**
   * Install plugin from store
   */
  private async installPlugin(pluginId: string, downloadUrl: string): void {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin) return;

    console.log('[PluginStore] Installing plugin:', plugin.displayName, 'from', downloadUrl);

    // TODO: Integrate with PluginInstaller
    // For now, show confirmation dialog
    const confirmed = confirm(
      `Install "${plugin.displayName}" v${plugin.version}?\n\nBy: ${plugin.author}\nSize: ${plugin.fileSize ? (plugin.fileSize / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown'}\n\nThis will download and install the plugin.`
    );

    if (!confirmed) return;

    try {
      // TODO: Download ZIP from downloadUrl
      // TODO: Pass downloaded file path to PluginInstaller
      // For now, just log the action
      console.log('[PluginStore] Download and installation would happen here');
      alert(`Plugin installation is not yet fully implemented.\n\nIn production, this would:\n1. Download ${downloadUrl}\n2. Open PluginInstaller dialog\n3. Show installation progress`);

    } catch (error: any) {
      console.error('[PluginStore] Installation failed:', error);
      alert(`Failed to install plugin: ${error.message || error}`);
    }
  }

  /**
   * Refresh plugin list
   */
  public async refresh(): Promise<void> {
    await this.loadPlugins();
    this.applyFilters();
    this.render();
  }
}

/**
 * Initialize PluginStore
 */
export async function initPluginStore(containerId: string, dataSource?: PluginStoreDataSource): Promise<PluginStore> {
  const store = new PluginStore(containerId, dataSource);
  await store.initialize();
  return store;
}
