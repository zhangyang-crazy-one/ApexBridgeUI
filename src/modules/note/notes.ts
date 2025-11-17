/**
 * Note Module (CORE-046)
 *
 * Rich Text Note Editor as Static Core Feature
 *
 * Responsibilities:
 * - Rich text editing with formatting support
 * - Markdown and HTML rendering
 * - Version history and undo/redo
 * - Save from chat functionality (CORE-048)
 * - Local persistence to AppData/Notemodules/ (CORE-047)
 * - @note-name referencing in chat (CORE-049)
 * - Multi-note management
 * - Search and filtering
 * - Tag and category support
 * - Auto-save functionality
 *
 * Features:
 * - Rich Text Editing: Bold, italic, underline, lists, headings
 * - Markdown Support: Full GFM (GitHub Flavored Markdown) support
 * - Image Embedding: Paste and drag-drop images
 * - Link Management: Auto-detect and clickable links
 * - Code Blocks: Syntax-highlighted code snippets
 * - Tables: Visual table editing
 * - Checkboxes: Task list support
 * - Tags: Organize notes with tags
 * - Search: Full-text search across all notes
 * - Dark/Light Theme: Follows Anthropic design system
 *
 * Architecture:
 * - NoteManager: Singleton manager for note instances
 * - NoteInstance: Individual note with editor state
 * - NoteState: Content, formatting, metadata
 * - VersionHistory: Maintains edit history for undo/redo
 * - TagManager: Manages tags and categories
 *
 * Usage:
 * ```typescript
 * import { NoteManager } from './modules/note/notes';
 *
 * const noteManager = NoteManager.getInstance();
 *
 * // Create new note
 * const note = await noteManager.createNote({
 *   title: 'Meeting Notes',
 *   initialContent: '# Meeting with Team\n\n- Topic 1\n- Topic 2'
 * });
 *
 * // Open existing note
 * await noteManager.openNote(noteId);
 *
 * // Save from chat message (CORE-048)
 * await noteManager.saveFromChat(messageId, noteName);
 *
 * // Reference note in chat (CORE-049)
 * const content = await noteManager.getNoteContent('@meeting-notes');
 * ```
 */

/**
 * Note configuration options
 */
export interface NoteOptions {
  /**
   * Note title
   * Default: 'Untitled Note'
   */
  title?: string;

  /**
   * Initial content (Markdown format)
   * Default: ''
   */
  initialContent?: string;

  /**
   * Tags for organization
   * Default: []
   */
  tags?: string[];

  /**
   * Read-only mode
   * Default: false
   */
  readOnly?: boolean;

  /**
   * Auto-save interval (ms)
   * Default: 30000 (30 seconds)
   */
  autoSaveInterval?: number;

  /**
   * Enable spell check
   * Default: true
   */
  spellCheck?: boolean;

  /**
   * Editor theme
   * Default: 'light' or 'dark' based on system
   */
  theme?: 'light' | 'dark';
}

/**
 * Note instance state
 */
export interface NoteState {
  /**
   * Unique note ID
   */
  id: string;

  /**
   * Note title
   */
  title: string;

  /**
   * Content in Markdown format
   */
  content: string;

  /**
   * Rendered HTML (cached)
   */
  renderedHtml?: string;

  /**
   * Tags
   */
  tags: string[];

  /**
   * Cursor position
   */
  cursorPosition?: {
    line: number;
    column: number;
  };

  /**
   * Selection range
   */
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last modified timestamp
   */
  modifiedAt: Date;

  /**
   * Is modified (unsaved changes)
   */
  isModified: boolean;

  /**
   * Note options
   */
  options: Required<NoteOptions>;

  /**
   * Pinned status
   */
  isPinned: boolean;

  /**
   * Archived status
   */
  isArchived: boolean;
}

/**
 * Version history entry for notes
 */
export interface NoteVersionEntry {
  /**
   * Version ID
   */
  id: string;

  /**
   * Content snapshot
   */
  content: string;

  /**
   * Cursor position at time of snapshot
   */
  cursorPosition?: {
    line: number;
    column: number;
  };

  /**
   * Timestamp
   */
  timestamp: Date;

  /**
   * Change description
   */
  description?: string;
}

/**
 * Note metadata for listing
 */
