/**
 * Groups Page - Main logic for group management UI
 * Handles group creation, editing, deletion, and listing
 */

import { GroupManager } from '../../core/managers/groupManager';
import { AgentManager } from '../../core/managers/agentManager';
import { GroupCard } from '../../components/GroupCard';
import { GroupEditor } from '../../components/GroupEditor';
import type { Group, Agent } from '../../core/models';
import { initI18n } from '../../core/i18n/i18nHelper';

// State
const state = {
  groupManager: new GroupManager(),
  agentManager: new AgentManager(),
  groups: [] as Group[],
  agents: [] as Agent[],
  searchQuery: '',
};

// DOM Elements
const elements = {
  groupsGrid: document.getElementById('groups-grid') as HTMLElement,
  emptyState: document.getElementById('empty-state') as HTMLElement,
  loadingState: document.getElementById('loading-state') as HTMLElement,
  searchInput: document.getElementById('group-search') as HTMLInputElement,
  createBtn: document.getElementById('create-group-btn') as HTMLButtonElement,
  backBtn: document.getElementById('back-btn') as HTMLButtonElement,
  totalCount: document.getElementById('total-groups-count') as HTMLElement,
  sequentialCount: document.getElementById('sequential-count') as HTMLElement,
  freeCount: document.getElementById('free-count') as HTMLElement,
  modalContainer: document.getElementById('modal-container') as HTMLElement,
};

// Initialize
async function initialize() {
  console.log('[Groups] Initializing...');

  // Initialize i18n
  initI18n('zh-CN');

  // Attach event listeners
  attachEventListeners();

  // Load agents first (needed for group creation)
  await loadAgents();

  // Load groups
  await loadGroups();

  console.log('[Groups] Initialization complete');
}

// Load all agents
async function loadAgents() {
  try {
    state.agents = await state.agentManager.listAllAgents();
    console.log('[Groups] Loaded', state.agents.length, 'agents');
  } catch (error) {
    console.error('[Groups] Failed to load agents:', error);
    showError('Failed to load agents');
  }
}

// Load all groups
async function loadGroups() {
  showLoading();

  try {
    state.groups = await state.groupManager.listAllGroups();
    renderGroups();
    updateStats();
  } catch (error) {
    console.error('[Groups] Failed to load groups:', error);
    showError('Failed to load groups');
  }

  hideLoading();
}

