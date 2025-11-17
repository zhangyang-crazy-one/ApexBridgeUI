/**
 * Agents Page - Main logic for agent management UI
 * Handles agent creation, editing, deletion, and listing
 */

import { AgentManager } from '../../core/managers/agentManager';
import { AgentCard } from '../../components/AgentCard';
import { AgentEditor } from '../../components/AgentEditor';
import type { Agent } from '../../core/models';
import { initI18n } from '../../core/i18n/i18nHelper';

// State
const state = {
  agentManager: new AgentManager(),
  agents: [] as Agent[],
  searchQuery: '',
};

// DOM Elements
const elements = {
  agentsGrid: document.getElementById('agents-grid') as HTMLElement,
  emptyState: document.getElementById('empty-state') as HTMLElement,
  loadingState: document.getElementById('loading-state') as HTMLElement,
  searchInput: document.getElementById('agent-search') as HTMLInputElement,
  createBtn: document.getElementById('create-agent-btn') as HTMLButtonElement,
  backBtn: document.getElementById('back-btn') as HTMLButtonElement,
  totalCount: document.getElementById('total-agents-count') as HTMLElement,
  modalContainer: document.getElementById('modal-container') as HTMLElement,
};

// Initialize
async function initialize() {
  console.log('[Agents] Initializing...');

  // Initialize i18n
  initI18n('zh-CN');

  // Attach event listeners
  attachEventListeners();

  // Load agents
  await loadAgents();

  console.log('[Agents] Initialization complete');
}

// Load all agents
async function loadAgents() {
  showLoading();

  try {
    state.agents = await state.agentManager.listAllAgents();
    renderAgents();
    updateStats();
  } catch (error) {
    console.error('[Agents] Failed to load agents:', error);
    showError('Failed to load agents');
  }

  hideLoading();
}

// Render agent cards
function renderAgents() {
  const agentsToShow = state.searchQuery
    ? state.agents.filter(agent =>
        agent.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        agent.model.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.agents;

  if (agentsToShow.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();
  elements.agentsGrid.innerHTML = '';

  agentsToShow.forEach(agent => {
    const cardContainer = document.createElement('div');
    cardContainer.className = 'agent-card-container';
    elements.agentsGrid.appendChild(cardContainer);

    new AgentCard(cardContainer, {
      agent,
      onEdit: handleEditAgent,
      onDelete: handleDeleteAgent,
      onClick: handleAgentClick,
    });
  });
}

// Handle agent creation
function handleCreateAgent() {
  console.log('[Agents] Opening create agent editor');

  const editor = new AgentEditor(elements.modalContainer, {
    mode: 'create',
    onSave: async (data) => {
      try {
        console.log('[Agents] Creating agent:', data);
        const newAgent = await state.agentManager.createAgent(data);
        state.agents.push(newAgent);
        renderAgents();
        updateStats();
        showSuccess('Agent created successfully');
      } catch (error: any) {
        console.error('[Agents] Failed to create agent:', error);
        showError(error.message || 'Failed to create agent');
      }
    },
    onCancel: () => {
      console.log('[Agents] Create cancelled');
    },
  });

  editor.show();
}

// Handle agent editing
function handleEditAgent(agent: Agent) {
  console.log('[Agents] Opening edit agent editor:', agent.id);

  const editor = new AgentEditor(elements.modalContainer, {
    mode: 'edit',
    agent,
    onSave: async (updates) => {
      try {
        console.log('[Agents] Updating agent:', agent.id, updates);
        const updatedAgent = await state.agentManager.updateAgent(agent.id, updates);

        // Update in state
        const index = state.agents.findIndex(a => a.id === agent.id);
        if (index !== -1) {
          state.agents[index] = updatedAgent;
        }

        renderAgents();
        showSuccess('Agent updated successfully');
      } catch (error: any) {
        console.error('[Agents] Failed to update agent:', error);
        showError(error.message || 'Failed to update agent');
      }
    },
    onCancel: () => {
      console.log('[Agents] Edit cancelled');
    },
  });

  editor.show();
}

// Handle agent deletion
async function handleDeleteAgent(agent: Agent) {
  const confirmed = confirm(
    `Are you sure you want to delete "${agent.name}"?\n\n` +
    `This will also delete all topics associated with this agent.`
  );

  if (!confirmed) return;

  try {
    console.log('[Agents] Deleting agent:', agent.id);
    await state.agentManager.deleteAgent(agent.id);

    // Remove from state
    state.agents = state.agents.filter(a => a.id !== agent.id);

    renderAgents();
    updateStats();
    showSuccess('Agent deleted successfully');
  } catch (error: any) {
    console.error('[Agents] Failed to delete agent:', error);
    showError(error.message || 'Failed to delete agent');
  }
}

// Handle agent card click
function handleAgentClick(agent: Agent) {
  console.log('[Agents] Agent clicked:', agent.id);
  // TODO: Navigate to chat with this agent
  // For now, just show agent details
  alert(`Agent: ${agent.name}\nModel: ${agent.model}\nTemperature: ${agent.temperature}`);
}

// Handle search
function handleSearch() {
  state.searchQuery = elements.searchInput.value.trim();
  console.log('[Agents] Search query:', state.searchQuery);
  renderAgents();
}

// Handle back navigation
function handleBack() {
  console.log('[Agents] Navigating back');
  window.location.href = './index.html';
}

// Update statistics
function updateStats() {
  elements.totalCount.textContent = state.agents.length.toString();
}

// Show/hide states
function showLoading() {
  elements.loadingState.classList.remove('hidden');
  elements.agentsGrid.classList.add('hidden');
  elements.emptyState.classList.add('hidden');
}

function hideLoading() {
  elements.loadingState.classList.add('hidden');
  elements.agentsGrid.classList.remove('hidden');
}

function showEmptyState() {
  elements.emptyState.classList.remove('hidden');
  elements.agentsGrid.classList.add('hidden');
}

function hideEmptyState() {
  elements.emptyState.classList.add('hidden');
  elements.agentsGrid.classList.remove('hidden');
}

// Notification helpers
function showSuccess(message: string) {
  // TODO: Implement toast notification system
  console.log('[Agents] Success:', message);
  alert(message);
}

function showError(message: string) {
  // TODO: Implement toast notification system
  console.error('[Agents] Error:', message);
  alert(message);
}

// Attach event listeners
function attachEventListeners() {
  // Create agent button
  elements.createBtn.addEventListener('click', handleCreateAgent);

  // Back button
  elements.backBtn.addEventListener('click', handleBack);

  // Search input
  elements.searchInput.addEventListener('input', handleSearch);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N: New agent
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      handleCreateAgent();
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
