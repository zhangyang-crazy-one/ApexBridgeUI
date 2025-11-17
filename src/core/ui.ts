/**
 * UI Initialization (CORE-063)
 *
 * Renders and populates the VCPChat user interface
 *
 * Responsibilities:
 * - Render sidebar agent/group lists
 * - Render chat area with message list and input
 * - Bind event listeners for user interactions
 * - Handle agent/group selection
 * - Display empty states when no data
 *
 * This is a minimal implementation to get the UI functional.
 * Future enhancements will separate this into dedicated components.
 */

import { AgentManager } from './managers/agentManager';
import { GroupManager } from './managers/groupManager';
import { ChatManager } from './managers/chatManager';
import { TopicListManager } from './managers/topicListManager';
import { SettingsManager } from './managers/settingsManager';
import { Agent } from './models/agent';
import { Group } from './models/group';
import { Message } from './models/message';
import { getMessageRenderer } from './renderer/messageRenderer';
import { convertAvatarPath } from './utils/pathUtils';
import { showCustomConfirm } from '../utils/custom-modal';
import { t } from './i18n/i18nManager';

// ❌ Removed global SettingsModal instance - now creating new instance each time
// This matches the pattern used by AgentEditor and GroupEditor

/**
 * Initialize and render the entire UI
 *
 * @param agentManager - Agent manager instance
 * @param groupManager - Group manager instance
 * @param chatManager - Chat manager instance
 */
export async function initializeUI(
  agentManager: AgentManager,
  groupManager: GroupManager,
  chatManager: ChatManager
): Promise<void> {
  console.log('[UI] Initializing user interface...');

  try {
    // Get DOM elements
    const mainContent = document.querySelector('.main-content');
    const leftSidebar = document.querySelector('#sidebar-left');

    if (!mainContent || !leftSidebar) {
      console.error('[UI] Missing DOM elements:', { mainContent: !!mainContent, leftSidebar: !!leftSidebar });
      throw new Error('Required DOM elements not found');
    }

    // Phase 1: Render Left Sidebar (Agent List)
    await renderAgentList(leftSidebar as HTMLElement, agentManager, groupManager);

    // Phase 2: Check if welcome screen exists
    const welcomeScreen = mainContent.querySelector('#welcome-screen');

    if (!welcomeScreen) {
      // No welcome screen - render chat UI directly (old behavior)
      renderChatUI(mainContent as HTMLElement, chatManager);

      // Phase 3: Load first agent if available
      const agents = await agentManager.listAgents();
      if (agents.length > 0) {
        await selectAgent(agents[0], agentManager, chatManager);
      } else {
        renderEmptyState(mainContent as HTMLElement);
      }
    } else {
      // Welcome screen exists - keep it visible until user selects an agent
      console.log('[UI] Welcome screen preserved - will show chat on agent selection');

      // Don't auto-select any agent - let user choose from welcome screen
      // The agent selection will be handled by click events on sidebar items

      // Phase 3: Add navigation handlers to feature cards
      setupWelcomeScreenNavigation(agentManager, chatManager);
    }

    // Phase 4: Bind global settings buttons in right sidebar
    bindSettingsButtons();

    // Phase 5: Register global keyboard shortcuts
    registerKeyboardShortcuts();

    // Phase 6: Bind Canvas launcher button
    bindCanvasLauncher();

    // Phase 7: Setup global event delegation for create buttons
    setupGlobalCreateButtonHandlers(agentManager, groupManager);

    // Phase 8: Setup language change listener to update UI
    window.addEventListener('language-changed', () => {
      console.log('[UI] Language changed - updating sidebar buttons');
      // Re-render the left sidebar to update button texts
      renderAgentList(leftSidebar as HTMLElement, agentManager, groupManager);
    });

    console.log('[UI] ✅ UI initialized successfully');
  } catch (error) {
    console.error('[UI] ❌ UI initialization failed:', error);
    throw error;
  }
}

/**
 * Render agent list in left sidebar
 */
async function renderAgentList(
  container: HTMLElement,
  agentManager: AgentManager,
  groupManager: GroupManager
): Promise<void> {
  const agents = await agentManager.listAgents();
  const groups = await groupManager.listGroups();

  // Target the sidebar-content area (new layout structure)
  const sidebarContent = container.querySelector('#sidebar-left-content');
  if (!sidebarContent) {
    console.error('[UI] Sidebar content container not found');
    return;
  }

  // Render simple list of agents and groups (no tabs, no sections)
  sidebarContent.innerHTML = '';

  // Add action buttons at the top
  const actionButtons = document.createElement('div');
  actionButtons.className = 'sidebar-actions';
  actionButtons.innerHTML = `
    <button class="btn-secondary" id="create-agent-btn" style="flex: 1;">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 6px;">
        <path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span id="create-agent-text">${t('agent.create')}</span>
    </button>
    <button class="btn-secondary" id="create-group-btn" style="flex: 1;">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 6px;">
        <path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span id="create-group-text">${t('group.create')}</span>
    </button>
  `;
  sidebarContent.appendChild(actionButtons);

  // Empty state if no agents or groups
  if (agents.length === 0 && groups.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'sidebar-empty-state';
    emptyState.innerHTML = `
      <p style="color: var(--text-secondary); font-size: var(--font-size-sm); text-align: center; padding: var(--spacing-lg);">
        No agents or groups yet.<br>Click "New Agent" to get started!
      </p>
    `;
    sidebarContent.appendChild(emptyState);

    // Bind create buttons
    bindCreateButtons(agentManager, groupManager);
    return;
  }

  // Create agent list container
  const agentListDiv = document.createElement('div');
  agentListDiv.className = 'agent-list';
  agentListDiv.id = 'agent-list';

  // Create group list container
  const groupListDiv = document.createElement('div');
  groupListDiv.className = 'group-list';
  groupListDiv.id = 'group-list';

  sidebarContent.appendChild(agentListDiv);
  sidebarContent.appendChild(groupListDiv);

  // Render agent items
  if (agents.length > 0) {
    for (const agent of agents) {
      const agentItem = createAgentItem(agent);
      agentListDiv.appendChild(agentItem);

      // Bind click event for selection
      agentItem.addEventListener('click', async () => {
        await selectAgent(agent, agentManager, ChatManager.getInstance());
      });

      // Bind right-click context menu for settings
      agentItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showAgentContextMenu(e, agent, agentManager);
      });
    }
  }

  // Render group items
  if (groups.length > 0) {
    for (const group of groups) {
      const groupItem = createGroupItem(group);
      groupListDiv.appendChild(groupItem);

      // Bind click event for selection
      groupItem.addEventListener('click', async () => {
        await selectGroup(group, groupManager);
      });

      // Bind right-click context menu for settings
      groupItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showGroupContextMenu(e, group, groupManager);
      });
    }
  }

  // Bind create buttons
  bindCreateButtons(agentManager, groupManager);
}

/**
 * Create agent list item element (Anthropic design)
 */
function createAgentItem(agent: Agent): HTMLElement {
  const item = document.createElement('div');
  item.className = 'sidebar-item';
  item.dataset.agentId = agent.id;

  // Create avatar image with error handling and size constraints
  const avatarImg = document.createElement('img');
  const avatarSrc = convertAvatarPath(agent.avatar);
  avatarImg.src = avatarSrc;
  avatarImg.alt = agent.name;
  avatarImg.width = 32;
  avatarImg.height = 32;

  // Add error logging and fallback
  avatarImg.onerror = () => {
    console.error(`[UI] ❌ Failed to load avatar for ${agent.name}: ${agent.avatar} (converted: ${avatarSrc})`);
    const fallbackPath = convertAvatarPath('/assets/avatars/default.svg');
    avatarImg.src = fallbackPath;
  };

  avatarImg.onload = () => {
    console.log(`[UI] ✅ Avatar loaded successfully: ${agent.avatar} -> ${avatarSrc}`);
  };

  // Use Anthropic sidebar-item structure
  item.innerHTML = `
    <div class="sidebar-item-icon"></div>
    <div class="sidebar-item-text">
      <div class="sidebar-item-title">${agent.name}</div>
      <div class="sidebar-item-subtitle">${agent.model}</div>
    </div>
  `;

  // Insert avatar image into icon container
  const iconContainer = item.querySelector('.sidebar-item-icon');
  if (iconContainer) {
    iconContainer.appendChild(avatarImg);
  }

  return item;
}