// Render group cards
function renderGroups() {
  const groupsToShow = state.searchQuery
    ? state.groups.filter(group =>
        group.name.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.groups;

  if (groupsToShow.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();
  elements.groupsGrid.innerHTML = '';

  groupsToShow.forEach(group => {
    const cardContainer = document.createElement('div');
    cardContainer.className = 'group-card-container';
    elements.groupsGrid.appendChild(cardContainer);

    new GroupCard(cardContainer, {
      group,
      onEdit: handleEditGroup,
      onDelete: handleDeleteGroup,
      onClick: handleGroupClick,
    });
  });
}

// Handle group creation
function handleCreateGroup() {
  console.log('[Groups] Opening create group editor');

  // Check if there are enough agents
  if (state.agents.length < 2) {
    showError('You need at least 2 agents to create a group. Please create agents first.');
    return;
  }

  const editor = new GroupEditor(elements.modalContainer, {
    mode: 'create',
    availableAgents: state.agents,
    onSave: async (data) => {
      try {
        console.log('[Groups] Creating group:', data);
        const newGroup = await state.groupManager.createGroup(data);
        state.groups.push(newGroup);
        renderGroups();
        updateStats();
        showSuccess('Group created successfully');
      } catch (error: any) {
        console.error('[Groups] Failed to create group:', error);
        showError(error.message || 'Failed to create group');
      }
    },
    onCancel: () => {
      console.log('[Groups] Create cancelled');
    },
  });

  editor.show();
}

// Handle group editing
function handleEditGroup(group: Group) {
  console.log('[Groups] Opening edit group editor:', group.id);

  const editor = new GroupEditor(elements.modalContainer, {
    mode: 'edit',
    group,
    availableAgents: state.agents,
    onSave: async (updates) => {
      try {
        console.log('[Groups] Updating group:', group.id, updates);
        const updatedGroup = await state.groupManager.updateGroup(group.id, updates);

        // Update in state
        const index = state.groups.findIndex(g => g.id === group.id);
        if (index !== -1) {
          state.groups[index] = updatedGroup;
        }

        renderGroups();
        updateStats();
        showSuccess('Group updated successfully');
      } catch (error: any) {
        console.error('[Groups] Failed to update group:', error);
        showError(error.message || 'Failed to update group');
      }
    },
    onCancel: () => {
      console.log('[Groups] Edit cancelled');
    },
  });

  editor.show();
}

// Handle group deletion
async function handleDeleteGroup(group: Group) {
  const confirmed = confirm(
    `Are you sure you want to delete "${group.name}"?\n\n` +
    `This will also delete all topics associated with this group.`
  );

  if (!confirmed) return;

  try {
    console.log('[Groups] Deleting group:', group.id);
    await state.groupManager.deleteGroup(group.id);

    // Remove from state
    state.groups = state.groups.filter(g => g.id !== group.id);

    renderGroups();
    updateStats();
    showSuccess('Group deleted successfully');
  } catch (error: any) {
    console.error('[Groups] Failed to delete group:', error);
    showError(error.message || 'Failed to delete group');
  }
}

// Handle group card click
function handleGroupClick(group: Group) {
  console.log('[Groups] Group clicked:', group.id);
  // TODO: Navigate to chat with this group
  // For now, show group details
  const agentNames = state.agents
    .filter(agent => group.agent_ids.includes(agent.id))
    .map(agent => agent.name)
    .join(', ');

  alert(
    `Group: ${group.name}\n` +
    `Mode: ${group.collaboration_mode}\n` +
    `Agents: ${agentNames}\n` +
    `Turn Count: ${group.turn_count}`
  );
}

// Handle search
function handleSearch() {
  state.searchQuery = elements.searchInput.value.trim();
  console.log('[Groups] Search query:', state.searchQuery);
  renderGroups();
}

// Handle back navigation
function handleBack() {
  console.log('[Groups] Navigating back');
  window.location.href = './index.html';
}

// Update statistics
function updateStats() {
  elements.totalCount.textContent = state.groups.length.toString();

  const sequentialCount = state.groups.filter(g => g.collaboration_mode === 'sequential').length;
  const freeCount = state.groups.filter(g => g.collaboration_mode === 'free').length;

  elements.sequentialCount.textContent = sequentialCount.toString();
  elements.freeCount.textContent = freeCount.toString();
}

// Show/hide states
function showLoading() {
  elements.loadingState.classList.remove('hidden');
  elements.groupsGrid.classList.add('hidden');
  elements.emptyState.classList.add('hidden');
}

function hideLoading() {
  elements.loadingState.classList.add('hidden');
  elements.groupsGrid.classList.remove('hidden');
}

function showEmptyState() {
  elements.emptyState.classList.remove('hidden');
  elements.groupsGrid.classList.add('hidden');
}

function hideEmptyState() {
  elements.emptyState.classList.add('hidden');
  elements.groupsGrid.classList.remove('hidden');
}

// Notification helpers
function showSuccess(message: string) {
  // TODO: Implement toast notification system
  console.log('[Groups] Success:', message);
  alert(message);
}

function showError(message: string) {
  // TODO: Implement toast notification system
  console.error('[Groups] Error:', message);
  alert(message);
}

// Attach event listeners
function attachEventListeners() {
  // Create group button
  elements.createBtn.addEventListener('click', handleCreateGroup);

  // Back button
  elements.backBtn.addEventListener('click', handleBack);

  // Search input
  elements.searchInput.addEventListener('input', handleSearch);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N: New group
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      handleCreateGroup();
    }

    // Escape: Clear search
    if (e.key === 'Escape' && elements.searchInput.value) {
      elements.searchInput.value = '';
      handleSearch();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
