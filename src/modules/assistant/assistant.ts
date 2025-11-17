/**
 * Assistant Module - Main chat interface
 * Handles agent selection, topic management, message sending, and UI interactions
 */

import { listAgents, listTopics, readConversation, writeConversation, isTauriAvailable } from '../../core/ipc/commands';
import { readSettings, writeSettings } from '../../core/ipc/commands';
import type { Agent, Topic, Message, GlobalSettings } from '../../core/models';
import { initI18n, t, formatCharCount } from '../../core/i18n/i18nHelper';
import { messageRenderer } from '../../core/renderer/messageRenderer';

// ========== State Management ==========
interface AppState {
  activeAgent: Agent | null;
  activeTopic: Topic | null;
  settings: GlobalSettings | null;
  agents: Agent[];
  topics: Topic[];
  isStreaming: boolean;
}

const state: AppState = {
  activeAgent: null,
  activeTopic: null,
  settings: null,
  agents: [],
  topics: [],
  isStreaming: false,
};

// ========== DOM Elements ==========
let elements: {
  // Sidebar
  agentSelect: HTMLSelectElement;
  newTopicBtn: HTMLButtonElement;
  topicsList: HTMLElement;

  // Title Bar
  currentTopicTitle: HTMLElement;
  currentAgentName: HTMLElement;
  settingsBtn: HTMLButtonElement;
  minimizeBtn: HTMLButtonElement;
  maximizeBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;

  // Chat Area
  chatContainer: HTMLElement;
  welcomeScreen: HTMLElement;
  messagesList: HTMLElement;
  messageInput: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  attachBtn: HTMLButtonElement;
  charCount: HTMLElement;
  streamingIndicator: HTMLElement;

  // Notifications
  notificationsList: HTMLElement;
  clearNotificationsBtn: HTMLButtonElement;
} | null = null;

// ========== Initialization ==========
async function initializeApp() {
  console.log('[Assistant] Initializing application...');

  // Check Tauri availability
  if (!isTauriAvailable()) {
    console.warn('[Assistant] Tauri not available - running in browser mode');
    showError('Application must run in Tauri environment');
    return;
  }

  // Get DOM elements
  elements = {
    // Sidebar
    agentSelect: document.getElementById('active-agent-select') as HTMLSelectElement,
    newTopicBtn: document.getElementById('new-topic-btn') as HTMLButtonElement,
    topicsList: document.getElementById('topics-list') as HTMLElement,

    // Title Bar
    currentTopicTitle: document.getElementById('current-topic-title') as HTMLElement,
    currentAgentName: document.getElementById('current-agent-name') as HTMLElement,
    settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
    minimizeBtn: document.getElementById('minimize-btn') as HTMLButtonElement,
    maximizeBtn: document.getElementById('maximize-btn') as HTMLButtonElement,
    closeBtn: document.getElementById('close-btn') as HTMLButtonElement,

    // Chat Area
    chatContainer: document.getElementById('chat-container') as HTMLElement,
    welcomeScreen: document.getElementById('welcome-screen') as HTMLElement,
    messagesList: document.getElementById('messages-list') as HTMLElement,
    messageInput: document.getElementById('message-input') as HTMLTextAreaElement,
    sendBtn: document.getElementById('send-btn') as HTMLButtonElement,
    attachBtn: document.getElementById('attach-btn') as HTMLButtonElement,
    charCount: document.getElementById('char-count') as HTMLElement,
    streamingIndicator: document.getElementById('streaming-indicator') as HTMLElement,

    // Notifications
    notificationsList: document.getElementById('notifications-list') as HTMLElement,
    clearNotificationsBtn: document.getElementById('clear-notifications-btn') as HTMLButtonElement,
  };

  // Load settings
  try {
    state.settings = await readSettings();
    console.log('[Assistant] Settings loaded:', state.settings);

    // Initialize i18n with language from settings
    initI18n(state.settings.language);
  } catch (error) {
    console.warn('[Assistant] Failed to load settings, using defaults:', error);
    state.settings = getDefaultSettings();

    // Initialize i18n with default language (zh-CN)
    initI18n(state.settings.language);
  }

  // Load agents
  try {
    state.agents = await listAgents();
    console.log(`[Assistant] Loaded ${state.agents.length} agents`);
    populateAgentSelect();
  } catch (error) {
    console.error('[Assistant] Failed to load agents:', error);
    showError('Failed to load agents');
  }

  // Attach event listeners
  attachEventListeners();

  // Enable input with keyboard shortcuts
  setupKeyboardShortcuts();

  console.log('[Assistant] Initialization complete');
}