/**
 * Create group list item element (Anthropic design)
 */
function createGroupItem(group: Group): HTMLElement {
  const item = document.createElement('div');
  item.className = 'sidebar-item';
  item.dataset.groupId = group.id;

  const groupAvatarSrc = convertAvatarPath(group.avatar);
  const fallbackSrc = convertAvatarPath('assets/avatars/default-group.svg');

  // Use Anthropic sidebar-item structure
  item.innerHTML = `
    <div class="sidebar-item-icon">
      <img src="${groupAvatarSrc}" alt="${group.name}" onerror="this.src='${fallbackSrc}'">
    </div>
    <div class="sidebar-item-text">
      <div class="sidebar-item-title">${group.name}</div>
      <div class="sidebar-item-subtitle">${group.collaboration_mode} • ${group.agent_ids.length} agents</div>
    </div>
  `;

  return item;
}

/**
 * Render chat UI in main content area
 */
function renderChatUI(container: HTMLElement, chatManager: ChatManager): void {
  container.innerHTML = `
    <div class="chat-container">
      <div class="chat-header" id="chat-header">
        <div class="chat-header-left">
          <h2 class="chat-title" id="chat-title">Select an agent to start chatting</h2>
        </div>
        <div class="chat-header-right">
          <!-- Action buttons will be added here -->
        </div>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="welcome-message">
          <h2>Welcome to VCPChat</h2>
          <p>Select an agent from the sidebar to begin a conversation</p>
        </div>
      </div>

      <div class="chat-input-area" id="chat-input-area">
        <div class="input-container">
          <button id="attach-button" class="btn-icon" title="Attach file" disabled>
            <svg width="20" height="20" viewBox="0 0 1024 1024" fill="currentColor">
              <path d="M939.616 148.384a287.904 287.904 0 0 0-407.264 0L65.472 609.728c-87.328 87.328-87.328 229.472 0 316.8s229.44 87.328 316.736 0l466.88-461.376a160 160 0 1 0-226.24-226.272L271.872 589.856a32 32 0 1 0 45.248 45.28L668.128 284.128a96.128 96.128 0 0 1 135.744 0 96.096 96.096 0 0 1 0 135.776l-466.88 461.344a159.936 159.936 0 0 1-226.24 0 159.936 159.936 0 0 1 0-226.24L573.056 198.144a223.936 223.936 0 0 1 316.736 0 223.904 223.904 0 0 1 0.064 316.768L543.424 861.376a31.84 31.84 0 0 0 0 45.248 31.904 31.904 0 0 0 45.248 0l350.944-350.976a287.904 287.904 0 0 0 0-407.264z"/>
            </svg>
          </button>
          <textarea
            id="message-input"
            placeholder="Type your message here... (Ctrl+Enter to send)"
            rows="3"
            disabled
          ></textarea>
          <button id="send-button" class="btn-primary" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10l16-8-8 16-2-8-6-2z"/>
            </svg>
            Send
          </button>
        </div>
        <div id="attachments-preview" class="attachments-preview"></div>
      </div>
    </div>
  `;

  // Bind send button
  const sendButton = container.querySelector('#send-button') as HTMLButtonElement;
  const messageInput = container.querySelector('#message-input') as HTMLTextAreaElement;
  const attachButton = container.querySelector('#attach-button') as HTMLButtonElement;
  const attachmentsPreview = container.querySelector('#attachments-preview') as HTMLElement;

  // Store attachments
  let selectedAttachments: any[] = [];

  if (sendButton && messageInput) {
    sendButton.addEventListener('click', () => {
      sendMessage(messageInput, chatManager, selectedAttachments);
      selectedAttachments = [];
      if (attachmentsPreview) attachmentsPreview.innerHTML = '';
    });

    // Ctrl+Enter to send
    messageInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendMessage(messageInput, chatManager, selectedAttachments);
        selectedAttachments = [];
        if (attachmentsPreview) attachmentsPreview.innerHTML = '';
      }
    });
  }

  // Bind attach button
  if (attachButton) {
    attachButton.addEventListener('click', async () => {
      console.log('[UI] Attach button clicked');
      try {
        // Check if running in Tauri environment
        const isTauri = '__TAURI__' in window;
        console.log('[UI] Environment:', isTauri ? 'Tauri' : 'Browser');

        if (isTauri) {
          // Use Tauri file dialog to select files
          const { open } = await import('@tauri-apps/plugin-dialog');
          const selected = await open({
            multiple: true,
            filters: [{
              name: 'All Files',
              extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'avi', 'mov', 'mp3', 'wav', 'flac', 'ogg', 'pdf', 'txt', 'md', 'doc', 'docx']
            }]
          });

          if (selected) {
            const files = Array.isArray(selected) ? selected : [selected];

            for (const filePath of files) {
              // Read file and create attachment
              const { readFile } = await import('@tauri-apps/plugin-fs');
              const fileData = await readFile(filePath as string);
              const base64 = btoa(String.fromCharCode(...new Uint8Array(fileData)));

              // Get file info
              const fileName = (filePath as string).split(/[\\/]/).pop() || 'file';
              const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

              // Determine file type
              let fileType = 'document';
              if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) fileType = 'image';
              else if (['mp4', 'webm', 'avi', 'mov'].includes(fileExt)) fileType = 'video';
              else if (['mp3', 'wav', 'flac', 'ogg'].includes(fileExt)) fileType = 'audio';
              else if (fileExt === 'pdf') fileType = 'pdf';

              const attachment = {
                id: generateUUID(),
                filename: fileName,
                file_type: fileType,
                file_size: fileData.length,
                file_path_or_base64: `data:application/octet-stream;base64,${base64}`
              };

              // Generate thumbnail for PDF files
              if (fileType === 'pdf') {
                console.log('[UI] Generating PDF thumbnail...');
                try {
                  const { AttachmentPreview } = await import('../modules/assistant/attachment-preview');
                  const previewGenerator = AttachmentPreview.getInstance();
                  const thumbnail = await previewGenerator.generateThumbnail(attachment as any, {
                    maxWidth: 300,
                    maxHeight: 400,
                    quality: 0.85
                  });
                  if (thumbnail) {
                    (attachment as any).thumbnail = thumbnail;
                    console.log('[UI] PDF thumbnail generated successfully');
                  }
                } catch (error) {
                  console.error('[UI] Failed to generate PDF thumbnail:', error);
                }
              }

              selectedAttachments.push(attachment);

              // Show preview
              if (attachmentsPreview) {
                const preview = createAttachmentPreview(attachment, (id: string) => {
                  selectedAttachments = selectedAttachments.filter(a => a.id !== id);
                });
                attachmentsPreview.appendChild(preview);
              }
            }
          }
        } else {
          // Browser fallback: use HTML file input
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*,video/*,audio/*,.pdf,.txt,.md,.doc,.docx';

          input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files) return;

            for (let i = 0; i < files.length; i++) {
              const file = files[i];

              // Read file as base64
              const reader = new FileReader();
              reader.onload = async () => {
                const base64 = reader.result as string;

                // Get file info
                const fileName = file.name;
                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

                // Determine file type
                let fileType = 'document';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) fileType = 'image';
                else if (['mp4', 'webm', 'avi', 'mov'].includes(fileExt)) fileType = 'video';
                else if (['mp3', 'wav', 'flac', 'ogg'].includes(fileExt)) fileType = 'audio';
                else if (fileExt === 'pdf') fileType = 'pdf';

                const attachment = {
                  id: generateUUID(),
                  filename: fileName,
                  file_type: fileType,
                  file_size: file.size,
                  file_path_or_base64: base64
                };

                console.log('[UI] File loaded:', fileName, 'Type:', fileType, 'Size:', file.size);

                // Generate thumbnail for PDF files
                if (fileType === 'pdf') {
                  console.log('[UI] Generating PDF thumbnail...');
                  try {
                    const { AttachmentPreview } = await import('../modules/assistant/attachment-preview');
                    const previewGenerator = AttachmentPreview.getInstance();
                    const thumbnail = await previewGenerator.generateThumbnail(attachment as any, {
                      maxWidth: 300,
                      maxHeight: 400,
                      quality: 0.85
                    });
                    if (thumbnail) {
                      (attachment as any).thumbnail = thumbnail;
                      console.log('[UI] PDF thumbnail generated successfully');
                    }
                  } catch (error) {
                    console.error('[UI] Failed to generate PDF thumbnail:', error);
                  }
                }

                selectedAttachments.push(attachment);
                console.log('[UI] Total attachments:', selectedAttachments.length);

                // Show preview
                if (attachmentsPreview) {
                  const preview = createAttachmentPreview(attachment, (id: string) => {
                    selectedAttachments = selectedAttachments.filter(a => a.id !== id);
                  });
                  attachmentsPreview.appendChild(preview);
                }
              };

              reader.readAsDataURL(file);
            }
          };

          input.click();
        }
      } catch (error) {
        console.error('[UI] Failed to attach file:', error);
      }
    });
  }
}

/**
 * Handle agent selection
 */
async function selectAgent(agent: Agent, agentManager: AgentManager, chatManager: ChatManager): Promise<void> {
  console.log('[UI] Selected agent:', agent.name);

  // Check if welcome screen is showing
  const mainContent = document.querySelector('.main-content') as HTMLElement;
  const welcomeScreen = mainContent?.querySelector('#welcome-screen');

  if (welcomeScreen) {
    // Welcome screen is showing - need to render chat UI first
    console.log('[UI] Replacing welcome screen with chat UI');
    renderChatUI(mainContent, chatManager);
  }

  // 🔑 CRITICAL: Clear active group to prevent context leakage
  const groupManager = GroupManager.getInstance();
  await groupManager.clearActiveGroup();
  console.log('[UI] Cleared active group for single-agent mode');

  // Update active agent
  await agentManager.setActiveAgent(agent.id);

  // Update UI
  const chatTitle = document.querySelector('#chat-title');
  if (chatTitle) {
    chatTitle.textContent = agent.name;
  }

  // Enable input
  const messageInput = document.querySelector('#message-input') as HTMLTextAreaElement;
  const sendButton = document.querySelector('#send-button') as HTMLButtonElement;
  const attachButton = document.querySelector('#attach-button') as HTMLButtonElement;
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
  if (attachButton) attachButton.disabled = false;

  // Clear messages area and show empty state
  const messagesContainer = document.querySelector('#chat-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = '<div class="empty-conversation">Start a new conversation with ' + agent.name + '</div>';
  }

  // Highlight selected agent in sidebar (use new sidebar-item class)
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  const selectedItem = document.querySelector(`.sidebar-item[data-agent-id="${agent.id}"]`);
  if (selectedItem) selectedItem.classList.add('active');

  // Dispatch event for AgentSettingsPanel to update
  const event = new CustomEvent('agent-selected', {
    detail: { agent }
  });
  window.dispatchEvent(event);
}

/**
 * Handle group selection
 */
async function selectGroup(group: Group, groupManager: GroupManager): Promise<void> {
  console.log('[UI] Selected group:', group.name);

  // Check if welcome screen is showing
  const mainContent = document.querySelector('.main-content') as HTMLElement;
  const welcomeScreen = mainContent?.querySelector('#welcome-screen');

  if (welcomeScreen) {
    // Welcome screen is showing - need to render chat UI first
    console.log('[UI] Replacing welcome screen with chat UI for group');
    renderChatUI(mainContent, ChatManager.getInstance());
  }

  // 🔑 CRITICAL: Clear active agent to prevent single-agent mode interference
  const agentManager = AgentManager.getInstance();
  await agentManager.clearActiveAgent();
  console.log('[UI] Cleared active agent for group mode');

  // Update active group
  await groupManager.setActiveGroup(group.id);

  // Update UI
  const chatTitle = document.querySelector('#chat-title');
  if (chatTitle) {
    chatTitle.textContent = `${group.name} (Group)`;
  }

  // Enable input
  const messageInput = document.querySelector('#message-input') as HTMLTextAreaElement;
  const sendButton = document.querySelector('#send-button') as HTMLButtonElement;
  const attachButton = document.querySelector('#attach-button') as HTMLButtonElement;
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
  if (attachButton) attachButton.disabled = false;

  // Clear messages area
  const messagesContainer = document.querySelector('#chat-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = '<div class="empty-conversation">Start a group conversation</div>';
  }

  // Highlight selected group in sidebar (use sidebar-item class)
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  const selectedItem = document.querySelector(`.sidebar-item[data-group-id="${group.id}"]`);
  if (selectedItem) selectedItem.classList.add('active');
}

/**
 * Send message to backend
 * FIXED: Using correct SendMessageOptions structure with Agent, Topic, and Message objects
 * SUPPORTS: Both Agent and Group chats
 */
async function sendMessage(input: HTMLTextAreaElement, chatManager: ChatManager, attachments: any[] = []): Promise<void> {
  const content = input.value.trim();
  if (!content && attachments.length === 0) return;

  console.log('[UI] Sending message:', content, 'with', attachments.length, 'attachments');

  // Clear input
  input.value = '';

  // Check if we have an active agent or group
  const agentManager = AgentManager.getInstance();
  const groupManager = GroupManager.getInstance();

  const activeAgent = await agentManager.getActiveAgent();
  const activeGroup = await groupManager.getActiveGroup();

  if (!activeAgent && !activeGroup) {
    console.error('[UI] No active agent or group selected');
    return;
  }

  // Determine if this is a group chat
  const isGroupChat = !!activeGroup;
  console.log('[UI] Chat mode:', isGroupChat ? 'Group' : 'Agent');

  // Get or create active topic
  const topicManager = TopicListManager.getInstance();
  let activeTopic = await topicManager.getActiveTopic();

  if (!activeTopic) {
    // Create new topic for agent or group
    const ownerId = isGroupChat ? activeGroup.id : activeAgent!.id;
    const ownerType = isGroupChat ? 'group' : 'agent';
    const ownerName = isGroupChat ? activeGroup.name : activeAgent!.name;

    console.log('[UI] Creating new topic for', ownerType, ':', ownerName);
    activeTopic = await topicManager.createTopic({
      owner_id: ownerId,
      owner_type: ownerType,
      title: `Conversation with ${ownerName}`,
      messages: []
    });
    // Set as active
    topicManager.setActiveTopic(activeTopic.id);
  }

  // Create user message object
  console.log('[UI] Creating user message with attachments:', attachments.length);
  const userMessage: Message = {
    id: generateUUID(),
    sender: 'user',
    sender_id: 'user',
    sender_name: 'User',
    content: content,
    attachments: attachments,
    timestamp: new Date().toISOString(),
    state: 'pending',
    is_streaming: false
  };
  console.log('[UI] User message created:', userMessage);

  // Get messages container
  const messagesContainer = document.querySelector('#chat-messages');
  if (!messagesContainer) return;

  // Clear empty state if present
  const emptyState = messagesContainer.querySelector('.empty-conversation');
  if (emptyState) {
    messagesContainer.innerHTML = '';
  }

  // Add user message to UI
  console.log('[UI] Rendering user message with attachments:', attachments);
  const userMessageEl = await createMessageElement('user', content, false, attachments);
  messagesContainer.appendChild(userMessageEl);

  // For Group chat in sequential mode, all agents respond in order
  if (isGroupChat && activeGroup.collaboration_mode === 'sequential') {
    console.log('[UI] Group sequential mode: processing', activeGroup.agent_ids.length, 'agents');

    // Prepare group context for AI awareness
    const allAgents = await Promise.all(
      activeGroup.agent_ids.map(id => agentManager.getAgent(id))
    );
    const agentNames = allAgents.filter(a => a !== null).map(a => a!.name);
    const groupContext = {
      groupName: activeGroup.name,
      agentNames: agentNames
    };
    console.log('[UI] Group context prepared:', groupContext);

    // Process each agent in the group sequentially
    for (let i = 0; i < activeGroup.agent_ids.length; i++) {
      const agentId = activeGroup.agent_ids[i];
      const agent = await agentManager.getAgent(agentId);

      if (!agent) {
        console.error(`[UI] Agent ${agentId} not found, skipping`);
        continue;
      }

      console.log(`[UI] Agent ${i + 1}/${activeGroup.agent_ids.length}: ${agent.name} responding...`);

      // Add assistant message placeholder for this agent
      const agentMessageEl = await createMessageElement('assistant', '', true, [], agent.id);
      messagesContainer.appendChild(agentMessageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Send message and wait for response
      await new Promise<void>((resolve, reject) => {
        chatManager.sendMessage({
          agent: agent,
          topic: activeTopic,
          userMessage: userMessage,
          groupContext: groupContext,  // ← 添加Group上下文
          streaming: activeGroup.streaming,  // 🔑 Use Group's streaming setting
          onStreamStart: () => {
            console.log(`[UI] ${agent.name} stream started`);
          },
          onStreamChunk: async (chunk: string, fullContent: string) => {
            // 🔑 Incremental update: directly update text content without full re-render
            // This provides visible word-by-word streaming effect for Group mode
            const contentZone = agentMessageEl.querySelector('.message__content');
            if (contentZone) {
              // Simple plain text update for streaming (fast, visible incremental display)
              contentZone.textContent = fullContent;
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          },
          onStreamEnd: async (finalMessage: Message) => {
            try {
              console.log(`[UI] ${agent.name} stream ended, length:`, finalMessage.content.length);
              const messageRenderer = getMessageRenderer();
              const renderResult = await messageRenderer.renderMessage(finalMessage, {
                streaming: false,
                enableThemeColor: true,
                skipFinalize: true
              });
              const newMessageEl = renderResult.refs.container;
              newMessageEl.classList.remove('streaming');
              if (agentMessageEl.parentElement) {
                agentMessageEl.parentElement.replaceChild(newMessageEl, agentMessageEl);
                if (renderResult.renderer && renderResult.renderer.finalize) {
                  await renderResult.renderer.finalize(renderResult.refs.contentZone);
                }
              }
              resolve(); // Signal completion
            } catch (error) {
              console.error(`[UI] ${agent.name} onStreamEnd error:`, error);
              reject(error);
            }
          },
          onError: (error: Error) => {
            console.error(`[UI] ${agent.name} error:`, error);
            const contentElement = agentMessageEl.querySelector('.message-content');
            if (contentElement) {
              contentElement.innerHTML = `<span class="error">Error: ${error.message}</span>`;
            }
            agentMessageEl.classList.add('error');
            reject(error);
          },
        }).catch(reject);
      });

      console.log(`[UI] ✅ ${agent.name} completed`);
    }

    console.log('[UI] ✅ All agents responded in sequential mode');
    return; // Exit early, don't run the single-agent code below
  }

  // For Agent chat or Group free mode, use single agent
  let selectedAgent = activeAgent;
  if (isGroupChat) {
    // For group free mode, use the first agent (for now)
    const firstAgentId = activeGroup.agent_ids[0];
    selectedAgent = await agentManager.getAgent(firstAgentId);
    console.log('[UI] Group free mode: using first agent', selectedAgent.name);
  }

  if (!selectedAgent) {
    console.error('[UI] No agent available to handle the message');
    return;
  }

  // Add assistant message placeholder (pass selectedAgent.id)
  const assistantMessageEl = await createMessageElement('assistant', '', true, [], selectedAgent.id);
  messagesContainer.appendChild(assistantMessageEl);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Send to backend with CORRECT SendMessageOptions structure
  try {
    await chatManager.sendMessage({
      agent: selectedAgent,
      topic: activeTopic,
      userMessage: userMessage,
      // 🔑 IMPORTANT: Do NOT pass groupContext for single-agent chats
      // groupContext: undefined,  // Explicitly omit to avoid Group context leakage
      onStreamStart: () => {
        console.log('[UI] Stream started');
      },
      onStreamChunk: async (chunk: string, fullContent: string) => {
        // 🔑 Incremental update: directly update text content without full re-render
        // This provides visible word-by-word streaming effect
        const contentZone = assistantMessageEl.querySelector('.message__content');
        if (contentZone) {
          // Simple plain text update for streaming (fast, visible incremental display)
          contentZone.textContent = fullContent;
        }

        // Auto-scroll
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      },
      onStreamEnd: async (finalMessage: Message) => {
        try {
          console.log('[UI] Stream ended, final message length:', finalMessage.content.length);

          // Final render with complete content
          const messageRenderer = getMessageRenderer();
          console.log('[UI] Calling renderMessage() with streaming=false');

          const renderResult = await messageRenderer.renderMessage(finalMessage, {
            streaming: false,
            enableThemeColor: true,
            skipFinalize: true  // 🔑 修复：跳过finalize，因为元素还没有插入到DOM中
          });

          console.log('[UI] renderMessage() completed, replacing DOM element');

          // Replace entire message element with final rendered version
          const newMessageEl = renderResult.refs.container;
          newMessageEl.classList.remove('streaming');

          if (assistantMessageEl.parentElement) {
            assistantMessageEl.parentElement.replaceChild(newMessageEl, assistantMessageEl);
            console.log('[UI] DOM element replaced successfully');

            // 🔑 修复：在元素插入到DOM之后，手动调用finalize来初始化Mermaid图表
            // 这样可以确保Mermaid能够正确计算元素尺寸
            if (renderResult.renderer && renderResult.renderer.finalize) {
              console.log('[UI] Calling finalize() after DOM insertion');
              await renderResult.renderer.finalize(renderResult.refs.contentZone);
              console.log('[UI] finalize() completed');
            }
          }
        } catch (error) {
          console.error('[UI] onStreamEnd error:', error);
        }
      },
      onError: (error: Error) => {
        console.error('[UI] Message error:', error);
        const contentElement = assistantMessageEl.querySelector('.message-content');
        if (contentElement) {
          contentElement.innerHTML = `<span class="error">Error: ${error.message}</span>`;
        }
        assistantMessageEl.classList.add('error');
      },
    });
  } catch (error) {
    console.error('[UI] Failed to send message:', error);
    console.error('[UI] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack',
      type: typeof error,
      error: error
    });
  }
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create message element using MessageRenderer
 */
async function createMessageElement(
  role: 'user' | 'assistant',
  content: string,
  streaming: boolean,
  attachments: any[] = [],
  agentId?: string  // NEW: Optional agent ID for assistant messages
): Promise<HTMLElement> {
  const messageRenderer = getMessageRenderer();

  // Determine sender_id based on role
  let senderId: string;
  let senderName: string;

  if (role === 'user') {
    senderId = 'user';
    senderName = 'User';
  } else {
    // For assistant messages, use provided agentId or fallback to 'assistant'
    senderId = agentId || 'assistant';
    senderName = 'Assistant';
  }

  // Create Message object for rendering
  const message: Message = {
    id: generateUUID(),
    sender: role,
    sender_id: senderId,
    sender_name: senderName,
    content: content || '...',
    attachments: attachments,
    timestamp: new Date().toISOString(),
    state: streaming ? 'pending' : 'ready',
    is_streaming: streaming
  };

  console.log('[UI] Creating message element with attachments:', attachments.length);

  // Get avatar path based on sender type
  let avatarPath: string | undefined;

  if (message.sender === 'user') {
    // Get user avatar from Settings
    const settingsManager = SettingsManager.getInstance();
    const settings = settingsManager.getSettings();
    avatarPath = settings.user_avatar;
  } else if (message.sender === 'assistant' || message.sender === 'agent') {
    // Get agent avatar from AgentManager
    const agentManager = AgentManager.getInstance();
    try {
      const agent = await agentManager.getAgent(message.sender_id);
      avatarPath = agent?.avatar;
      // Update sender name with actual agent name
      if (agent) {
        message.sender_name = agent.name;
      }
    } catch (error) {
      console.warn(`[UI] Failed to get agent avatar for ${message.sender_id}:`, error);
      avatarPath = undefined;  // Will use fallback
    }
  }

  // Render message using MessageRenderer with avatar path
  const renderResult = await messageRenderer.renderMessage(message, {
    streaming: streaming,
    enableThemeColor: true,
    domOptions: {
      avatarPath: avatarPath
    }
  });

  return renderResult.refs.container;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Create attachment preview element
 */
function createAttachmentPreview(attachment: any, onRemove: (id: string) => void): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'attachment-preview-item';
  preview.dataset.attachmentId = attachment.id;

  // Create preview based on file type
  if (attachment.file_type === 'image') {
    // Image: show thumbnail
    preview.innerHTML = `
      <div class="attachment-preview-thumbnail">
        <img src="${attachment.file_path_or_base64}" alt="${attachment.filename}" />
      </div>
      <div class="attachment-preview-info">
        <div class="attachment-preview-name">${attachment.filename}</div>
        <div class="attachment-preview-size">${formatFileSize(attachment.file_size)}</div>
      </div>
      <button class="attachment-preview-remove" data-id="${attachment.id}" title="Remove">×</button>
    `;
  } else if (attachment.file_type === 'video') {
    // Video: show video icon
    preview.innerHTML = `
      <div class="attachment-preview-icon attachment-preview-icon--video">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      <div class="attachment-preview-info">
        <div class="attachment-preview-name">${attachment.filename}</div>
        <div class="attachment-preview-size">${formatFileSize(attachment.file_size)}</div>
      </div>
      <button class="attachment-preview-remove" data-id="${attachment.id}" title="Remove">×</button>
    `;
  } else if (attachment.file_type === 'audio') {
    // Audio: show audio icon
    preview.innerHTML = `
      <div class="attachment-preview-icon attachment-preview-icon--audio">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      </div>
      <div class="attachment-preview-info">
        <div class="attachment-preview-name">${attachment.filename}</div>
        <div class="attachment-preview-size">${formatFileSize(attachment.file_size)}</div>
      </div>
      <button class="attachment-preview-remove" data-id="${attachment.id}" title="Remove">×</button>
    `;
  } else if (attachment.file_type === 'pdf') {
    // PDF: show PDF icon
    preview.innerHTML = `
      <div class="attachment-preview-icon attachment-preview-icon--pdf">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <text x="12" y="16" font-size="6" text-anchor="middle" fill="currentColor">PDF</text>
        </svg>
      </div>
      <div class="attachment-preview-info">
        <div class="attachment-preview-name">${attachment.filename}</div>
        <div class="attachment-preview-size">${formatFileSize(attachment.file_size)}</div>
      </div>
      <button class="attachment-preview-remove" data-id="${attachment.id}" title="Remove">×</button>
    `;
  } else {
    // Document: show document icon
    preview.innerHTML = `
      <div class="attachment-preview-icon attachment-preview-icon--document">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      </div>
      <div class="attachment-preview-info">
        <div class="attachment-preview-name">${attachment.filename}</div>
        <div class="attachment-preview-size">${formatFileSize(attachment.file_size)}</div>
      </div>
      <button class="attachment-preview-remove" data-id="${attachment.id}" title="Remove">×</button>
    `;
  }

  // Bind remove button event
  const removeBtn = preview.querySelector('.attachment-preview-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      onRemove(attachment.id);
      preview.remove();
      console.log('[UI] Attachment removed:', attachment.filename);
    });
  }

  return preview;
}

/**
 * Render empty state when no agents
 */
function renderEmptyState(container: HTMLElement): void {
  container.innerHTML = `
    <div class="empty-state">
      <h2>No Agents Available</h2>
      <p>Create your first agent to start using VCPChat</p>
      <button class="btn-primary" onclick="alert('Agent creation UI coming soon!')">Create Agent</button>
    </div>
  `;
}

/**
 * Setup navigation handlers for welcome screen feature cards
 */
function setupWelcomeScreenNavigation(agentManager: AgentManager, chatManager: ChatManager): void {
  const featureItems = document.querySelectorAll('.feature-item');

  featureItems.forEach((item, index) => {
    item.addEventListener('click', async () => {
      const mainContent = document.querySelector('.main-content') as HTMLElement;
      if (!mainContent) return;

      // Determine which feature was clicked based on index
      switch (index) {
        case 0: // 智能对话 - Jump to most recent conversation
          await navigateToRecentConversation(agentManager, chatManager, mainContent);
          break;

        case 1: // 协同画布 - Jump to canvas (NOW LINKED!)
          await showCanvasLauncher();
          break;

        case 2: // 智能笔记 - Jump to notes
          navigateToNotes(mainContent);
          break;

        case 3: // 插件生态 - Jump to plugin store
          navigateToPluginStore(mainContent);
          break;
      }
    });

    // Add cursor pointer to indicate clickability
    (item as HTMLElement).style.cursor = 'pointer';
  });

  console.log('[UI] Welcome screen navigation handlers attached');
}

/**
 * Navigate to most recent conversation
 */
async function navigateToRecentConversation(
  agentManager: AgentManager,
  chatManager: ChatManager,
  mainContent: HTMLElement
): Promise<void> {
  console.log('[UI] Navigating to recent conversation');

  // Get all agents
  const agents = await agentManager.listAgents();

  if (agents.length === 0) {
    alert('No agents available. Please create an agent first.');
    return;
  }

  // For now, select the first agent (TODO: Track most recent conversation)
  const firstAgent = agents[0];

  // Render chat UI and select the agent
  renderChatUI(mainContent, chatManager);
  await selectAgent(firstAgent, agentManager, chatManager);

  console.log('[UI] Navigated to conversation with', firstAgent.name);
}

/**
 * Navigate to notes page
 */
function navigateToNotes(mainContent: HTMLElement): void {
  console.log('[UI] Navigating to notes');

  mainContent.innerHTML = `
    <div class="notes-container" style="padding: var(--spacing-xl); text-align: center;">
      <h2>Smart Notes</h2>
      <p style="color: var(--text-secondary); margin-top: var(--spacing-md);">
        Notes feature coming soon...
      </p>
      <button class="btn-secondary" onclick="location.reload()" style="margin-top: var(--spacing-lg);">
        Back to Welcome
      </button>
    </div>
  `;
}

/**
 * Navigate to plugin store
 */
function navigateToPluginStore(mainContent: HTMLElement): void {
  console.log('[UI] Navigating to plugin store');

  // Check if plugin store module is available
  if (typeof (window as any).initPluginStore === 'function') {
    mainContent.innerHTML = '<div id="plugin-store-container"></div>';
    (window as any).initPluginStore('plugin-store-container');
  } else {
    // Fallback if plugin store not yet implemented
    mainContent.innerHTML = `
      <div class="plugin-store-placeholder" style="padding: var(--spacing-xl); text-align: center;">
        <h2>Plugin Store</h2>
        <p style="color: var(--text-secondary); margin-top: var(--spacing-md);">
          Plugin store is loading...
        </p>
        <button class="btn-secondary" onclick="location.reload()" style="margin-top: var(--spacing-lg);">
          Back to Welcome
        </button>
      </div>
    `;
  }
}

/**
 * Setup global event delegation for create buttons
 * This ensures buttons work even if they are re-rendered
 */
function setupGlobalCreateButtonHandlers(agentManager: AgentManager, groupManager: GroupManager): void {
  console.log('[UI] Setting up global create button handlers...');

  // Use event delegation on document level
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    // Find the closest button element
    const button = target.closest('button');

    if (!button) return;

    // Handle New Agent button
    if (button.id === 'create-agent-btn') {
      event.preventDefault();
      event.stopPropagation();
      console.log('[UI] New Agent button clicked (global handler)');
      showCreateAgentDialog(agentManager);
      return;
    }

    // Handle New Group button
    if (button.id === 'create-group-btn') {
      event.preventDefault();
      event.stopPropagation();
      console.log('[UI] New Group button clicked (global handler)');
      showCreateGroupDialog(groupManager);
      return;
    }
  }, true); // Use capture phase

  console.log('[UI] ✅ Global create button handlers registered');
}

/**
 * Bind create agent/group buttons
 * Note: This is now a no-op since we use global event delegation
 */
function bindCreateButtons(agentManager: AgentManager, groupManager: GroupManager): void {
  console.log('[UI] bindCreateButtons called (using global delegation, no action needed)');
}

/**
 * Show context menu for agent settings
 */
function showAgentContextMenu(event: MouseEvent, agent: Agent, agentManager: AgentManager): void {
  // Remove existing context menu
  const existingMenu = document.querySelector('.context-menu');
  existingMenu?.remove();

  // Create context menu
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.innerHTML = `
    <div class="context-menu-item" data-action="settings">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 6a4 4 0 100 8 4 4 0 000-8z"/>
      </svg>
      Agent Settings
    </div>
    <div class="context-menu-item" data-action="rename">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
      </svg>
      Rename
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" data-action="delete">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 2l-1 2H2v2h1l1 12h12l1-12h1V4h-3l-1-2H6z"/>
      </svg>
      Delete Agent
    </div>
  `;

  document.body.appendChild(menu);

  // Bind menu item clicks
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = (item as HTMLElement).dataset.action;
      menu.remove();

      switch (action) {
        case 'settings':
          showAgentSettingsDialog(agent, agentManager);
          break;
        case 'rename':
          renameAgent(agent, agentManager);
          break;
        case 'delete':
          deleteAgent(agent, agentManager);
          break;
      }
    });
  });

  // Close menu on outside click
  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

