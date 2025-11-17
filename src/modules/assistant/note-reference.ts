/**
 * Note Reference Module (CORE-049)
 *
 * @note-name Referencing in Chat
 *
 * Responsibilities:
 * - Parse @note-name references in user input
 * - Resolve note names to note content
 * - Inject note content into chat context
 * - Support partial matching and fuzzy search
 * - Display referenced notes in chat UI
 * - Handle multiple note references in single message
 *
 * Features:
 * - @note-name syntax recognition (e.g., "@meeting-notes")
 * - Fuzzy matching for note titles
 * - Preview of referenced notes in UI
 * - Automatic content injection into API request
 * - Visual indication of note references
 * - Support for multiple references
 * - Cache recently referenced notes
 * - Error handling for missing notes
 *
 * Architecture:
 * - NoteReferenceParser: Parse @note-name from text
 * - NoteReferenceResolver: Resolve names to note content
 * - NoteReferenceCache: Cache resolved notes
 * - NoteReferenceUI: Display referenced notes
 *
 * Usage:
 * ```typescript
 * import { NoteReferenceManager } from './modules/assistant/note-reference';
 *
 * const refManager = NoteReferenceManager.getInstance();
 *
 * // Parse references from user input
 * const refs = refManager.parseReferences(userInput);
 *
 * // Resolve note content
 * const content = await refManager.resolveReference('@meeting-notes');
 *
 * // Inject into message
 * const enrichedMessage = await refManager.enrichMessageWithNotes(userInput);
 * ```
 */

import { NoteManager, NoteMetadata } from '../note/notes';

/**
 * Note reference structure
 */
export interface NoteReference {
  /**
   * Original reference string (e.g., "@meeting-notes")
   */
  reference: string;

  /**
   * Extracted note name (e.g., "meeting-notes")
   */
  noteName: string;

  /**
   * Start position in text
   */
  startIndex: number;

  /**
   * End position in text
   */
  endIndex: number;

  /**
   * Whether the reference was successfully resolved
   */
  resolved: boolean;

  /**
   * Resolved note ID
   */
  noteId?: string;

  /**
   * Resolved note title
   */
  noteTitle?: string;

  /**
   * Match confidence (0.0 - 1.0 for fuzzy matching)
   */
  confidence?: number;
}

/**
 * Enriched message with note content
 */
export interface EnrichedMessage {
  /**
   * Original user input
   */
  originalContent: string;

  /**
   * Enriched content with note content injected
   */
  enrichedContent: string;

  /**
   * Detected note references
   */
  references: NoteReference[];

  /**
   * Total number of references found
   */
  referenceCount: number;

  /**
   * Number of successfully resolved references
   */
  resolvedCount: number;

  /**
   * Whether any references failed to resolve
   */
  hasUnresolvedReferences: boolean;
}

/**
 * Cached note entry
 */
interface CachedNote {
  noteId: string;
  noteName: string;
  content: string;
  timestamp: number;
}

/**
 * Note Reference Manager
 * Singleton manager for parsing and resolving @note-name references
 */
export class NoteReferenceManager {
  private static instance: NoteReferenceManager;
  private noteManager: NoteManager;
  private cache: Map<string, CachedNote> = new Map();
  private cacheMaxSize = 20;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.noteManager = NoteManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NoteReferenceManager {
    if (!NoteReferenceManager.instance) {
      NoteReferenceManager.instance = new NoteReferenceManager();
    }
    return NoteReferenceManager.instance;
  }