// ========== Agent Management ==========
function populateAgentSelect() {
  if (!elements) return;

  const select = elements.agentSelect;
  select.innerHTML = '<option value="">Select Agent...</option>';

  state.agents.forEach(agent => {
    const option = document.createElement('option');
    option.value = agent.id;
    option.textContent = agent.name;
    select.appendChild(option);
  });
}

async function handleAgentSelect() {
  if (!elements) return;

  const agentId = elements.agentSelect.value;
  if (!agentId) {
    state.activeAgent = null;
    state.topics = [];
    renderTopicsList();
    showWelcomeScreen();
    disableInput();
    return;
  }

  // Find agent
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) {
    console.error('[Assistant] Agent not found:', agentId);
    return;
  }

  state.activeAgent = agent;
  console.log('[Assistant] Selected agent:', agent.name);

  // Update UI
  if (elements.currentAgentName) {
    elements.currentAgentName.textContent = agent.name;
  }

  // Load topics for this agent
  try {
    state.topics = await listTopics(agentId);
    console.log(`[Assistant] Loaded ${state.topics.length} topics for ${agent.name}`);
    renderTopicsList();
  } catch (error) {
    console.error('[Assistant] Failed to load topics:', error);
    state.topics = [];
    renderTopicsList();
  }

  // Show welcome screen initially
  showWelcomeScreen();
  enableInput();
}

// ========== Topic Management ==========
function renderTopicsList() {
  if (!elements) return;

  const list = elements.topicsList;

  if (state.topics.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p class="text-secondary">No conversations yet</p>
        <p class="text-tertiary text-sm">Click + to start a new topic</p>
      </div>
    `;
    return;
  }

  // Sort topics by updated_at (newest first)
  const sortedTopics = [...state.topics].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  list.innerHTML = sortedTopics.map(topic => {
    const isActive = state.activeTopic?.id === topic.id;
    const lastMessage = topic.messages[topic.messages.length - 1];
    const preview = lastMessage ? truncate(lastMessage.content, 50) : 'No messages';
    const date = formatDate(topic.updated_at);

    return `
      <div class="topic-item ${isActive ? 'active' : ''}" data-topic-id="${topic.id}">
        <div class="topic-content">
          <div class="topic-title">${escapeHtml(topic.title)}</div>
          <div class="topic-preview">${escapeHtml(preview)}</div>
          <div class="topic-date">${date}</div>
        </div>
        <div class="topic-actions">
          <button class="button-icon topic-delete-btn" title="Delete" data-topic-id="${topic.id}">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach click handlers
  list.querySelectorAll('.topic-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.topic-delete-btn')) return; // Don't load topic when deleting

      const topicId = (item as HTMLElement).dataset.topicId;
      if (topicId) handleTopicSelect(topicId);
    });
  });

  // Attach delete handlers
  list.querySelectorAll('.topic-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const topicId = (btn as HTMLElement).dataset.topicId;
      if (topicId) handleTopicDelete(topicId);
    });
  });
}

async function handleTopicSelect(topicId: string) {
  if (!state.activeAgent) return;

  console.log('[Assistant] Loading topic:', topicId);

  try {
    const topic = await readConversation(topicId);
    state.activeTopic = topic;

    // Update UI
    if (elements?.currentTopicTitle) {
      elements.currentTopicTitle.textContent = topic.title;
    }

    // Render messages
    renderMessages();
    hideWelcomeScreen();
    enableInput();

    // Re-render topics list to update active state
    renderTopicsList();
  } catch (error) {
    console.error('[Assistant] Failed to load topic:', error);
    showError('Failed to load conversation');
  }
}

async function handleTopicDelete(topicId: string) {
  // TODO: Implement delete confirmation dialog
  console.log('[Assistant] Delete topic:', topicId);
  showError('Delete functionality not yet implemented');
}

async function handleNewTopic() {
  if (!state.activeAgent) {
    showError('Please select an agent first');
    return;
  }

  console.log('[Assistant] Creating new topic');

  // Create empty topic
  const newTopic: Topic = {
    id: generateUUID(),
    owner_id: state.activeAgent.id,
    owner_type: 'agent',
    title: 'New Conversation',
    messages: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    await writeConversation(newTopic);
    state.topics.push(newTopic);
    state.activeTopic = newTopic;

    // Update UI
    if (elements?.currentTopicTitle) {
      elements.currentTopicTitle.textContent = newTopic.title;
    }

    renderTopicsList();
    renderMessages();
    hideWelcomeScreen();
    enableInput();

    // Focus input
    elements?.messageInput.focus();
  } catch (error) {
    console.error('[Assistant] Failed to create topic:', error);
    showError('Failed to create new conversation');
  }
}