/**
 * Show context menu for group settings
 */
function showGroupContextMenu(event: MouseEvent, group: Group, groupManager: GroupManager): void {
  // Remove existing context menu
  const existingMenu = document.querySelector('.context-menu');
  existingMenu?.remove();

  // Create context menu
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.innerHTML = `
    <div class="context-menu-item" data-action="settings">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 6a4 4 0 100 8 4 4 0 000-8z"/>
      </svg>
      Group Settings
    </div>
    <div class="context-menu-item" data-action="rename">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
      </svg>
      Rename
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" data-action="delete">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 2l-1 2H2v2h1l1 12h12l1-12h1V4h-3l-1-2H6z"/>
      </svg>
      Delete Group
    </div>
  `;

  document.body.appendChild(menu);

  // Bind menu item clicks
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = (item as HTMLElement).dataset.action;
      menu.remove();

      switch (action) {
        case 'settings':
          showGroupSettingsDialog(group, groupManager);
          break;
        case 'rename':
          renameGroup(group, groupManager);
          break;
        case 'delete':
          deleteGroup(group, groupManager);
          break;
      }
    });
  });

  // Close menu on outside click
  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

/**
 * Show create agent dialog
 */
async function showCreateAgentDialog(agentManager: AgentManager): Promise<void> {
  try {
    console.log('[UI] showCreateAgentDialog called');

    // Dynamic import to avoid circular dependencies
    console.log('[UI] Importing AgentEditor...');
    const { AgentEditor } = await import('../components/AgentEditor');
    console.log('[UI] AgentEditor imported successfully');

    console.log('[UI] Creating AgentEditor instance...');
    const editor = new AgentEditor(document.body, {
      mode: 'create',
      onSave: async (data) => {
        try {
          await agentManager.createAgent(data);
          console.log('[UI] Agent created successfully:', data.name);

          // Refresh the sidebar to show the new agent
          await refreshAgentList(agentManager);

          // Show success notification
          showNotification('Agent created successfully!', 'success');
        } catch (error) {
          console.error('[UI] Failed to create agent:', error);
          showNotification(`Failed to create agent: ${(error as Error).message}`, 'error');
        }
      },
      onCancel: () => {
        console.log('[UI] Agent creation cancelled');
      }
    });
    console.log('[UI] AgentEditor instance created');

    console.log('[UI] Showing AgentEditor...');
    editor.show();
    console.log('[UI] AgentEditor.show() called');
  } catch (error) {
    console.error('[UI] ❌ Failed to show create agent dialog:', error);
    showNotification(`Failed to open agent dialog: ${(error as Error).message}`, 'error');
  }
}

