/**
 * Message List Component with Virtual Scrolling
 *
 * Implements efficient rendering for 1000+ messages using virtual scrolling.
 * Only renders visible messages plus a small buffer above/below viewport.
 *
 * Features:
 * - Virtual scrolling for performance (render ~20-30 messages at a time)
 * - Automatic scroll to bottom on new messages
 * - Smooth scrolling with momentum
 * - Message height estimation and caching
 * - Intersection Observer for lazy loading
 *
 * CORE-010: Message list with virtual scrolling for 1000+ messages
 */

import { Message } from '../../core/models/message';
import { messageRenderer, MessageRenderer } from '../../core/renderer/messageRenderer';
import { getContentProcessor } from '../../core/renderer/contentProcessor';
import { getDOMCache } from '../../core/managers/domCache';
import { AvatarManager } from './avatar';

interface VirtualScrollState {
  scrollTop: number;
  viewportHeight: number;
  totalHeight: number;
  startIndex: number;
  endIndex: number;
}

export class MessageList {
  private container: HTMLElement;
  private scrollContainer: HTMLElement;
  private contentContainer: HTMLElement;
  private messages: Message[] = [];

  // Avatar configuration (CORE-014)
  private userAvatar: string = 'assets/avatars/default-user.png';
  private agentAvatars: Map<string, string> = new Map();
  private avatarManager = AvatarManager.getInstance();

  // Virtual scrolling configuration
  private readonly ITEM_HEIGHT_ESTIMATE = 100; // Default message height estimate
  private readonly BUFFER_SIZE = 5; // Render 5 extra messages above/below viewport
  private readonly SCROLL_THROTTLE_MS = 16; // ~60fps

  // DOM cache manager for automatic GC (CORE-012A)
  private domCache = getDOMCache();

  // Height cache for accurate virtual scrolling
  private heightCache: Map<string, number> = new Map();

  // Scroll state
  private state: VirtualScrollState = {
    scrollTop: 0,
    viewportHeight: 0,
    totalHeight: 0,
    startIndex: 0,
    endIndex: 0
  };

  // Observers
  private resizeObserver?: ResizeObserver;
  private scrollThrottleTimer?: number;