// ========== Message Rendering ==========
function renderMessages() {
  if (!elements || !state.activeTopic) return;

  const list = elements.messagesList;

  if (state.activeTopic.messages.length === 0) {
    list.innerHTML = '';
    list.classList.add('hidden');
    return;
  }

  list.classList.remove('hidden');
  list.innerHTML = state.activeTopic.messages.map(message => renderMessage(message)).join('');

  // Scroll to bottom
  scrollToBottom();
}

function renderMessage(message: Message): string {
  const isUser = message.sender === 'user';
  const senderName = message.sender_name || (isUser ? 'User' : state.activeAgent?.name || 'Agent');
  const avatar = isUser ? getUserInitial() : getAgentInitial();
  const time = formatTime(message.timestamp);
  const streamingClass = message.is_streaming ? 'streaming' : '';

  // CRITICAL: Use messageRenderer to render content with Markdown and LaTeX support
  const renderedContent = messageRenderer.render(message);

  return `
    <div class="message ${message.sender}">
      <div class="message-avatar">${avatar}</div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-sender">${escapeHtml(senderName)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-content ${streamingClass}">
          ${renderedContent}
        </div>
      </div>
    </div>
  `;
}

function addMessageToUI(message: Message) {
  if (!elements || !state.activeTopic) return;

  const list = elements.messagesList;
  list.classList.remove('hidden');
  list.insertAdjacentHTML('beforeend', renderMessage(message));
  scrollToBottom();
}

function updateStreamingMessage(messageId: string, content: string) {
  if (!elements) return;

  const messageElement = Array.from(elements.messagesList.querySelectorAll('.message'))
    .find(el => {
      // Find message by matching content (simplified for now)
      return el.querySelector('.message-content.streaming');
    });

  if (messageElement) {
    const contentElement = messageElement.querySelector('.message-content');
    if (contentElement) {
      contentElement.textContent = content;
    }
  }

  scrollToBottom();
}

function finalizeStreamingMessage(messageId: string) {
  if (!elements) return;

  const messageElement = Array.from(elements.messagesList.querySelectorAll('.message'))
    .find(el => {
      return el.querySelector('.message-content.streaming');
    });

  if (messageElement) {
    const contentElement = messageElement.querySelector('.message-content');
    if (contentElement) {
      contentElement.classList.remove('streaming');
    }
  }
}

// ========== Message Sending ==========
async function handleSendMessage() {
  if (!elements || !state.activeTopic || !state.activeAgent) return;
  if (state.isStreaming) return;

  const input = elements.messageInput;
  const content = input.value.trim();

  if (!content) return;

  console.log('[Assistant] Sending message:', content.substring(0, 50) + '...');

  // Create user message
  const userMessage: Message = {
    id: generateUUID(),
    sender: 'user',
    sender_name: state.settings?.user_name || 'User',
    content: content,
    attachments: [],
    timestamp: new Date().toISOString(),
    is_streaming: false,
  };

  // Add to topic
  state.activeTopic.messages.push(userMessage);
  addMessageToUI(userMessage);

  // Clear input
  input.value = '';
  updateCharCount();

  // Disable input during streaming
  state.isStreaming = true;
  disableInput();
  showStreamingIndicator();

  // Create agent message placeholder
  const agentMessage: Message = {
    id: generateUUID(),
    sender: 'agent',
    sender_id: state.activeAgent.id,
    sender_name: state.activeAgent.name,
    content: '',
    attachments: [],
    timestamp: new Date().toISOString(),
    is_streaming: true,
  };

  state.activeTopic.messages.push(agentMessage);
  addMessageToUI(agentMessage);

  // TODO: Implement ChatCompletion streaming
  // For now, just simulate a response
  simulateStreamingResponse(agentMessage);
}

async function simulateStreamingResponse(message: Message) {
  const responses = [
    "I'm here to help you! ",
    "Let me think about that... ",
    "Based on what you've said, ",
    "I understand your question. ",
    "Here's my response: ",
  ];

  const response = responses[Math.floor(Math.random() * responses.length)] +
    "This is a simulated response. The real ChatCompletion integration will be implemented next.";

  // Simulate streaming character by character
  for (let i = 0; i <= response.length; i++) {
    message.content = response.substring(0, i);
    updateStreamingMessage(message.id, message.content);
    await sleep(20); // 20ms per character
  }

  // Finalize message
  message.is_streaming = false;
  finalizeStreamingMessage(message.id);

  // Update topic
  if (state.activeTopic) {
    state.activeTopic.updated_at = new Date().toISOString();

    // Auto-generate title from first user message if still "New Conversation"
    if (state.activeTopic.title === 'New Conversation' && state.activeTopic.messages.length >= 2) {
      const firstUserMessage = state.activeTopic.messages.find(m => m.sender === 'user');
      if (firstUserMessage) {
        state.activeTopic.title = truncate(firstUserMessage.content, 50);
        if (elements?.currentTopicTitle) {
          elements.currentTopicTitle.textContent = state.activeTopic.title;
        }
      }
    }

    // Save conversation
    try {
      await writeConversation(state.activeTopic);
      renderTopicsList(); // Update sidebar
    } catch (error) {
      console.error('[Assistant] Failed to save conversation:', error);
    }
  }

  // Re-enable input
  state.isStreaming = false;
  enableInput();
  hideStreamingIndicator();
}