/**
 * Show create group dialog
 */
async function showCreateGroupDialog(groupManager: GroupManager): Promise<void> {
  try {
    console.log('[UI] showCreateGroupDialog called');

    // Get bootstrap context to access agentManager
    console.log('[UI] Getting bootstrap context...');
    const context = await import('../core/bootstrap').then(m => m.getBootstrapContext());
    const agentManager = context!.agentManager;
    console.log('[UI] Bootstrap context obtained');

    console.log('[UI] Listing agents...');
    const agents = await agentManager.listAgents();
    console.log('[UI] Found agents:', agents.length);

    if (agents.length < 2) {
      console.log('[UI] Not enough agents for group creation');
      showNotification('Please create at least 2 agents before creating a group', 'warning');
      return;
    }

    // Dynamic import
    console.log('[UI] Importing GroupEditor...');
    const { GroupEditor } = await import('../components/GroupEditor');
    console.log('[UI] GroupEditor imported successfully');

    console.log('[UI] Creating GroupEditor instance...');
    const editor = new GroupEditor(document.body, {
      mode: 'create',
      availableAgents: agents,
      onSave: async (data) => {
        try {
          await groupManager.createGroup(data);
          console.log('[UI] Group created successfully:', data.name);

          // Refresh the sidebar to show the new group
          await refreshAgentList(agentManager);

          // Show success notification
          showNotification('Group created successfully!', 'success');
        } catch (error) {
          console.error('[UI] Failed to create group:', error);
          showNotification(`Failed to create group: ${(error as Error).message}`, 'error');
        }
      },
      onCancel: () => {
        console.log('[UI] Group creation cancelled');
      }
    });
    console.log('[UI] GroupEditor instance created');

    console.log('[UI] Showing GroupEditor...');
    editor.show();
    console.log('[UI] GroupEditor.show() called');
  } catch (error) {
    console.error('[UI] ❌ Failed to show create group dialog:', error);
    showNotification(`Failed to open group dialog: ${(error as Error).message}`, 'error');
  }
}