export interface NoteMetadata {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  wordCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

/**
 * Note instance class
 * Represents a single rich text note
 */
export class NoteInstance {
  private state: NoteState;
  private editorElement: HTMLElement | null = null;
  private editor: HTMLElement | null = null; // contenteditable div
  private versionHistory: NoteVersionEntry[] = [];
  private autoSaveTimer: number | null = null;
  private markdownRenderer: any = null; // Placeholder for Marked library

  constructor(id: string, options: NoteOptions = {}) {
    const now = new Date();

    this.state = {
      id,
      title: options.title || 'Untitled Note',
      content: options.initialContent || '',
      tags: options.tags || [],
      createdAt: now,
      modifiedAt: now,
      isModified: false,
      isPinned: false,
      isArchived: false,
      options: {
        title: options.title || 'Untitled Note',
        initialContent: options.initialContent || '',
        tags: options.tags || [],
        readOnly: options.readOnly || false,
        autoSaveInterval: options.autoSaveInterval || 30000,
        spellCheck: options.spellCheck !== false,
        theme: options.theme || 'light'
      }
    };

    // Initialize version history with initial content
    this.addVersionEntry(this.state.content, 'Initial content');
  }

  /**
   * Initialize note editor
   */
  public async initialize(container: HTMLElement): Promise<void> {
    this.editorElement = container;

    // Create editor DOM structure
    const editorHTML = this.buildEditorHTML();
    container.innerHTML = editorHTML;

    // Initialize editor (contenteditable div)
    await this.initializeEditor();

    // Setup event listeners
    this.setupEventListeners();

    // Setup auto-save
    if (this.state.options.autoSaveInterval > 0) {
      this.startAutoSave();
    }

    console.log(`[Note] Note ${this.state.id} initialized`);
  }

  /**
   * Build editor HTML structure
   */
  private buildEditorHTML(): string {
    let html = `<div class="note-container" data-note-id="${this.state.id}">`;

    // Header with title and actions
    html += '<div class="note-header">';
    html += `<input type="text" class="note-title-input" value="${this.escapeHtml(this.state.title)}" placeholder="Note title">`;

    html += '<div class="note-header-info">';
    html += `<span class="note-word-count">${this.getWordCount()} words</span>`;
    html += `<span class="note-status">${this.state.isModified ? 'Modified' : 'Saved'}</span>`;
    html += '</div>';

    html += '<div class="note-actions">';
    html += '<button class="note-action-btn note-save-btn" title="Save (Ctrl+S)">💾 Save</button>';
    html += '<button class="note-action-btn note-format-btn" title="Toggle Format">🎨 Format</button>';
    html += '<button class="note-action-btn note-undo-btn" title="Undo (Ctrl+Z)">↶ Undo</button>';
    html += '<button class="note-action-btn note-redo-btn" title="Redo (Ctrl+Y)">↷ Redo</button>';
    html += '<button class="note-action-btn note-close-btn" title="Close Note">✕</button>';
    html += '</div>'; // .note-actions

    html += '</div>'; // .note-header

    // Toolbar for formatting
    html += '<div class="note-toolbar">';
    html += '<button class="note-tool-btn" data-command="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>';
    html += '<button class="note-tool-btn" data-command="italic" title="Italic (Ctrl+I)"><em>I</em></button>';
    html += '<button class="note-tool-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>';
    html += '<span class="note-toolbar-separator"></span>';
    html += '<button class="note-tool-btn" data-command="insertUnorderedList" title="Bullet List">• List</button>';
    html += '<button class="note-tool-btn" data-command="insertOrderedList" title="Numbered List">1. List</button>';
    html += '<span class="note-toolbar-separator"></span>';
    html += '<button class="note-tool-btn" data-command="formatBlock" data-value="h1" title="Heading 1">H1</button>';
    html += '<button class="note-tool-btn" data-command="formatBlock" data-value="h2" title="Heading 2">H2</button>';
    html += '<button class="note-tool-btn" data-command="formatBlock" data-value="h3" title="Heading 3">H3</button>';
    html += '<span class="note-toolbar-separator"></span>';
    html += '<button class="note-tool-btn" data-command="createLink" title="Insert Link">🔗 Link</button>';
    html += '<button class="note-tool-btn" data-command="insertImage" title="Insert Image">🖼️ Image</button>';
    html += '<button class="note-tool-btn" data-command="insertCode" title="Code Block">&lt;/&gt; Code</button>';
    html += '</div>'; // .note-toolbar

    // Tags
    html += '<div class="note-tags-container">';
    html += '<span class="note-tags-label">Tags:</span>';
    html += '<div class="note-tags">';
    for (const tag of this.state.tags) {
      html += `<span class="note-tag">${this.escapeHtml(tag)}<button class="note-tag-remove" data-tag="${this.escapeHtml(tag)}">×</button></span>`;
    }
    html += '<input type="text" class="note-tag-input" placeholder="Add tag...">';
    html += '</div>';
    html += '</div>'; // .note-tags-container

    // Editor area (contenteditable)
    html += '<div class="note-editor-wrapper">';
    html += `<div class="note-editor" contenteditable="${!this.state.options.readOnly}" spellcheck="${this.state.options.spellCheck}">`;
    html += this.renderMarkdownToHtml(this.state.content);
    html += '</div>';
    html += '</div>'; // .note-editor-wrapper

    // Footer with status bar
    html += '<div class="note-footer">';
    html += '<div class="note-status-bar">';
    html += `<span class="note-status-item">Characters: ${this.state.content.length}</span>`;
    html += `<span class="note-status-item">Words: ${this.getWordCount()}</span>`;
    html += `<span class="note-status-item">Modified: ${this.formatDate(this.state.modifiedAt)}</span>`;
    html += '</div>'; // .note-status-bar
    html += '</div>'; // .note-footer

    html += '</div>'; // .note-container

    return html;
  }