  // Auto-scroll behavior
  private autoScrollEnabled = true;
  private userScrolling = false;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }

    this.container = container;
    this.scrollContainer = this.createScrollContainer();
    this.contentContainer = this.createContentContainer();

    this.scrollContainer.appendChild(this.contentContainer);
    this.container.appendChild(this.scrollContainer);

    this.attachEventListeners();
    this.initializeResizeObserver();
  }

  /**
   * Create scroll container element
   */
  private createScrollContainer(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'message-list-scroll';
    element.style.cssText = `
      position: relative;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
    `;
    return element;
  }

  /**
   * Create content container for messages
   */
  private createContentContainer(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'message-list-content';
    element.style.cssText = `
      position: relative;
      width: 100%;
    `;
    return element;
  }

  /**
   * Attach scroll and interaction event listeners
   */
  private attachEventListeners(): void {
    // Throttled scroll handler
    this.scrollContainer.addEventListener('scroll', () => {
      if (this.scrollThrottleTimer) {
        clearTimeout(this.scrollThrottleTimer);
      }

      this.scrollThrottleTimer = window.setTimeout(() => {
        this.handleScroll();
      }, this.SCROLL_THROTTLE_MS);
    });

    // Detect user scrolling (disable auto-scroll to bottom)
    this.scrollContainer.addEventListener('wheel', () => {
      this.userScrolling = true;
      this.checkAutoScrollReEnable();
    });

    this.scrollContainer.addEventListener('touchstart', () => {
      this.userScrolling = true;
      this.checkAutoScrollReEnable();
    });
  }

  /**
   * Initialize ResizeObserver to track message heights
   */
  private initializeResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const messageElement = entry.target as HTMLElement;
        const messageId = messageElement.dataset.messageId;

        if (messageId) {
          const height = entry.contentRect.height;
          this.heightCache.set(messageId, height);
        }
      }

      // Recalculate total height and update virtual scroll
      this.updateVirtualScroll();
    });
  }

  /**
   * Handle scroll events
   */
  private handleScroll(): void {
    this.state.scrollTop = this.scrollContainer.scrollTop;
    this.updateVirtualScroll();
  }

  /**
   * Check if user scrolled to bottom to re-enable auto-scroll
   */
  private checkAutoScrollReEnable(): void {
    const threshold = 50; // px from bottom
    const scrollBottom = this.state.scrollTop + this.state.viewportHeight;
    const isNearBottom = (this.state.totalHeight - scrollBottom) < threshold;

    if (isNearBottom) {
      this.autoScrollEnabled = true;
      this.userScrolling = false;
    }
  }

  /**
   * Calculate which messages should be rendered based on scroll position
   */
  private calculateVisibleRange(): { startIndex: number; endIndex: number } {
    const { scrollTop, viewportHeight } = this.state;

    let accumulatedHeight = 0;
    let startIndex = 0;
    let endIndex = 0;

    // Find start index
    for (let i = 0; i < this.messages.length; i++) {
      const height = this.getMessageHeight(i);

      if (accumulatedHeight + height > scrollTop) {
        startIndex = Math.max(0, i - this.BUFFER_SIZE);
        break;
      }

      accumulatedHeight += height;
    }

    // Find end index
    const viewportBottom = scrollTop + viewportHeight;
    accumulatedHeight = this.getOffsetTop(startIndex);

    for (let i = startIndex; i < this.messages.length; i++) {
      const height = this.getMessageHeight(i);
      accumulatedHeight += height;

      endIndex = i;

      if (accumulatedHeight > viewportBottom + (this.BUFFER_SIZE * this.ITEM_HEIGHT_ESTIMATE)) {
        break;
      }
    }

    return { startIndex, endIndex: Math.min(endIndex, this.messages.length - 1) };
  }

  /**
   * Get message height (from cache or estimate)
   */
  private getMessageHeight(index: number): number {
    const message = this.messages[index];
    if (!message) return this.ITEM_HEIGHT_ESTIMATE;

    return this.heightCache.get(message.id) || this.ITEM_HEIGHT_ESTIMATE;
  }

  /**
   * Get Y offset for a message at given index
   */
  private getOffsetTop(index: number): number {
    let offset = 0;

    for (let i = 0; i < index; i++) {
      offset += this.getMessageHeight(i);
    }

    return offset;
  }

  /**
   * Calculate total height of all messages
   */
  private calculateTotalHeight(): number {
    let total = 0;

    for (let i = 0; i < this.messages.length; i++) {
      total += this.getMessageHeight(i);
    }

    return total;
  }

  /**
   * Update virtual scroll rendering
   */
  private updateVirtualScroll(): void {
    this.state.viewportHeight = this.scrollContainer.clientHeight;
    this.state.totalHeight = this.calculateTotalHeight();

    const { startIndex, endIndex } = this.calculateVisibleRange();

    // Only re-render if visible range changed
    if (startIndex !== this.state.startIndex || endIndex !== this.state.endIndex) {
      this.state.startIndex = startIndex;
      this.state.endIndex = endIndex;
      this.renderVisibleMessages();
    }

    // Update content container height
    this.contentContainer.style.height = `${this.state.totalHeight}px`;
  }

  /**
   * Render only visible messages
   */
  private renderVisibleMessages(): void {
    const { startIndex, endIndex } = this.state;
    const fragment = document.createDocumentFragment();

    // Clear existing rendered messages
    this.contentContainer.innerHTML = '';

    // Create spacer for messages above viewport
    const topSpacerHeight = this.getOffsetTop(startIndex);
    if (topSpacerHeight > 0) {
      const topSpacer = document.createElement('div');
      topSpacer.style.height = `${topSpacerHeight}px`;
      fragment.appendChild(topSpacer);
    }

    // Render visible messages
    for (let i = startIndex; i <= endIndex; i++) {
      const message = this.messages[i];
      if (!message) continue;

      const messageElement = this.renderMessage(message);
      fragment.appendChild(messageElement);

      // Observe message element for height changes
      if (this.resizeObserver) {
        this.resizeObserver.observe(messageElement);
      }
    }

    // Create spacer for messages below viewport
    const bottomSpacerHeight = this.state.totalHeight - this.getOffsetTop(endIndex + 1);
    if (bottomSpacerHeight > 0) {
      const bottomSpacer = document.createElement('div');
      bottomSpacer.style.height = `${bottomSpacerHeight}px`;
      fragment.appendChild(bottomSpacer);
    }

    this.contentContainer.appendChild(fragment);
  }

  /**
   * Render a single message element using DOM cache
   */
  private renderMessage(message: Message): HTMLElement {
    // Check DOM cache first (CORE-012A)
    let element = this.domCache.get(message);

    if (!element) {
      // Cache miss - create new element
      element = document.createElement('div');
      element.className = `message message--${message.sender}`;
      element.dataset.messageId = message.id;
      element.dataset.sender = message.sender;

      // CORE-014: Add avatar
      const avatarPath = message.sender === 'user'
        ? this.userAvatar
        : this.agentAvatars.get(message.sender_id || '') || '';

      const fallbackText = AvatarManager.getInitials(message.sender_name || '?');
      const avatar = this.avatarManager.createAvatar(message, avatarPath, {
        size: 32,
        shape: 'circle',
        fallbackText
      });

      // Create message container with avatar and content
      const messageWrapper = document.createElement('div');
      messageWrapper.className = 'message__wrapper';

      messageWrapper.appendChild(avatar);

      const messageContent = document.createElement('div');
      messageContent.className = 'message__content';

      // Use messageRenderer to generate content
      const content = messageRenderer.render(message);
      messageContent.innerHTML = content;

      console.log('[MessageList] Message rendered, content length:', content.length);

      // 🔑 修复：手动调用finalize()来初始化Mermaid图表和其他交互功能
      // 因为messageRenderer.render()是同步方法，不会调用finalize()
      setTimeout(async () => {
        try {
          console.log('[MessageList] Starting finalize process');
          const contentProcessor = getContentProcessor();
          const detectionResult = contentProcessor.detectContentType(message.content, message.sender);
          console.log('[MessageList] Content type detected:', detectionResult.type);

          const messageRendererInstance = MessageRenderer.getInstance();
          const renderer = messageRendererInstance.getRenderer(detectionResult.type);
          console.log('[MessageList] Renderer found:', renderer?.type, 'has finalize:', !!renderer?.finalize);

          if (renderer && renderer.finalize) {
            console.log('[MessageList] Calling finalize() for renderer:', renderer.type);
            await renderer.finalize(messageContent);
            console.log('[MessageList] finalize() completed for renderer:', renderer.type);
          } else {
            console.log('[MessageList] No finalize method available');
          }
        } catch (error) {
          console.error('[MessageList] Failed to finalize renderer:', error);
        }
      }, 100);

      messageWrapper.appendChild(messageContent);
      element.appendChild(messageWrapper);

      // Register message and cache the element (version 0 = initial render)
      this.domCache.registerMessage(message);
      this.domCache.set(message, element, 0);

      // Also cache height if available from ResizeObserver
      const cachedHeight = this.heightCache.get(message.id);
      if (cachedHeight) {
        this.domCache.cacheHeight(message, cachedHeight);
      }
    }

    return element;
  }

  /**
   * Set messages to display
   */
  public setMessages(messages: Message[]): void {
    this.messages = messages;
    this.updateVirtualScroll();

    if (this.autoScrollEnabled && !this.userScrolling) {
      this.scrollToBottom();
    }
  }

  /**
   * Add a new message to the list
   */
  public addMessage(message: Message): void {
    this.messages.push(message);
    this.updateVirtualScroll();

    if (this.autoScrollEnabled && !this.userScrolling) {
      this.scrollToBottom();
    }
  }

  /**
   * Update an existing message (for streaming)
   */
  public updateMessage(messageId: string, updates: Partial<Message>): void {
    const index = this.messages.findIndex(m => m.id === messageId);

    if (index !== -1) {
      const oldMessage = this.messages[index];
      const updatedMessage = { ...oldMessage, ...updates };
      this.messages[index] = updatedMessage;

      // Invalidate cached DOM element (force re-render with new content)
      this.domCache.invalidate(oldMessage);

      // Register updated message
      this.domCache.registerMessage(updatedMessage);

      // Re-render if message is in visible range
      if (index >= this.state.startIndex && index <= this.state.endIndex) {
        this.renderVisibleMessages();
      }

      if (this.autoScrollEnabled && !this.userScrolling) {
        this.scrollToBottom();
      }
    }
  }

  /**
   * Scroll to bottom of message list
   */
  public scrollToBottom(smooth = true): void {
    this.scrollContainer.scrollTo({
      top: this.state.totalHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  /**
   * Scroll to a specific message
   */
  public scrollToMessage(messageId: string, smooth = true): void {
    const index = this.messages.findIndex(m => m.id === messageId);

    if (index !== -1) {
      const offsetTop = this.getOffsetTop(index);

      this.scrollContainer.scrollTo({
        top: offsetTop,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  /**
   * Clear all messages
   */
  public clear(): void {
    this.messages = [];
    this.heightCache.clear();
    this.domCache.clearIndex(); // Clear message index (WeakMap auto-GCs)
    this.contentContainer.innerHTML = '';
    this.state.totalHeight = 0;
  }

  /**
   * CORE-014: Set user avatar path
   */
  public setUserAvatar(avatarPath: string): void {
    this.userAvatar = avatarPath;
    this.avatarManager.clearCache(); // Clear cache to reload avatars
  }

  /**
   * CORE-014: Set agent avatar path
   */
  public setAgentAvatar(agentId: string, avatarPath: string): void {
    this.agentAvatars.set(agentId, avatarPath);
    this.avatarManager.clearSenderCache(agentId); // Clear cache for this agent
  }

  /**
   * CORE-014: Set multiple agent avatars at once
   */
  public setAgentAvatars(avatars: Map<string, string>): void {
    this.agentAvatars = new Map(avatars);
    this.avatarManager.clearCache(); // Clear all avatar cache
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.scrollThrottleTimer) {
      clearTimeout(this.scrollThrottleTimer);
    }

    this.clear();
    this.container.innerHTML = '';
  }
}

/**
 * Factory function to create MessageList instance
 */
export function createMessageList(containerId: string): MessageList {
  return new MessageList(containerId);
}