/**
 * Show agent settings dialog (Edit mode)
 */
async function showAgentSettingsDialog(agent: Agent, agentManager: AgentManager): Promise<void> {
  console.log('[UI] Opening agent settings for:', agent.name);

  try {
    // Dynamic import to avoid circular dependencies
    const { AgentEditor } = await import('../components/AgentEditor');

    const editor = new AgentEditor(document.body, {
      mode: 'edit',
      agent: agent,
      onSave: async (data) => {
        try {
          // Update the agent
          await agentManager.updateAgent(agent.id, data);
          console.log('[UI] Agent updated successfully:', data.name);

          // Refresh the sidebar
          await refreshAgentList(agentManager);

          // Show success notification
          showNotification('Agent updated successfully!', 'success');
        } catch (error) {
          console.error('[UI] Failed to update agent:', error);
          showNotification(`Failed to update agent: ${(error as Error).message}`, 'error');
        }
      },
      onCancel: () => {
        console.log('[UI] Agent settings cancelled');
      }
    });

    editor.show();
  } catch (error) {
    console.error('[UI] Failed to open agent settings:', error);
    showNotification('Failed to open agent settings', 'error');
  }
}

/**
 * Show group settings dialog (Edit mode)
 */
async function showGroupSettingsDialog(group: Group, groupManager: GroupManager): Promise<void> {
  console.log('[UI] Opening group settings for:', group.name);

  try {
    // Get bootstrap context to access agentManager
    const context = await import('../core/bootstrap').then(m => m.getBootstrapContext());
    const agentManager = context!.agentManager;
    const agents = await agentManager.listAgents();

    // Dynamic import
    const { GroupEditor } = await import('../components/GroupEditor');

    const editor = new GroupEditor(document.body, {
      mode: 'edit',
      group: group,
      availableAgents: agents,
      onSave: async (data) => {
        try {
          // Update the group (pass group.id and data separately)
          await groupManager.updateGroup(group.id, data);
          console.log('[UI] Group updated successfully:', data.name);

          // Refresh the sidebar
          await refreshAgentList(agentManager);

          // Show success notification
          showNotification('Group updated successfully!', 'success');
        } catch (error) {
          console.error('[UI] Failed to update group:', error);
          showNotification(`Failed to update group: ${(error as Error).message}`, 'error');
        }
      },
      onCancel: () => {
        console.log('[UI] Group settings cancelled');
      }
    });

    editor.show();
  } catch (error) {
    console.error('[UI] Failed to open group settings:', error);
    showNotification('Failed to open group settings', 'error');
  }
}