// ========== Input Management ==========
function setupKeyboardShortcuts() {
  if (!elements) return;

  // Ctrl+Enter to send message
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto-resize textarea
  elements.messageInput.addEventListener('input', () => {
    updateCharCount();
    autoResizeTextarea();
  });
}

function autoResizeTextarea() {
  if (!elements) return;

  const textarea = elements.messageInput;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function updateCharCount() {
  if (!elements) return;

  const count = elements.messageInput.value.length;
  elements.charCount.textContent = formatCharCount(count);
}

function enableInput() {
  if (!elements) return;

  elements.messageInput.disabled = false;
  elements.sendBtn.disabled = false;
  elements.attachBtn.disabled = false;
  elements.messageInput.placeholder = 'Type your message... (Ctrl+Enter to send)';
}

function disableInput() {
  if (!elements) return;

  elements.messageInput.disabled = true;
  elements.sendBtn.disabled = true;
  elements.attachBtn.disabled = true;
  elements.messageInput.placeholder = 'Select an agent to start chatting...';
}

function showStreamingIndicator() {
  if (!elements) return;
  elements.streamingIndicator.classList.remove('hidden');
}

function hideStreamingIndicator() {
  if (!elements) return;
  elements.streamingIndicator.classList.add('hidden');
}

// ========== UI Helpers ==========
function showWelcomeScreen() {
  if (!elements) return;
  elements.welcomeScreen.classList.remove('hidden');
  elements.messagesList.classList.add('hidden');
}

function hideWelcomeScreen() {
  if (!elements) return;
  elements.welcomeScreen.classList.add('hidden');
  elements.messagesList.classList.remove('hidden');
}

function scrollToBottom() {
  if (!elements) return;
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function showError(message: string) {
  console.error('[Assistant] Error:', message);
  // TODO: Implement toast notification system
  alert(message);
}

function getUserInitial(): string {
  if (state.settings?.user_name) {
    return state.settings.user_name.charAt(0).toUpperCase();
  }
  return 'U';
}

function getAgentInitial(): string {
  if (state.activeAgent?.name) {
    return state.activeAgent.name.charAt(0).toUpperCase();
  }
  return 'A';
}

// ========== Event Listeners ==========
function attachEventListeners() {
  if (!elements) return;

  // Agent selection
  elements.agentSelect.addEventListener('change', handleAgentSelect);

  // New topic
  elements.newTopicBtn.addEventListener('click', handleNewTopic);

  // Send message
  elements.sendBtn.addEventListener('click', handleSendMessage);

  // Window controls
  elements.minimizeBtn.addEventListener('click', () => {
    console.log('[Assistant] Minimize clicked');
    // TODO: Implement window minimize
  });

  elements.maximizeBtn.addEventListener('click', () => {
    console.log('[Assistant] Maximize clicked');
    // TODO: Implement window maximize
  });

  elements.closeBtn.addEventListener('click', () => {
    console.log('[Assistant] Close clicked');
    // TODO: Implement window close
  });

  elements.settingsBtn.addEventListener('click', () => {
    console.log('[Assistant] Settings clicked');
    // TODO: Implement settings modal
  });

  // Notifications
  elements.clearNotificationsBtn.addEventListener('click', () => {
    console.log('[Assistant] Clear notifications clicked');
    // TODO: Implement clear notifications
  });
}

// ========== Utilities ==========
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDefaultSettings(): GlobalSettings {
  return {
    backend_url: 'http://localhost:6005/v1/chat/completions',
    api_key: '',
    user_name: 'User',
    user_avatar: 'assets/avatars/default-user.png',
    theme: 'claude-light',
    sidebar_widths: {
      agents_list: 280,
      notifications: 300,
    },
    window_preferences: {
      always_on_top: false,
      transparency: 1.0,
      startup_behavior: 'normal',
      width: 1200,
      height: 800,
      x: 100,
      y: 100,
    },
    keyboard_shortcuts: [
      { action: 'send_message', keys: 'Ctrl+Enter' },
      { action: 'new_topic', keys: 'Ctrl+N' },
      { action: 'search', keys: 'Ctrl+F' },
    ],
  };
}

// ========== Application Entry Point ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