  /**
   * Parse @note-name references from text
   *
   * Matches:
   * - @note-name (alphanumeric with hyphens/underscores)
   * - @"note name with spaces" (quoted for spaces)
   *
   * Examples:
   * - @meeting-notes
   * - @project_spec
   * - @"My Personal Notes"
   */
  public parseReferences(text: string): NoteReference[] {
    const references: NoteReference[] = [];

    // Pattern 1: @note-name (no spaces, alphanumeric + hyphen/underscore)
    const simplePattern = /@([\w\-]+)/g;
    let match;

    while ((match = simplePattern.exec(text)) !== null) {
      references.push({
        reference: match[0],
        noteName: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        resolved: false
      });
    }

    // Pattern 2: @"note name with spaces" (quoted)
    const quotedPattern = /@"([^"]+)"/g;

    while ((match = quotedPattern.exec(text)) !== null) {
      references.push({
        reference: match[0],
        noteName: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        resolved: false
      });
    }

    console.log(`[NoteReference] Parsed ${references.length} reference(s) from text`);
    return references;
  }

  /**
   * Resolve a single note reference to note content
   *
   * Resolution strategy:
   * 1. Check cache first
   * 2. Exact title match
   * 3. Case-insensitive match
   * 4. Fuzzy match (substring search)
   * 5. Return null if no match found
   */
  public async resolveReference(reference: NoteReference): Promise<string | null> {
    const noteName = reference.noteName;

    // Check cache first
    const cached = this.getFromCache(noteName);
    if (cached) {
      console.log(`[NoteReference] Cache hit for: ${noteName}`);
      reference.resolved = true;
      reference.noteId = cached.noteId;
      reference.noteTitle = cached.noteName;
      reference.confidence = 1.0;
      return cached.content;
    }

    // Get all notes
    const allNotes = await this.noteManager.listSavedNotes();

    // Try exact match first
    let matchedNote = allNotes.find(note => note.title === noteName);
    if (matchedNote) {
      console.log(`[NoteReference] Exact match found: ${matchedNote.title}`);
      return await this.resolveNoteById(matchedNote, reference, 1.0);
    }

    // Try case-insensitive match
    const lowerNoteName = noteName.toLowerCase();
    matchedNote = allNotes.find(note => note.title.toLowerCase() === lowerNoteName);
    if (matchedNote) {
      console.log(`[NoteReference] Case-insensitive match found: ${matchedNote.title}`);
      return await this.resolveNoteById(matchedNote, reference, 0.95);
    }

    // Try fuzzy match (substring search)
    matchedNote = allNotes.find(note =>
      note.title.toLowerCase().includes(lowerNoteName) ||
      lowerNoteName.includes(note.title.toLowerCase())
    );
    if (matchedNote) {
      console.log(`[NoteReference] Fuzzy match found: ${matchedNote.title}`);
      return await this.resolveNoteById(matchedNote, reference, 0.8);
    }

    // No match found
    console.warn(`[NoteReference] No match found for: ${noteName}`);
    reference.resolved = false;
    return null;
  }

  /**
   * Resolve note by ID and cache result
   */
  private async resolveNoteById(
    noteMetadata: NoteMetadata,
    reference: NoteReference,
    confidence: number
  ): Promise<string> {
    const note = await this.noteManager.openNote(noteMetadata.id);
    if (!note) {
      reference.resolved = false;
      return '';
    }

    const content = note.getState().content;

    // Update reference
    reference.resolved = true;
    reference.noteId = noteMetadata.id;
    reference.noteTitle = noteMetadata.title;
    reference.confidence = confidence;

    // Add to cache
    this.addToCache(reference.noteName, noteMetadata.id, noteMetadata.title, content);

    return content;
  }

  /**
   * Enrich message with note content
   *
   * Replaces @note-name references with actual note content
   * wrapped in special markers for chat UI
   */
  public async enrichMessageWithNotes(userInput: string): Promise<EnrichedMessage> {
    const references = this.parseReferences(userInput);

    if (references.length === 0) {
      return {
        originalContent: userInput,
        enrichedContent: userInput,
        references: [],
        referenceCount: 0,
        resolvedCount: 0,
        hasUnresolvedReferences: false
      };
    }

    console.log(`[NoteReference] Enriching message with ${references.length} reference(s)`);

    // Resolve all references
    const resolutions = await Promise.all(
      references.map(ref => this.resolveReference(ref))
    );

    // Build enriched content
    let enrichedContent = userInput;
    let resolvedCount = 0;

    // Replace references in reverse order (to preserve indices)
    for (let i = references.length - 1; i >= 0; i--) {
      const ref = references[i];
      const content = resolutions[i];

      if (content) {
        resolvedCount++;

        // Format note content insertion
        const insertion = this.formatNoteInsertion(ref, content);

        // Replace reference with insertion
        enrichedContent =
          enrichedContent.substring(0, ref.startIndex) +
          insertion +
          enrichedContent.substring(ref.endIndex);
      } else {
        // Replace with error marker
        const errorMarker = `[Note not found: ${ref.noteName}]`;
        enrichedContent =
          enrichedContent.substring(0, ref.startIndex) +
          errorMarker +
          enrichedContent.substring(ref.endIndex);
      }
    }

    const hasUnresolvedReferences = resolvedCount < references.length;

    console.log(`[NoteReference] Resolved ${resolvedCount}/${references.length} reference(s)`);

    return {
      originalContent: userInput,
      enrichedContent,
      references,
      referenceCount: references.length,
      resolvedCount,
      hasUnresolvedReferences
    };
  }

  /**
   * Format note content insertion for chat
   */
  private formatNoteInsertion(reference: NoteReference, content: string): string {
    // Strip HTML tags for plain text content
    const plainContent = this.stripHtmlTags(content);

    // Truncate if too long (limit to 500 chars)
    const truncated = plainContent.length > 500
      ? plainContent.substring(0, 497) + '...'
      : plainContent;

    // Format with note title and content
    return `\n\n---\n**[Note: ${reference.noteTitle || reference.noteName}]**\n\n${truncated}\n\n---\n\n`;
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtmlTags(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Get note content from cache
   */
  private getFromCache(noteName: string): CachedNote | null {
    const cached = this.cache.get(noteName.toLowerCase());

    if (!cached) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(noteName.toLowerCase());
      console.log(`[NoteReference] Cache expired for: ${noteName}`);
      return null;
    }

    return cached;
  }

  /**
   * Add note to cache
   */
  private addToCache(noteName: string, noteId: string, noteTitle: string, content: string): void {
    // Enforce cache size limit
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(noteName.toLowerCase(), {
      noteId,
      noteName: noteTitle,
      content,
      timestamp: Date.now()
    });

    console.log(`[NoteReference] Cached note: ${noteName} (cache size: ${this.cache.size})`);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('[NoteReference] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number; timeoutMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      timeoutMs: this.cacheTimeout
    };
  }

  /**
   * Display referenced notes in chat UI
   * (Placeholder for UI integration)
   */
  public renderReferencePreview(reference: NoteReference, content: string): HTMLElement {
    const preview = document.createElement('div');
    preview.className = 'note-reference-preview';

    preview.innerHTML = `
      <div class="note-reference-header">
        <span class="note-reference-icon">📝</span>
        <span class="note-reference-title">${this.escapeHtml(reference.noteTitle || reference.noteName)}</span>
        <span class="note-reference-confidence">${Math.round((reference.confidence || 0) * 100)}% match</span>
      </div>
      <div class="note-reference-content">
        ${this.escapeHtml(this.stripHtmlTags(content).substring(0, 200))}...
      </div>
      <div class="note-reference-actions">
        <button class="note-reference-btn" data-note-id="${reference.noteId}">Open Note</button>
      </div>
    `;

    return preview;
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
}

/**
 * Initialize Note Reference Manager and export singleton instance
 */
export function initNoteReferenceManager(): NoteReferenceManager {
  return NoteReferenceManager.getInstance();
}

/**
 * Helper function to check if text contains note references
 */
export function hasNoteReferences(text: string): boolean {
  return /@[\w\-]+/.test(text) || /@"[^"]+"/.test(text);
}

/**
 * Helper function to extract all note names from text
 */
export function extractNoteNames(text: string): string[] {
  const manager = NoteReferenceManager.getInstance();
  const references = manager.parseReferences(text);
  return references.map(ref => ref.noteName);
}