/**
 * Rename agent (Simple inline rename)
 */
async function renameAgent(agent: Agent, agentManager: AgentManager): Promise<void> {
  const newName = prompt(`Rename agent "${agent.name}" to:`, agent.name);
  if (newName && newName !== agent.name && newName.trim() !== '') {
    try {
      agent.name = newName.trim();
      await agentManager.updateAgent(agent);

      // Refresh the agent list
      await refreshAgentList(agentManager);

      showNotification(`Agent renamed to "${newName}"`, 'success');
    } catch (error) {
      console.error('[UI] Failed to rename agent:', error);
      showNotification('Failed to rename agent', 'error');
    }
  }
}

/**
 * Rename group (Simple inline rename)
 */
async function renameGroup(group: Group, groupManager: GroupManager): Promise<void> {
  const newName = prompt(`Rename group "${group.name}" to:`, group.name);
  if (newName && newName !== group.name && newName.trim() !== '') {
    try {
      // Get bootstrap context to access agentManager
      const context = await import('../core/bootstrap').then(m => m.getBootstrapContext());
      const agentManager = context!.agentManager;

      group.name = newName.trim();
      await groupManager.updateGroup(group);

      // Refresh the group list
      await refreshAgentList(agentManager);

      showNotification(`Group renamed to "${newName}"`, 'success');
    } catch (error) {
      console.error('[UI] Failed to rename group:', error);
      showNotification('Failed to rename group', 'error');
    }
  }
}