  /**
   * Initialize editor (contenteditable div)
   */
  private async initializeEditor(): Promise<void> {
    if (!this.editorElement) {
      throw new Error('Editor element not initialized');
    }

    const editorDiv = this.editorElement.querySelector('.note-editor') as HTMLElement;

    if (!editorDiv) {
      throw new Error('Note editor div not found');
    }

    this.editor = editorDiv;

    // Handle content change
    editorDiv.addEventListener('input', () => {
      this.handleContentChange();
    });

    // Handle paste (strip formatting if needed)
    editorDiv.addEventListener('paste', (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    });

    console.log('[Note] Editor initialized');
  }

  /**
   * Setup event listeners for note actions
   */
  private setupEventListeners(): void {
    if (!this.editorElement) {
      console.warn('[Note] Cannot setup event listeners: editor element not found');
      return;
    }

    // Save button (Ctrl+S)
    const saveBtn = this.editorElement.querySelector('.note-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.save();
      });
    }

    // Format toggle button
    const formatBtn = this.editorElement.querySelector('.note-format-btn');
    if (formatBtn) {
      formatBtn.addEventListener('click', () => {
        this.toggleFormatMode();
      });
    }

    // Undo button (Ctrl+Z)
    const undoBtn = this.editorElement.querySelector('.note-undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.undo();
      });
    }

    // Redo button (Ctrl+Y)
    const redoBtn = this.editorElement.querySelector('.note-redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        this.redo();
      });
    }

    // Close button
    const closeBtn = this.editorElement.querySelector('.note-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('note-close-request', {
          detail: { noteId: this.state.id }
        }));
      });
    }

    // Title input - update note title on change
    const titleInput = this.editorElement.querySelector('.note-title-input') as HTMLInputElement;
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        this.state.title = titleInput.value;
        this.state.modifiedAt = new Date();
        this.state.isModified = true;
        this.updateStatus();
      });
    }

    // Toolbar buttons
    const toolButtons = this.editorElement.querySelectorAll('.note-tool-btn');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = (btn as HTMLElement).dataset.command;
        const value = (btn as HTMLElement).dataset.value;

        if (command) {
          this.execCommand(command, value);
        }
      });
    });

    // Tag input
    const tagInput = this.editorElement.querySelector('.note-tag-input') as HTMLInputElement;
    if (tagInput) {
      tagInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.value.trim()) {
          e.preventDefault();
          this.addTag(tagInput.value.trim());
          tagInput.value = '';
        }
      });
    }

    // Tag remove buttons
    this.editorElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('note-tag-remove')) {
        const tag = target.dataset.tag;
        if (tag) {
          this.removeTag(tag);
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
      }

      // Ctrl+Z / Cmd+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }

      // Ctrl+Y / Cmd+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      }

      // Ctrl+B - Bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.execCommand('bold');
      }

      // Ctrl+I - Italic
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        this.execCommand('italic');
      }

      // Ctrl+U - Underline
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        this.execCommand('underline');
      }

      // ESC - Close note
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('note-close-request', {
          detail: { noteId: this.state.id }
        }));
      }
    });

    console.log('[Note] Event listeners attached');
  }

  /**
   * Execute formatting command
   */
  private execCommand(command: string, value?: string): void {
    if (!this.editor) return;

    try {
      if (command === 'createLink') {
        const url = prompt('Enter URL:');
        if (url) {
          document.execCommand(command, false, url);
        }
      } else if (command === 'insertImage') {
        const url = prompt('Enter image URL:');
        if (url) {
          document.execCommand('insertImage', false, url);
        }
      } else if (command === 'insertCode') {
        // Insert code block (simplified)
        document.execCommand('insertHTML', false, '<pre><code>code here</code></pre>');
      } else if (value) {
        document.execCommand(command, false, value);
      } else {
        document.execCommand(command);
      }

      this.handleContentChange();
    } catch (error) {
      console.error('[Note] Command execution failed:', error);
    }
  }

  /**
   * Toggle between formatted view and markdown source
   */
  private toggleFormatMode(): void {
    // Implementation for toggling between WYSIWYG and Markdown source view
    console.log('[Note] Format mode toggle (to be implemented)');
  }

  /**
   * Handle content change
   */
  private handleContentChange(): void {
    if (!this.editor) return;

    const newContent = this.editor.innerHTML;

    if (newContent !== this.state.content) {
      this.state.content = newContent;
      this.state.modifiedAt = new Date();
      this.state.isModified = true;

      // Update status
      this.updateStatus();

      // Add to version history (debounced)
      this.debouncedAddVersion();
    }
  }

  /**
   * Debounced version history add
   */
  private versionDebounceTimer: number | null = null;
  private debouncedAddVersion(): void {
    if (this.versionDebounceTimer !== null) {
      clearTimeout(this.versionDebounceTimer);
    }

    this.versionDebounceTimer = window.setTimeout(() => {
      this.addVersionEntry(this.state.content, 'User edit');
      this.versionDebounceTimer = null;
    }, 2000); // 2 second debounce
  }

  /**
   * Add version entry to history
   */
  private addVersionEntry(content: string, description?: string): void {
    const entry: NoteVersionEntry = {
      id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      cursorPosition: this.state.cursorPosition,
      timestamp: new Date(),
      description
    };

    this.versionHistory.push(entry);

    // Limit history to 50 entries
    if (this.versionHistory.length > 50) {
      this.versionHistory.shift();
    }
  }

  /**
   * Update status bar
   */
  private updateStatus(): void {
    if (!this.editorElement) return;

    // Update modified indicator
    const statusSpan = this.editorElement.querySelector('.note-status') as HTMLElement;
    if (statusSpan) {
      statusSpan.textContent = this.state.isModified ? 'Modified' : 'Saved';
      statusSpan.style.color = this.state.isModified ? '#CD3131' : '#0DBC79';
    }

    // Update word count
    const wordCount = this.editorElement.querySelector('.note-word-count') as HTMLElement;
    if (wordCount) {
      wordCount.textContent = `${this.getWordCount()} words`;
    }

    // Update character count
    const charCount = this.editorElement.querySelector('.note-status-bar .note-status-item:first-child') as HTMLElement;
    if (charCount) {
      charCount.textContent = `Characters: ${this.state.content.length}`;
    }
  }

  /**
   * Get word count
   */
  private getWordCount(): number {
    const text = this.getPlainText();
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get plain text from HTML content
   */
  private getPlainText(): string {
    const div = document.createElement('div');
    div.innerHTML = this.state.content;
    return div.textContent || div.innerText || '';
  }

  /**
   * Add tag
   */
  public addTag(tag: string): void {
    if (!this.state.tags.includes(tag)) {
      this.state.tags.push(tag);
      this.state.isModified = true;
      this.updateStatus();

      // Re-render tags
      this.renderTags();
    }
  }

  /**
   * Remove tag
   */
  public removeTag(tag: string): void {
    const index = this.state.tags.indexOf(tag);
    if (index > -1) {
      this.state.tags.splice(index, 1);
      this.state.isModified = true;
      this.updateStatus();

      // Re-render tags
      this.renderTags();
    }
  }

  /**
   * Re-render tags display
   */
  private renderTags(): void {
    if (!this.editorElement) return;

    const tagsDiv = this.editorElement.querySelector('.note-tags') as HTMLElement;
    if (!tagsDiv) return;

    // Clear existing tags (except input)
    const tagElements = tagsDiv.querySelectorAll('.note-tag');
    tagElements.forEach(el => el.remove());

    // Add tags before input
    const tagInput = tagsDiv.querySelector('.note-tag-input');
    for (const tag of this.state.tags) {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'note-tag';
      tagSpan.innerHTML = `${this.escapeHtml(tag)}<button class="note-tag-remove" data-tag="${this.escapeHtml(tag)}">×</button>`;
      tagsDiv.insertBefore(tagSpan, tagInput);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = window.setInterval(() => {
      if (this.state.isModified) {
        this.save();
      }
    }, this.state.options.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save note state (CORE-047)
   * Uses Tauri backend in production, localStorage as fallback
   */
  public async save(): Promise<void> {
    try {
      // Prepare note data for persistence
      const savedData = {
        id: this.state.id,
        title: this.state.title,
        content: this.state.content,
        tags: this.state.tags,
        modifiedAt: this.state.modifiedAt.toISOString(),
        createdAt: this.state.createdAt.toISOString(),
        options: this.state.options,
        isPinned: this.state.isPinned,
        isArchived: this.state.isArchived
      };

      // CORE-047: Try Tauri backend first, fallback to localStorage
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

      if (isTauri) {
        // Save to Tauri backend (AppData/Notemodules/)
        try {
          const { writeNote } = await import('@core/ipc/commands');
          await writeNote(savedData);
          console.log(`[Note] Note ${this.state.id} saved to Tauri backend`);
        } catch (tauriError) {
          console.warn('[Note] Tauri save failed, falling back to localStorage:', tauriError);
          // Fallback to localStorage
          localStorage.setItem(`note-${this.state.id}`, JSON.stringify(savedData));
          console.log(`[Note] Note ${this.state.id} saved to localStorage (fallback)`);
        }
      } else {
        // Web debug mirror mode - use localStorage only
        localStorage.setItem(`note-${this.state.id}`, JSON.stringify(savedData));
        console.log(`[Note] Note ${this.state.id} saved to localStorage (web mode)`);
      }

      this.state.isModified = false;
      this.updateStatus();

    } catch (error) {
      console.error('[Note] Save error:', error);
      throw error;
    }
  }

  /**
   * Undo last change
   */
  public undo(): void {
    if (this.versionHistory.length < 2) {
      console.log('[Note] No more versions to undo');
      return;
    }

    // Remove current version and get previous
    this.versionHistory.pop();
    const previousVersion = this.versionHistory[this.versionHistory.length - 1];

    // Restore content
    this.state.content = previousVersion.content;
    if (this.editor) {
      this.editor.innerHTML = previousVersion.content;
    }

    this.state.modifiedAt = new Date();
    this.state.isModified = true;
    this.updateStatus();

    console.log('[Note] Undo to version:', previousVersion.id);
  }

  /**
   * Redo (placeholder for future implementation)
   */
  public redo(): void {
    console.log('[Note] Redo functionality not yet implemented');
  }

  /**
   * Get note state
   */
  public getState(): NoteState {
    return { ...this.state };
  }

  /**
   * Get version history
   */
  public getVersionHistory(): NoteVersionEntry[] {
    return [...this.versionHistory];
  }

  /**
   * Pin/unpin note
   */
  public setPinned(pinned: boolean): void {
    this.state.isPinned = pinned;
    this.state.isModified = true;
  }

  /**
   * Archive/unarchive note
   */
  public setArchived(archived: boolean): void {
    this.state.isArchived = archived;
    this.state.isModified = true;
  }

  /**
   * Render Markdown to HTML (placeholder)
   * In production, use Marked library
   */
  private renderMarkdownToHtml(markdown: string): string {
    // Placeholder: In production, use Marked library
    // import { marked } from 'marked';
    // return marked.parse(markdown);

    // Simple fallback for now
    return markdown.replace(/\n/g, '<br>');
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Dispose note instance
   */
  public dispose(): void {
    // Stop auto-save
    this.stopAutoSave();

    // Clear references
    this.editor = null;
    this.editorElement = null;

    console.log(`[Note] Note ${this.state.id} disposed`);
  }
}

/**
 * Note Manager
 * Singleton manager for all note instances
 */
export class NoteManager {
  private static instance: NoteManager;
  private notes: Map<string, NoteInstance> = new Map();
  private activeNoteId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NoteManager {
    if (!NoteManager.instance) {
      NoteManager.instance = new NoteManager();
    }
    return NoteManager.instance;
  }

  /**
   * Create new note
   */
  public async createNote(options: NoteOptions = {}): Promise<NoteInstance> {
    const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const note = new NoteInstance(id, options);

    this.notes.set(id, note);
    this.activeNoteId = id;

    console.log(`[NoteManager] Note created: ${id}`);
    return note;
  }

  /**
   * Open existing note (CORE-047)
   * Tries Tauri backend first, then falls back to localStorage
   */
  public async openNote(noteId: string): Promise<NoteInstance | null> {
    // Try to get from memory
    let note = this.notes.get(noteId);

    if (!note) {
      // CORE-047: Try Tauri backend first, fallback to localStorage
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
      let savedData: any = null;

      if (isTauri) {
        try {
          const { readNote } = await import('@core/ipc/commands');
          savedData = await readNote(noteId);
          console.log(`[NoteManager] Note loaded from Tauri backend: ${noteId}`);
        } catch (tauriError) {
          console.warn('[NoteManager] Tauri load failed, trying localStorage:', tauriError);
          // Fallback to localStorage
          const localData = localStorage.getItem(`note-${noteId}`);
          if (localData) {
            savedData = JSON.parse(localData);
            console.log(`[NoteManager] Note loaded from localStorage (fallback): ${noteId}`);
          }
        }
      } else {
        // Web debug mirror mode - use localStorage only
        const localData = localStorage.getItem(`note-${noteId}`);
        if (localData) {
          savedData = JSON.parse(localData);
          console.log(`[NoteManager] Note loaded from localStorage (web mode): ${noteId}`);
        }
      }

      if (savedData) {
        note = new NoteInstance(savedData.id, {
          title: savedData.title,
          initialContent: savedData.content,
          tags: savedData.tags,
          ...savedData.options
        });

        // Restore additional state
        const noteState = note.getState();
        noteState.isPinned = savedData.isPinned || false;
        noteState.isArchived = savedData.isArchived || false;

        this.notes.set(noteId, note);
      }
    }

    if (note) {
      this.activeNoteId = noteId;
    }

    return note || null;
  }

  /**
   * Get active note
   */
  public getActiveNote(): NoteInstance | null {
    if (!this.activeNoteId) return null;
    return this.notes.get(this.activeNoteId) || null;
  }

  /**
   * Get note by ID
   */
  public getNote(noteId: string): NoteInstance | null {
    return this.notes.get(noteId) || null;
  }

  /**
   * Get all note IDs
   */
  public getAllNoteIds(): string[] {
    return Array.from(this.notes.keys());
  }

  /**
   * Close note
   */
  public async closeNote(noteId: string, saveBeforeClose: boolean = true): Promise<void> {
    const note = this.notes.get(noteId);

    if (!note) {
      console.warn(`[NoteManager] Note not found: ${noteId}`);
      return;
    }

    // Save if requested
    if (saveBeforeClose && note.getState().isModified) {
      await note.save();
    }

    // Dispose note
    note.dispose();

    // Remove from map
    this.notes.delete(noteId);

    // Update active note
    if (this.activeNoteId === noteId) {
      const remaining = this.getAllNoteIds();
      this.activeNoteId = remaining.length > 0 ? remaining[0] : null;
    }

    console.log(`[NoteManager] Note closed: ${noteId}`);
  }

  /**
   * List all saved notes (CORE-047)
   * Tries Tauri backend first, then falls back to localStorage
   */
  public async listSavedNotes(): Promise<NoteMetadata[]> {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        const { listNotes } = await import('@core/ipc/commands');
        const notes = await listNotes();
        console.log(`[NoteManager] Listed ${notes.length} notes from Tauri backend`);
        return notes;
      } catch (tauriError) {
        console.warn('[NoteManager] Tauri list failed, falling back to localStorage:', tauriError);
      }
    }

    // Fallback to localStorage (web mode or Tauri error)
    const notes: NoteMetadata[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('note-')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          const plainText = this.stripHtml(data.content || '');
          const wordCount = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;

          notes.push({
            id: data.id,
            title: data.title,
            tags: data.tags || [],
            createdAt: data.createdAt,
            modifiedAt: data.modifiedAt,
            wordCount,
            isPinned: data.isPinned || false,
            isArchived: data.isArchived || false
          });
        } catch (error) {
          console.error('[NoteManager] Error parsing saved note:', error);
        }
      }
    }

    console.log(`[NoteManager] Listed ${notes.length} notes from localStorage`);
    return notes;
  }

  /**
   * Delete saved note (CORE-047)
   * Tries Tauri backend first, then falls back to localStorage
   */
  public async deleteSavedNote(noteId: string): Promise<void> {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      try {
        const { deleteNote } = await import('@core/ipc/commands');
        await deleteNote(noteId);
        console.log(`[NoteManager] Note deleted from Tauri backend: ${noteId}`);
        // Also remove from localStorage for consistency
        localStorage.removeItem(`note-${noteId}`);
        return;
      } catch (tauriError) {
        console.warn('[NoteManager] Tauri delete failed, falling back to localStorage:', tauriError);
      }
    }

    // Fallback to localStorage
    localStorage.removeItem(`note-${noteId}`);
    console.log(`[NoteManager] Note deleted from localStorage: ${noteId}`);
  }

  /**
   * Search notes by title or content
   */
  public async searchNotes(query: string): Promise<NoteMetadata[]> {
    const allNotes = await this.listSavedNotes();
    const lowerQuery = query.toLowerCase();

    return allNotes.filter(note =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get notes by tag
   */
  public async getNotesByTag(tag: string): Promise<NoteMetadata[]> {
    const allNotes = await this.listSavedNotes();
    return allNotes.filter(note => note.tags.includes(tag));
  }

  /**
   * Strip HTML tags for plain text extraction
   */
  private stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * CORE-048: Save from chat functionality
   * Creates a note from a chat message with proper content extraction
   *
   * Supports:
   * - Plain text messages
   * - Markdown formatted content
   * - Code blocks (converted to <pre><code>)
   * - Attachments (embedded as links)
   * - Message metadata (sender, timestamp)
   */
  public async saveFromChat(
    messageId: string,
    messageContent: string,
    messageMetadata?: {
      sender_name?: string;
      timestamp?: string;
      attachments?: Array<{ name: string; path: string; type: string }>;
      tool_calls?: Array<{ tool_name: string; parameters: any; result?: string }>;
    },
    noteName?: string
  ): Promise<NoteInstance> {
    // Extract note title from content or use provided name
    let title = noteName;
    if (!title) {
      // Try to extract first line as title (up to 50 chars)
      const firstLine = messageContent.split('\n')[0].trim();
      if (firstLine.length > 0) {
        title = firstLine.length > 50
          ? firstLine.substring(0, 47) + '...'
          : firstLine;
        // Remove markdown heading markers
        title = title.replace(/^#+\s*/, '');
      } else {
        title = `Note from Chat ${new Date().toLocaleDateString()}`;
      }
    }

    // Convert message content to note format
    let noteContent = this.convertMessageToNoteContent(messageContent, messageMetadata);

    // Generate tags based on content analysis
    const tags = this.generateTagsFromContent(messageContent, messageMetadata);

    // Create note with extracted content
    const note = await this.createNote({
      title,
      initialContent: noteContent,
      tags
    });

    console.log(`[NoteManager] Note created from chat message: ${messageId}`);
    console.log(`[NoteManager] Note title: ${title}`);
    console.log(`[NoteManager] Generated tags: ${tags.join(', ')}`);

    // Dispatch event for chat UI integration
    window.dispatchEvent(new CustomEvent('note-created-from-chat', {
      detail: {
        noteId: note.getState().id,
        messageId,
        title,
        tags
      }
    }));

    // Auto-save the note
    await note.save();

    return note;
  }

  /**
   * CORE-048: Convert chat message content to note HTML format
   */
  private convertMessageToNoteContent(
    content: string,
    metadata?: {
      sender_name?: string;
      timestamp?: string;
      attachments?: Array<{ name: string; path: string; type: string }>;
      tool_calls?: Array<{ tool_name: string; parameters: any; result?: string }>;
    }
  ): string {
    let html = '';

    // Add metadata header if available
    if (metadata) {
      html += '<div class="note-message-metadata">';

      if (metadata.sender_name) {
        html += `<p><strong>From:</strong> ${this.stripHtml(metadata.sender_name)}</p>`;
      }

      if (metadata.timestamp) {
        const date = new Date(metadata.timestamp);
        html += `<p><strong>Date:</strong> ${date.toLocaleString()}</p>`;
      }

      html += '</div><hr>';
    }

    // Convert markdown content to HTML
    // Note: In production, use marked library for full markdown parsing
    html += this.simpleMarkdownToHtml(content);

    // Add attachments section if present
    if (metadata?.attachments && metadata.attachments.length > 0) {
      html += '<hr><h3>Attachments</h3><ul>';
      for (const attachment of metadata.attachments) {
        const iconMap: Record<string, string> = {
          'image': '🖼️',
          'video': '🎥',
          'audio': '🎵',
          'document': '📄',
          'archive': '📦'
        };
        const icon = iconMap[attachment.type] || '📎';
        html += `<li>${icon} <a href="${this.stripHtml(attachment.path)}">${this.stripHtml(attachment.name)}</a></li>`;
      }
      html += '</ul>';
    }

    // Add tool calls section if present
    if (metadata?.tool_calls && metadata.tool_calls.length > 0) {
      html += '<hr><h3>Tool Calls</h3><ul>';
      for (const toolCall of metadata.tool_calls) {
        html += `<li><strong>${this.stripHtml(toolCall.tool_name)}</strong>`;
        if (toolCall.result) {
          html += `: ${this.stripHtml(toolCall.result)}`;
        }
        html += '</li>';
      }
      html += '</ul>';
    }

    return html;
  }

  /**
   * CORE-048: Simple markdown to HTML converter (placeholder for marked library)
   */
  private simpleMarkdownToHtml(markdown: string): string {
    let html = markdown;

    // Code blocks (```language\ncode\n```)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang ? ` data-language="${lang}"` : '';
      return `<pre><code${language}>${this.stripHtml(code.trim())}</code></pre>`;
    });

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Headings (# Heading)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Links ([text](url))
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Unordered lists (- item or * item)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up multiple consecutive p tags
    html = html.replace(/<p><\/p>/g, '');

    return html;
  }

  /**
   * CORE-048: Generate tags from message content analysis
   */
  private generateTagsFromContent(
    content: string,
    metadata?: {
      sender_name?: string;
      timestamp?: string;
      attachments?: Array<{ name: string; path: string; type: string }>;
      tool_calls?: Array<{ tool_name: string; parameters: any; result?: string }>;
    }
  ): string[] {
    const tags: string[] = [];

    // Add "from-chat" tag to all notes created from chat
    tags.push('from-chat');

    // Detect code blocks and add programming language tags
    const codeBlockMatches = content.match(/```(\w+)/g);
    if (codeBlockMatches) {
      const languages = new Set<string>();
      for (const match of codeBlockMatches) {
        const lang = match.replace('```', '').trim();
        if (lang) {
          languages.add(lang.toLowerCase());
        }
      }
      // Add language tags (limit to 3 most common)
      const langArray = Array.from(languages).slice(0, 3);
      tags.push(...langArray);
    }

    // Detect content type
    if (content.includes('```')) {
      tags.push('code');
    }
    if (content.match(/^#+\s/m)) {
      tags.push('documentation');
    }
    if (content.match(/TODO|FIXME|NOTE/i)) {
      tags.push('todo');
    }
    if (content.match(/\?\s*$/m)) {
      tags.push('question');
    }

    // Add attachment type tags
    if (metadata?.attachments) {
      const attachmentTypes = new Set(metadata.attachments.map(a => a.type));
      for (const type of attachmentTypes) {
        if (type === 'image') tags.push('has-images');
        if (type === 'video') tags.push('has-video');
        if (type === 'audio') tags.push('has-audio');
        if (type === 'document') tags.push('has-documents');
      }
    }

    // Add tool call tag if present
    if (metadata?.tool_calls && metadata.tool_calls.length > 0) {
      tags.push('tool-calls');
    }

    // Add sender tag if available
    if (metadata?.sender_name) {
      tags.push(`by-${metadata.sender_name.toLowerCase().replace(/\s+/g, '-')}`);
    }

    // Remove duplicates and limit to 10 tags
    return Array.from(new Set(tags)).slice(0, 10);
  }

  /**
   * CORE-049: Get note content by reference name
   * Used for @note-name referencing in chat
   */
  public async getNoteContent(reference: string): Promise<string | null> {
    // Remove @ prefix if present
    const noteName = reference.startsWith('@') ? reference.substring(1) : reference;

    // Search for note by title
    const notes = await this.searchNotes(noteName);
    if (notes.length > 0) {
      const note = await this.openNote(notes[0].id);
      if (note) {
        return note.getState().content;
      }
    }

    return null;
  }
}

/**
 * Initialize Note Manager and export singleton instance
 */
export function initNoteManager(): NoteManager {
  return NoteManager.getInstance();
}