/**
 * Delete agent with confirmation
 */
async function deleteAgent(agent: Agent, agentManager: AgentManager): Promise<void> {
  const confirmed = await showCustomConfirm({
    title: 'Delete Agent',
    message: `Are you sure you want to delete agent "${agent.name}"?\n\nThis action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });

  if (confirmed) {
    try {
      await agentManager.deleteAgent(agent.id);

      // Refresh the agent list
      await refreshAgentList(agentManager);

      showNotification(`Agent "${agent.name}" deleted`, 'success');
      console.log('[UI] Agent deleted:', agent.id);
    } catch (error) {
      console.error('[UI] Failed to delete agent:', error);
      showNotification('Failed to delete agent', 'error');
    }
  }
}

/**
 * Delete group with confirmation
 */
async function deleteGroup(group: Group, groupManager: GroupManager): Promise<void> {
  const confirmed = await showCustomConfirm({
    title: 'Delete Group',
    message: `Are you sure you want to delete group "${group.name}"?\n\nThis action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });

  if (confirmed) {
    try {
      // Get bootstrap context to access agentManager
      const context = await import('../core/bootstrap').then(m => m.getBootstrapContext());
      const agentManager = context!.agentManager;

      await groupManager.deleteGroup(group.id);

      // Refresh the group list
      await refreshAgentList(agentManager);

      showNotification(`Group "${group.name}" deleted`, 'success');
      console.log('[UI] Group deleted:', group.id);
    } catch (error) {
      console.error('[UI] Failed to delete group:', error);
      showNotification('Failed to delete group', 'error');
    }
  }
}

/**
 * Refresh agent list in sidebar without page reload
 */
async function refreshAgentList(agentManager: AgentManager): Promise<void> {
  console.log('[UI] Refreshing agent/group list...');

  try {
    const leftSidebar = document.querySelector('#sidebar-left');
    if (!leftSidebar) {
      console.error('[UI] Left sidebar not found');
      return;
    }

    // Get the current active agent/group before refresh
    const activeAgentId = document.querySelector('.sidebar-item.active[data-agent-id]')?.getAttribute('data-agent-id');
    const activeGroupId = document.querySelector('.sidebar-item.active[data-group-id]')?.getAttribute('data-group-id');

    // Save scroll position
    const sidebarContent = leftSidebar.querySelector('#sidebar-left-content');
    const scrollTop = sidebarContent?.scrollTop || 0;

    // Get managers
    const context = await import('../core/bootstrap').then(m => m.getBootstrapContext());
    const groupManager = context!.groupManager;

    // Re-render the sidebar
    await renderAgentList(leftSidebar as HTMLElement, agentManager, groupManager);

    // Restore scroll position
    if (sidebarContent) {
      sidebarContent.scrollTop = scrollTop;
    }

    // Restore active selection if still exists
    if (activeAgentId) {
      const agentItem = document.querySelector(`.sidebar-item[data-agent-id="${activeAgentId}"]`);
      if (agentItem) {
        agentItem.classList.add('active');
      }
    } else if (activeGroupId) {
      const groupItem = document.querySelector(`.sidebar-item[data-group-id="${activeGroupId}"]`);
      if (groupItem) {
        groupItem.classList.add('active');
      }
    }

    console.log('[UI] ✅ Agent/group list refreshed successfully');
  } catch (error) {
    console.error('[UI] ❌ Failed to refresh agent list:', error);
    throw error;
  }
}

/**
 * Show notification toast message
 */
function showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
  // Remove existing notification
  const existingNotification = document.querySelector('.notification-toast');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification-toast notification-${type}`;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'polite');

  // Icon based on type
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"/></svg>';
      break;
    case 'error':
      icon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z"/></svg>';
      break;
    case 'warning':
      icon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M1 17h18L10 1 1 17zm10-2H9v-2h2v2zm0-4H9V7h2v4z"/></svg>';
      break;
    case 'info':
      icon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9V9h2v6zm0-8H9V5h2v2z"/></svg>';
      break;
  }

  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-message">${message}</div>
    <button class="notification-close" aria-label="Close notification">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
      </svg>
    </button>
  `;

  // Add to body
  document.body.appendChild(notification);

  // Bind close button
  const closeBtn = notification.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });
  }

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('notification-fade-out');
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);

  console.log(`[UI] Notification shown: [${type.toUpperCase()}] ${message}`);
}

/**
 * Bind global settings buttons in right sidebar
 */
function bindSettingsButtons(): void {
  console.log('[UI] Binding unified settings button...');

  const unifiedSettingsBtn = document.getElementById('unified-settings-btn');

  if (!unifiedSettingsBtn) {
    console.warn('[UI] Unified settings button not found');
    return;
  }

  // Unified Settings button - Opens settings modal on General tab by default
  unifiedSettingsBtn.addEventListener('click', async () => {
    console.log('[UI] 🔵 Settings button clicked');

    try {
      console.log('[UI] Importing SettingsModal...');
      const { SettingsModal } = await import('../components/SettingsModal');
      console.log('[UI] SettingsModal imported successfully');

      console.log('[UI] Creating new SettingsModal instance...');
      const modal = new SettingsModal();  // ✅ Create new instance each time (same as AgentEditor/GroupEditor)
      console.log('[UI] SettingsModal instance created');

      console.log('[UI] Opening SettingsModal...');
      await modal.open();
      console.log('[UI] ✅ SettingsModal opened successfully');
    } catch (error) {
      console.error('[UI] ❌ Failed to open settings:', error);
      console.error('[UI] Error stack:', error instanceof Error ? error.stack : error);
      showNotification('Failed to open settings', 'error');
    }
  });

  console.log('[UI] ✅ Unified settings button bound successfully');
}

/**
 * Register global keyboard shortcuts
 */
function registerKeyboardShortcuts(): void {
  console.log('[UI] Registering keyboard shortcuts...');

  // Global keyboard event listener
  document.addEventListener('keydown', async (event) => {
    // Ctrl+, or Cmd+, - Open Settings
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
      event.preventDefault();
      console.log('[UI Keyboard] 🔵 Ctrl+, pressed - Opening Settings');

      try {
        console.log('[UI Keyboard] Importing SettingsModal...');
        const { SettingsModal } = await import('../components/SettingsModal');
        console.log('[UI Keyboard] SettingsModal imported successfully');

        console.log('[UI Keyboard] Creating new SettingsModal instance...');
        const modal = new SettingsModal();  // ✅ Create new instance each time
        console.log('[UI Keyboard] SettingsModal instance created');

        console.log('[UI Keyboard] Opening SettingsModal...');
        await modal.open();
        console.log('[UI Keyboard] ✅ SettingsModal opened successfully');
      } catch (error) {
        console.error('[UI Keyboard] ❌ Failed to open settings via shortcut:', error);
        console.error('[UI Keyboard] Error stack:', error instanceof Error ? error.stack : error);
        showNotification('Failed to open settings', 'error');
      }
    }

    // Ctrl+K - Open Canvas Launcher
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      console.log('[UI] Keyboard shortcut: Ctrl+K - Opening Canvas Launcher');
      await showCanvasLauncher();
    }

    // Ctrl+N - New Agent (optional enhancement)
    if ((event.ctrlKey || event.metaKey) && event.key === 'n' && !event.shiftKey) {
      // Only if not in an input field
      const target = event.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        console.log('[UI] Keyboard shortcut: Ctrl+N - Creating New Agent');

        const agentManager = AgentManager.getInstance();
        await showCreateAgentDialog(agentManager);
      }
    }

    // Ctrl+Shift+N - New Group (optional enhancement)
    if ((event.ctrlKey || event.metaKey) && event.key === 'N' && event.shiftKey) {
      event.preventDefault();
      console.log('[UI] Keyboard shortcut: Ctrl+Shift+N - Creating New Group');

      const groupManager = GroupManager.getInstance();
      await showCreateGroupDialog(groupManager);
    }
  });

  console.log('[UI] ✅ Keyboard shortcuts registered');
  console.log('[UI] Available shortcuts:');
  console.log('[UI]   - Ctrl+, : Open Settings');
  console.log('[UI]   - Ctrl+K : Open Canvas Launcher');
  console.log('[UI]   - Ctrl+N : New Agent');
  console.log('[UI]   - Ctrl+Shift+N : New Group');
}

/**
 * Bind Canvas launcher button
 */
function bindCanvasLauncher(): void {
  console.log('[UI] Binding Canvas launcher button...');

  const canvasBtn = document.getElementById('canvas-launcher-btn');
  if (!canvasBtn) {
    console.warn('[UI] Canvas launcher button not found');
    return;
  }

  canvasBtn.addEventListener('click', async () => {
    console.log('[UI] Canvas button clicked');
    await showCanvasLauncher();
  });

  console.log('[UI] ✅ Canvas launcher button bound');
}

/**
 * Show Canvas launcher modal
 */
async function showCanvasLauncher(): Promise<void> {
  console.log('[UI] Opening Canvas Launcher...');

  try {
    // Remove any existing Canvas launcher modals to prevent duplicates
    const existingModals = document.querySelectorAll('.canvas-launcher-modal');
    existingModals.forEach(modal => modal.remove());

    // Try to get existing canvases (may fail in browser mode)
    let existingCanvases: any[] = [];
    try {
      const { listCanvases } = await import('./ipc/commands');
      existingCanvases = await listCanvases();
    } catch (err) {
      console.warn('[UI] Failed to list canvases (browser mode):', err);
      // Continue with empty canvas list in browser mode
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay canvas-launcher-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Canvas Launcher</h2>
          <button class="modal-close-btn" id="canvas-modal-close">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- New Canvas Section -->
          <div class="canvas-section">
            <h3>Create New Canvas</h3>
            <div class="canvas-new-form">
              <select id="canvas-language-select" class="form-select">
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="rust">Rust</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="markdown">Markdown</option>
                <option value="plaintext">Plain Text</option>
              </select>
              <button id="create-canvas-btn" class="btn-primary">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Create Canvas
              </button>
            </div>
          </div>

          <!-- Existing Canvases Section -->
          <div class="canvas-section">
            <h3>Recent Canvases</h3>
            <div class="canvas-list" id="canvas-list">
              ${existingCanvases.length === 0
                ? '<p class="empty-state">No canvases yet. Create your first one!</p>'
                : existingCanvases.map(canvas => `
                  <div class="canvas-item" data-canvas-id="${canvas.id}">
                    <div class="canvas-item-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                      </svg>
                    </div>
                    <div class="canvas-item-info">
                      <div class="canvas-item-title">${canvas.title || 'Untitled'}</div>
                      <div class="canvas-item-meta">${canvas.language} • ${new Date(canvas.lastModified).toLocaleString()}</div>
                    </div>
                    <button class="canvas-item-delete" data-canvas-id="${canvas.id}">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6 2l-1 2H2v2h1l1 12h12l1-12h1V4h-3l-1-2H6z"/>
                      </svg>
                    </button>
                  </div>
                `).join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to body
    document.body.appendChild(modal);

    // Show modal with animation
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);

    // Bind close button
    const closeBtn = modal.querySelector('#canvas-modal-close');
    closeBtn?.addEventListener('click', () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300); // Wait for animation
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300); // Wait for animation
      }
    });

    // Bind create button
    const createBtn = modal.querySelector('#create-canvas-btn');
    const languageSelect = modal.querySelector('#canvas-language-select') as HTMLSelectElement;

    createBtn?.addEventListener('click', async () => {
      const language = languageSelect.value;
      console.log(`[UI] Creating new canvas with language: ${language}`);

      // In browser mode, just show a notification
      if (typeof (window as any).__TAURI__ === 'undefined') {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
        showNotification(`Canvas feature requires Tauri desktop app (selected: ${language})`, 'info');
        return;
      }

      try {
        const { CanvasManager } = await import('../modules/canvas/canvas');
        const canvasManager = CanvasManager.getInstance();
        const canvas = await canvasManager.createCanvas({ language });
        await canvasManager.openCanvas(canvas.id);
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
        showNotification(`Canvas created: ${language}`, 'success');

        // TODO: Navigate to canvas view
        console.log('[UI] Canvas created:', canvas.id);
      } catch (error) {
        console.error('[UI] Failed to create canvas:', error);
        showNotification('Failed to create canvas', 'error');
      }
    });

    // Bind canvas item clicks
    const canvasItems = modal.querySelectorAll('.canvas-item');
    canvasItems.forEach(item => {
      const canvasId = (item as HTMLElement).dataset.canvasId;

      item.addEventListener('click', async (e) => {
        // Don't trigger if clicking delete button
        if ((e.target as HTMLElement).closest('.canvas-item-delete')) {
          return;
        }

        console.log(`[UI] Opening canvas: ${canvasId}`);

        // In browser mode, just show a notification
        if (typeof (window as any).__TAURI__ === 'undefined') {
          modal.classList.remove('active');
          setTimeout(() => modal.remove(), 300);
          showNotification('Canvas feature requires Tauri desktop app', 'info');
          return;
        }

        try {
          const { CanvasManager } = await import('../modules/canvas/canvas');
          const canvasManager = CanvasManager.getInstance();
          await canvasManager.openCanvas(canvasId!);
          modal.classList.remove('active');
          setTimeout(() => modal.remove(), 300);
          showNotification('Canvas opened', 'success');

          // TODO: Navigate to canvas view
        } catch (error) {
          console.error('[UI] Failed to open canvas:', error);
          showNotification('Failed to open canvas', 'error');
        }
      });
    });

    // Bind delete buttons
    const deleteButtons = modal.querySelectorAll('.canvas-item-delete');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const canvasId = (btn as HTMLElement).dataset.canvasId;

        if (confirm('Are you sure you want to delete this canvas?')) {
          console.log(`[UI] Deleting canvas: ${canvasId}`);
          try {
            const { deleteCanvas } = await import('./ipc/commands');
            await deleteCanvas(canvasId!);

            // Remove from UI
            const item = btn.closest('.canvas-item');
            item?.remove();

            showNotification('Canvas deleted', 'success');
          } catch (error) {
            console.error('[UI] Failed to delete canvas:', error);
            showNotification('Failed to delete canvas', 'error');
          }
        }
      });
    });

    console.log('[UI] ✅ Canvas Launcher opened');
  } catch (error) {
    console.error('[UI] Failed to open Canvas Launcher:', error);
    showNotification('Failed to open Canvas Launcher', 'error');
  }
}


