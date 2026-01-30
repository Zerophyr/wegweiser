// spaces.js - Spaces feature logic

// Storage keys (match constants.js)
const STORAGE_KEYS = {
  SPACES: 'or_spaces',
  THREADS: 'or_threads',
  API_KEY: 'or_api_key',
  MODEL: 'or_model',
  MODEL_PROVIDER: 'or_model_provider'
};

// Provider state
let currentProvider = 'openrouter';
const MAX_CONTEXT_MESSAGES = 16;

function normalizeProviderSafe(providerId) {
  if (typeof normalizeProviderId === 'function') {
    return normalizeProviderId(providerId);
  }
  return providerId === 'naga' ? 'naga' : 'openrouter';
}

function getProviderLabelSafe(providerId) {
  if (typeof getProviderLabel === 'function') {
    return getProviderLabel(providerId);
  }
  return normalizeProviderSafe(providerId) === 'naga' ? 'NagaAI' : 'OpenRouter';
}

function getProviderStorageKeySafe(baseKey, providerId) {
  if (typeof getProviderStorageKey === 'function') {
    return getProviderStorageKey(baseKey, providerId);
  }
  return normalizeProviderSafe(providerId) === 'naga' ? `${baseKey}_naga` : baseKey;
}

function buildCombinedModelIdSafe(providerId, modelId) {
  if (typeof buildCombinedModelId === 'function') {
    return buildCombinedModelId(providerId, modelId);
  }
  return `${normalizeProviderSafe(providerId)}:${modelId}`;
}

function parseCombinedModelIdSafe(combinedId) {
  if (typeof parseCombinedModelId === 'function') {
    return parseCombinedModelId(combinedId);
  }
  if (!combinedId || typeof combinedId !== 'string') {
    return { provider: 'openrouter', modelId: '' };
  }
  const splitIndex = combinedId.indexOf(':');
  if (splitIndex === -1) {
    return { provider: 'openrouter', modelId: combinedId };
  }
  const provider = normalizeProviderSafe(combinedId.slice(0, splitIndex));
  const modelId = combinedId.slice(splitIndex + 1);
  return { provider, modelId };
}

function getModelDisplayName(model) {
  return model?.displayName || model?.name || model?.id || '';
}

function buildCombinedFavoritesList(favoritesByProvider) {
  const combined = [];
  ['openrouter', 'naga'].forEach((provider) => {
    const favorites = favoritesByProvider[provider] || new Set();
    favorites.forEach((modelId) => {
      combined.push(buildCombinedModelIdSafe(provider, modelId));
    });
  });
  return combined;
}

function buildCombinedRecentList(recentsByProvider) {
  const combined = [];
  ['openrouter', 'naga'].forEach((provider) => {
    const recents = recentsByProvider[provider] || [];
    recents.forEach((modelId) => {
      const combinedId = buildCombinedModelIdSafe(provider, modelId);
      if (!combined.includes(combinedId)) {
        combined.push(combinedId);
      }
    });
  });
  return combined;
}

function getSpaceModelLabel(space) {
  if (!space || !space.model) return 'Default';
  if (space.modelDisplayName) return space.modelDisplayName;
  if (typeof buildModelDisplayName === 'function') {
    return buildModelDisplayName(space.modelProvider || 'openrouter', space.model);
  }
  return space.model.split('/').pop() || space.model;
}

function updateChatModelIndicator(space) {
  if (!elements.chatModelIndicator) return;
  if (!space) {
    elements.chatModelIndicator.textContent = '';
    return;
  }
  if (typeof formatThreadModelLabel === 'function') {
    elements.chatModelIndicator.textContent = formatThreadModelLabel({
      model: space.model || '',
      modelDisplayName: space.modelDisplayName || ''
    });
    return;
  }
  elements.chatModelIndicator.textContent = `Model: ${getSpaceModelLabel(space)}`;
}

async function loadProviderSetting() {
  try {
    const stored = await chrome.storage.local.get(['or_provider', 'or_model_provider']);
    currentProvider = normalizeProviderSafe(stored.or_model_provider || stored.or_provider);
  } catch (e) {
    console.warn('Failed to load provider setting:', e);
  }
}

const MAX_STORAGE_BYTES = 10485760; // 10MB

// Common emojis for space icons
const SPACE_EMOJIS = [
  '📁', '📂', '📋', '📝', '📚', '📖', '📓', '📒',
  '💼', '🗂️', '🗃️', '📊', '📈', '📉', '🧮', '💡',
  '🎯', '🚀', '⭐', '🌟', '💫', '✨', '🔥', '💪',
  '🧠', '💭', '💬', '🗣️', '👥', '🤝', '🎓', '🏆',
  '🔬', '🔭', '🧪', '⚗️', '🔧', '🔨', '⚙️', '🛠️',
  '💻', '🖥️', '📱', '🌐', '🔗', '📡', '🎮', '🎨',
  '🎵', '🎬', '📷', '🎤', '✏️', '🖊️', '🖌️', '📐',
  '🏠', '🏢', '🏗️', '🌳', '🌍', '🌎', '🌏', '☀️'
];

// ============ UTILITY FUNCTIONS ============

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}. ${month}. ${year}`;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function generateThreadTitle(firstMessage) {
  // Get first sentence or first 50 chars
  const firstSentence = firstMessage.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) {
    return firstSentence.trim();
  }
  return firstMessage.substring(0, 50).trim() + '...';
}

function getLiveWindowSize(summary) {
  return summary ? 8 : 12;
}

function splitMessagesForSummary(messages, liveWindowSize) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  if (safeMessages.length <= liveWindowSize) {
    return { historyToSummarize: [], liveMessages: safeMessages };
  }
  const cutoffIndex = safeMessages.length - liveWindowSize;
  return {
    historyToSummarize: safeMessages.slice(0, cutoffIndex),
    liveMessages: safeMessages.slice(cutoffIndex)
  };
}

function shouldSkipSummarization(prompt) {
  if (typeof prompt !== 'string') return false;
  const estimatedTokens = Math.ceil(prompt.length / 4);
  return estimatedTokens > 2000;
}

function getSummaryMinLength(historyCount) {
  const safeCount = Number.isFinite(historyCount) ? historyCount : Number(historyCount) || 0;
  const scaled = safeCount * 20;
  return Math.max(80, Math.min(200, scaled));
}

function appendArchivedMessages(currentArchive, newMessages) {
  const safeCurrent = Array.isArray(currentArchive) ? currentArchive : [];
  const safeNew = Array.isArray(newMessages) ? newMessages : [];
  return [...safeCurrent, ...safeNew];
}

function buildSpacesContextData(thread) {
  const summary = typeof thread?.summary === 'string' ? thread.summary : '';
  const liveMessages = Array.isArray(thread?.messages) ? thread.messages : [];
  const archivedMessages = Array.isArray(thread?.archivedMessages) ? thread.archivedMessages : [];
  return { summary, liveMessages, archivedMessages };
}

function buildContextBadgeLabel(contextSize) {
  if (!contextSize || contextSize <= 2) {
    return '';
  }
  return `${Math.floor(contextSize / 2)} Q&A`;
}

function getContextUsageCount(thread, space) {
  const data = buildSpacesContextData(thread);
  let count = data.liveMessages.length;
  if (data.summary) {
    count += 1;
  }
  if (space?.customInstructions && space.customInstructions.trim().length) {
    count += 1;
  }
  return count;
}

function updateSpacesContextButton(thread, space) {
  if (!elements.spacesContextBtn) return;
  const badgeEl = elements.spacesContextBadge;
  if (!thread) {
    elements.spacesContextBtn.classList.add('inactive');
    elements.spacesContextBtn.setAttribute('aria-disabled', 'true');
    if (badgeEl) {
      badgeEl.style.display = 'none';
      badgeEl.textContent = '';
    }
    return;
  }

  const data = buildSpacesContextData(thread);
  const label = buildContextBadgeLabel(data.liveMessages.length);
  const isActive = Boolean(label);
  elements.spacesContextBtn.classList.toggle('inactive', !isActive);
  elements.spacesContextBtn.setAttribute('aria-disabled', isActive ? 'false' : 'true');

  if (badgeEl) {
    if (isActive) {
      badgeEl.textContent = label;
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
      badgeEl.textContent = '';
    }
  }

  const usedCount = getContextUsageCount(thread, space);
  const remaining = Math.max(MAX_CONTEXT_MESSAGES - usedCount, 0);
  elements.spacesContextBtn.title = isActive
    ? `${usedCount} messages in context · ${remaining} remaining`
    : 'No conversation context yet';
}

function buildContextMessageHtml(messages) {
  return (messages || []).map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'User';
    const roleClass = msg.role === 'assistant' ? 'assistant' : '';
    const preview = truncateText(msg.content || '', 160);
    return `
      <div class="spaces-context-item">
        <div class="spaces-context-role ${roleClass}">${escapeHtml(role)}</div>
        <div class="spaces-context-text">${escapeHtml(preview)}</div>
      </div>
    `;
  }).join('');
}

function openSpacesContextModal(thread, space) {
  if (!thread) return;
  const data = buildSpacesContextData(thread);
  const usedCount = getContextUsageCount(thread, space);
  const remaining = Math.max(MAX_CONTEXT_MESSAGES - usedCount, 0);
  const fillPercentage = Math.min((usedCount / MAX_CONTEXT_MESSAGES) * 100, 100);
  const isNearLimit = fillPercentage > 75;

  const overlay = document.createElement('div');
  overlay.className = 'spaces-context-overlay';

  const modal = document.createElement('div');
  modal.className = 'spaces-context-modal';

  modal.innerHTML = `
    <div class="spaces-context-header">
      <h3><span>🧠</span><span>Conversation Context</span></h3>
      <button class="spaces-context-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="spaces-context-body">
      ${data.summary ? `
        <div class="spaces-context-section">
          <h4>Summary</h4>
          <div class="spaces-context-text">${escapeHtml(data.summary)}</div>
        </div>
      ` : ''}
      <div class="spaces-context-section">
        <h4>Live Messages (${data.liveMessages.length})</h4>
        ${data.liveMessages.length ? buildContextMessageHtml(data.liveMessages) : '<div class="spaces-context-text">No live messages yet.</div>'}
      </div>
      ${data.archivedMessages.length ? `
        <div class="spaces-context-section">
          <button class="spaces-context-archive-toggle" type="button">
            <span>Archived messages (${data.archivedMessages.length})</span>
            <span>+</span>
          </button>
          <div class="spaces-context-archive-content">
            ${buildContextMessageHtml(data.archivedMessages)}
          </div>
        </div>
      ` : ''}
      ${space?.customInstructions && space.customInstructions.trim().length ? `
        <div class="spaces-context-section">
          <h4>Custom Instructions</h4>
          <div class="spaces-context-text">${escapeHtml(truncateText(space.customInstructions, 220))}</div>
        </div>
      ` : ''}
    </div>
    <div class="spaces-context-footer">
      <div class="spaces-context-text">${usedCount}/${MAX_CONTEXT_MESSAGES} messages in context · ${remaining} remaining</div>
      <div class="spaces-context-bar">
        <div class="spaces-context-bar-fill" style="width: ${fillPercentage}%; background: ${isNearLimit ? 'var(--color-warning)' : 'var(--color-success)'};"></div>
      </div>
      ${isNearLimit ? '<div class="spaces-context-warning">⚠️ Context is nearing capacity.</div>' : ''}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('.spaces-context-close');
  closeBtn?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const archiveToggle = modal.querySelector('.spaces-context-archive-toggle');
  const archiveContent = modal.querySelector('.spaces-context-archive-content');
  if (archiveToggle && archiveContent) {
    archiveToggle.addEventListener('click', () => {
      const isOpen = archiveContent.classList.toggle('open');
      const indicator = archiveToggle.querySelector('span:last-child');
      if (indicator) {
        indicator.textContent = isOpen ? '−' : '+';
      }
    });
  }
}


// ============ STORAGE FUNCTIONS ============

async function loadSpaces() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SPACES]);
    return result[STORAGE_KEYS.SPACES] || [];
  } catch (e) {
    console.error('Error loading spaces:', e);
    return [];
  }
}

async function saveSpaces(spaces) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SPACES]: spaces });
}

async function loadThreads(spaceId = null) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.THREADS]);
    const threads = result[STORAGE_KEYS.THREADS] || [];
    if (spaceId) {
      return threads.filter(t => t.spaceId === spaceId);
    }
    return threads;
  } catch (e) {
    console.error('Error loading threads:', e);
    return [];
  }
}

async function saveThreads(threads) {
  await chrome.storage.local.set({ [STORAGE_KEYS.THREADS]: threads });
}

async function getThreadCount(spaceId) {
  const threads = await loadThreads(spaceId);
  return threads.length;
}

async function checkStorageUsage() {
  const bytesInUse = await chrome.storage.local.getBytesInUse();
  const percentUsed = (bytesInUse / MAX_STORAGE_BYTES) * 100;

  return {
    bytesInUse,
    maxBytes: MAX_STORAGE_BYTES,
    percentUsed,
    formatted: `${(bytesInUse / 1024 / 1024).toFixed(1)}MB of 10MB`
  };
}

async function estimateItemSize(item) {
  const json = JSON.stringify(item);
  return new Blob([json]).size;
}

// ============ SPACE CRUD ============

async function createSpace(data) {
  const spaces = await loadSpaces();
  const space = {
    id: generateId('space'),
    name: data.name,
    description: data.description || '',
    icon: data.icon || '📁',
    model: data.model || '',
    modelProvider: data.modelProvider || null,
    modelDisplayName: data.modelDisplayName || '',
    customInstructions: data.customInstructions || '',
    webSearch: data.webSearch || false,
    reasoning: data.reasoning || false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  spaces.push(space);
  await saveSpaces(spaces);
  return space;
}

async function updateSpace(id, data) {
  const spaces = await loadSpaces();
  const index = spaces.findIndex(s => s.id === id);
  if (index === -1) throw new Error('Space not found');

  spaces[index] = {
    ...spaces[index],
    ...data,
    updatedAt: Date.now()
  };
  await saveSpaces(spaces);
  return spaces[index];
}

async function deleteSpace(id) {
  const spaces = await loadSpaces();
  const filtered = spaces.filter(s => s.id !== id);
  await saveSpaces(filtered);

  // Also delete all threads in this space
  const threads = await loadThreads();
  const filteredThreads = threads.filter(t => t.spaceId !== id);
  await saveThreads(filteredThreads);
}

async function getSpace(id) {
  const spaces = await loadSpaces();
  return spaces.find(s => s.id === id);
}

// ============ THREAD CRUD ============

async function createThread(spaceId, title = 'New Thread') {
  const threads = await loadThreads();
  const thread = {
    id: generateId('thread'),
    spaceId,
    title,
    messages: [],
    summary: '',
    summaryUpdatedAt: null,
    archivedMessages: [],
    archivedUpdatedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  threads.push(thread);
  await saveThreads(threads);
  return thread;
}

async function updateThread(id, data) {
  const threads = await loadThreads();
  const index = threads.findIndex(t => t.id === id);
  if (index === -1) throw new Error('Thread not found');

  threads[index] = {
    ...threads[index],
    ...data,
    updatedAt: Date.now()
  };
  await saveThreads(threads);
  return threads[index];
}

async function deleteThread(id) {
  const threads = await loadThreads();
  const filtered = threads.filter(t => t.id !== id);
  await saveThreads(filtered);
}

async function getThread(id) {
  const threads = await loadThreads();
  return threads.find(t => t.id === id);
}

async function addMessageToThread(threadId, message) {
  const thread = await getThread(threadId);
  if (!thread) throw new Error('Thread not found');

  thread.messages.push(message);
  thread.updatedAt = Date.now();

  // Auto-generate title from first user message if title is default
  if (thread.messages.length === 1 && message.role === 'user' && thread.title === 'New Thread') {
    thread.title = generateThreadTitle(message.content);
  }

  const threads = await loadThreads();
  const index = threads.findIndex(t => t.id === threadId);
  threads[index] = thread;
  await saveThreads(threads);

  return thread;
}

// ============ UI STATE ============

let currentSpaceId = null;
let currentThreadId = null;
let currentSpaceData = null;
let isStreaming = false;
let streamPort = null;
let editingSpaceId = null;
let renamingThreadId = null;
let deletingItem = null; // { type: 'space'|'thread', id: string }
let spaceModelDropdown = null;
let spaceModelMap = new Map();
let spaceFavoriteModelsByProvider = {
  openrouter: new Set(),
  naga: new Set()
};
let spaceRecentModelsByProvider = {
  openrouter: [],
  naga: []
};

// ============ DOM ELEMENTS ============

const elements = {};

function initElements() {
  // Views
  elements.spacesListView = document.getElementById('spaces-list-view');
  elements.spaceView = document.getElementById('space-view');

  // Spaces list
  elements.spacesGrid = document.getElementById('spaces-grid');
  elements.emptyState = document.getElementById('empty-state');
  elements.createSpaceBtn = document.getElementById('create-space-btn');
  elements.emptyCreateBtn = document.getElementById('empty-create-btn');
  elements.storageFooter = document.getElementById('storage-footer');
  elements.storageFill = document.getElementById('storage-fill');
  elements.storageText = document.getElementById('storage-text');
  elements.storageWarning = document.getElementById('storage-warning');
  elements.warningMessage = document.getElementById('warning-message');
  elements.warningClose = document.getElementById('warning-close');

  // Space view
  elements.backBtn = document.getElementById('back-btn');
  elements.spaceTitle = document.getElementById('space-title');
  elements.spaceSettingsBtn = document.getElementById('space-settings-btn');
  elements.newThreadBtn = document.getElementById('new-thread-btn');
  elements.threadList = document.getElementById('thread-list');
  elements.chatEmptyState = document.getElementById('chat-empty-state');
  elements.chatContainer = document.getElementById('chat-container');
  elements.chatMessages = document.getElementById('chat-messages');
  elements.chatInput = document.getElementById('chat-input');
  elements.sendBtn = document.getElementById('send-btn');
  elements.stopBtn = document.getElementById('stop-btn');
  elements.chatModelIndicator = document.getElementById('chat-model-indicator');
  elements.spacesContextBtn = document.getElementById('spaces-context-btn');
  elements.spacesContextBadge = document.querySelector('.spaces-context-badge');
  elements.chatWebSearch = document.getElementById('chat-web-search');
  elements.chatReasoning = document.getElementById('chat-reasoning');

  // Space modal
  elements.spaceModal = document.getElementById('space-modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalClose = document.getElementById('modal-close');
  elements.spaceForm = document.getElementById('space-form');
  elements.spaceName = document.getElementById('space-name');
  elements.spaceDescription = document.getElementById('space-description');
  elements.spaceModel = document.getElementById('space-model');
  elements.spaceModelInput = document.getElementById('space-model-input');
  elements.spaceInstructions = document.getElementById('space-instructions');
  elements.spaceIcon = document.getElementById('space-icon');
  elements.iconPreview = document.getElementById('icon-preview');
  elements.emojiGrid = document.getElementById('emoji-grid');
  elements.emojiGridInner = document.getElementById('emoji-grid-inner');
  elements.spaceWebSearch = document.getElementById('space-web-search');
  elements.spaceReasoning = document.getElementById('space-reasoning');
  elements.modalCancel = document.getElementById('modal-cancel');
  elements.modalSave = document.getElementById('modal-save');

  // Rename modal
  elements.renameModal = document.getElementById('rename-modal');
  elements.renameModalClose = document.getElementById('rename-modal-close');
  elements.renameForm = document.getElementById('rename-form');
  elements.threadTitle = document.getElementById('thread-title');
  elements.renameCancel = document.getElementById('rename-cancel');

  // Delete modal
  elements.deleteModal = document.getElementById('delete-modal');
  elements.deleteTitle = document.getElementById('delete-title');
  elements.deleteModalClose = document.getElementById('delete-modal-close');
  elements.deleteMessage = document.getElementById('delete-message');
  elements.deleteSize = document.getElementById('delete-size');
  elements.deleteCancel = document.getElementById('delete-cancel');
  elements.deleteConfirm = document.getElementById('delete-confirm');
}

// ============ VIEW SWITCHING ============

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  if (viewName === 'list') {
    elements.spacesListView.classList.add('active');
    currentSpaceId = null;
    currentThreadId = null;
    currentSpaceData = null;
    updateSpacesContextButton(null, null);
  } else if (viewName === 'space') {
    elements.spaceView.classList.add('active');
  }
}

// ============ RENDERING ============

async function renderSpacesList() {
  const spaces = await loadSpaces();

  if (spaces.length === 0) {
    elements.spacesGrid.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    return;
  }

  elements.spacesGrid.style.display = 'grid';
  elements.emptyState.style.display = 'none';

  // Sort by updatedAt descending
  spaces.sort((a, b) => b.updatedAt - a.updatedAt);

  const cardsHtml = await Promise.all(spaces.map(async space => {
    const modelName = getSpaceModelLabel(space);
    const spaceIcon = space.icon || '📁';
    const dateStr = formatDate(space.updatedAt);

    return `
      <div class="space-card" data-space-id="${space.id}">
        <div class="space-card-icon">${spaceIcon}</div>
        <div class="space-card-menu menu-dropdown">
          <button class="menu-btn" data-action="toggle-menu">&#8942;</button>
          <div class="menu-items" style="display: none;">
            <button class="menu-item" data-action="edit" data-space-id="${space.id}">Edit</button>
            <button class="menu-item danger" data-action="delete" data-space-id="${space.id}">Delete</button>
          </div>
        </div>
        <div class="space-card-content">
          <div class="space-card-info">
            <h3 class="space-card-name">${escapeHtml(space.name)}</h3>
          </div>
          <div class="space-card-footer">
            <span class="space-card-date">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
              ${dateStr}
            </span>
            <span class="space-card-model">${escapeHtml(modelName)}</span>
          </div>
        </div>
      </div>
    `;
  }));

  elements.spacesGrid.innerHTML = cardsHtml.join('');

  // Add click handlers using event delegation
  document.querySelectorAll('.space-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = e.target;

      // Handle menu button click
      if (target.closest('[data-action="toggle-menu"]')) {
        e.stopPropagation();
        toggleMenu(target.closest('[data-action="toggle-menu"]'));
        return;
      }

      // Handle edit click
      if (target.closest('[data-action="edit"]')) {
        e.stopPropagation();
        const spaceId = target.closest('[data-action="edit"]').dataset.spaceId;
        openEditSpaceModal(spaceId);
        return;
      }

      // Handle delete click
      if (target.closest('[data-action="delete"]')) {
        e.stopPropagation();
        const spaceId = target.closest('[data-action="delete"]').dataset.spaceId;
        openDeleteModal('space', spaceId);
        return;
      }

      // Don't navigate if clicking on menu dropdown area
      if (target.closest('.menu-dropdown')) {
        return;
      }

      // Navigate to space
      const spaceId = card.dataset.spaceId;
      openSpace(spaceId);
    });
  });
}

async function renderThreadList() {
  if (!currentSpaceId) return;

  const threads = await loadThreads(currentSpaceId);

  // Sort by updatedAt descending
  threads.sort((a, b) => b.updatedAt - a.updatedAt);

  if (threads.length === 0) {
    elements.threadList.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">No threads yet</p>';
    return;
  }

  elements.threadList.innerHTML = threads.map(thread => `
    <div class="thread-item ${thread.id === currentThreadId ? 'active' : ''}" data-thread-id="${thread.id}">
      <h4 class="thread-title">${escapeHtml(thread.title)}</h4>
      <span class="thread-time">${formatRelativeTime(thread.updatedAt)}</span>
      <div class="thread-menu menu-dropdown">
        <button class="menu-btn" data-action="toggle-menu">&#8942;</button>
        <div class="menu-items" style="display: none;">
          <button class="menu-item" data-action="rename" data-thread-id="${thread.id}">Rename</button>
          <div class="menu-item-submenu">
            <button class="menu-item" data-action="export-parent">&#9666; Export</button>
            <div class="submenu-items">
              <button class="menu-item" data-action="export" data-thread-id="${thread.id}" data-format="md">Markdown</button>
              <button class="menu-item" data-action="export" data-thread-id="${thread.id}" data-format="pdf">PDF</button>
              <button class="menu-item" data-action="export" data-thread-id="${thread.id}" data-format="docx">DOCX</button>
            </div>
          </div>
          <button class="menu-item danger" data-action="delete-thread" data-thread-id="${thread.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers using event delegation
  document.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target;

      // Handle menu button click
      if (target.closest('[data-action="toggle-menu"]')) {
        e.stopPropagation();
        toggleMenu(target.closest('[data-action="toggle-menu"]'));
        return;
      }

      // Handle rename click
      if (target.closest('[data-action="rename"]')) {
        e.stopPropagation();
        const threadId = target.closest('[data-action="rename"]').dataset.threadId;
        openRenameModal(threadId);
        return;
      }

      // Handle export click
      if (target.closest('[data-action="export"]')) {
        e.stopPropagation();
        const btn = target.closest('[data-action="export"]');
        exportThread(btn.dataset.threadId, btn.dataset.format);
        return;
      }

      // Prevent export parent from closing menu
      if (target.closest('[data-action="export-parent"]')) {
        e.stopPropagation();
        return;
      }

      // Handle delete click
      if (target.closest('[data-action="delete-thread"]')) {
        e.stopPropagation();
        const threadId = target.closest('[data-action="delete-thread"]').dataset.threadId;
        openDeleteModal('thread', threadId);
        return;
      }

      // Don't navigate if clicking on menu dropdown area
      if (target.closest('.menu-dropdown')) {
        return;
      }

      // Navigate to thread
      const threadId = item.dataset.threadId;
      openThread(threadId);
    });
  });
}

let currentArchivedMessages = [];

function buildMessageHtml(messages) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  return safeMessages.map((msg, index) => {
    if (msg.role === 'assistant') {
      const { sources, cleanText } = typeof extractSources === 'function'
        ? extractSources(msg.content)
        : { sources: [], cleanText: msg.content };

      const meta = msg.meta || null;
      const metaTime = meta?.createdAt ? new Date(meta.createdAt).toLocaleTimeString() : '';
      const metaModel = meta?.model || 'default model';
      const metaText = meta ? `${metaTime} - ${metaModel}` : '';
      const metaHtml = meta
        ? `<div class="chat-meta"><span class="chat-meta-text">${escapeHtml(metaText)}</span></div>`
        : '';

      let footerHtml = '';
      if (meta) {
        const responseTime = typeof meta.responseTimeSec === 'number'
          ? `${meta.responseTimeSec.toFixed(2)}s`
          : '--s';
        const tokensText = meta.tokens ? `${meta.tokens} tokens` : '-- tokens';
        const contextBadge = meta.contextSize > 2
          ? `<span class="chat-context-badge" title="${meta.contextSize} messages in conversation context">🧠 ${Math.floor(meta.contextSize / 2)} Q&A</span>`
          : '';
        const tokenStyle = typeof getTokenBarStyle === 'function'
          ? getTokenBarStyle(meta.tokens || null)
          : { percent: 0, gradient: 'linear-gradient(90deg, var(--color-success), #16a34a)' };

        footerHtml = `
          <div class="chat-footer">
            <div class="chat-stats">
              <span class="chat-time">${responseTime}</span>
              <span class="chat-tokens">${escapeHtml(tokensText)}</span>
              ${contextBadge}
            </div>
            <div class="token-usage-bar" role="progressbar" aria-valuenow="${tokenStyle.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
              <div class="token-usage-fill" style="width: ${tokenStyle.percent}%; background: ${tokenStyle.gradient};"></div>
            </div>
          </div>
        `;
      }

      return `
        <div class="chat-message chat-message-assistant" data-msg-index="${index}">
          <div class="chat-bubble-wrapper">
            ${metaHtml}
            <div class="chat-bubble">
              <div class="chat-content" data-sources='${JSON.stringify(sources)}'>${applyMarkdownStyles(cleanText)}</div>
              ${footerHtml}
              <div class="chat-actions">
                <div class="chat-actions-left">
                  <button class="action-btn chat-copy-btn" title="Copy answer" aria-label="Copy answer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  </button>
                  <div class="export-menu">
                    <button class="action-btn export-btn" title="Export" aria-label="Export" aria-haspopup="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/>
                      </svg>
                    </button>
                    <div class="export-menu-items">
                      <button class="export-option" data-format="pdf">Export PDF</button>
                      <button class="export-option" data-format="markdown">Export Markdown</button>
                      <button class="export-option" data-format="docx">Export DOCX</button>
                    </div>
                  </div>
                </div>
                <div class="chat-sources-summary"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="chat-message chat-message-user">
        <div class="chat-bubble">${escapeHtml(msg.content)}</div>
      </div>
    `;
  }).join('');
}

function postProcessMessages(root) {
  const scope = root || document;

  scope.querySelectorAll('.chat-message-assistant .chat-content').forEach(contentEl => {
    try {
      const sources = JSON.parse(contentEl.dataset.sources || '[]');
      if (sources.length > 0 && typeof makeSourceReferencesClickable === 'function') {
        makeSourceReferencesClickable(contentEl, sources);

        if (typeof createSourcesIndicator === 'function') {
          const indicator = createSourcesIndicator(sources, contentEl);
          if (indicator) {
            contentEl.appendChild(indicator);
          }
        }
      }

      const messageDiv = contentEl.closest('.chat-message-assistant');
      if (messageDiv) {
        renderChatSourcesSummary(messageDiv, sources);
      }
    } catch (e) {
      console.error('Error processing sources:', e);
    }
  });

  scope.querySelectorAll('.chat-copy-btn').forEach(btn => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const message = btn.closest('.chat-message-assistant');
      const contentEl = message?.querySelector('.chat-content');
      const content = contentEl?.innerText || contentEl?.textContent || '';
      try {
        await navigator.clipboard.writeText(content);
        btn.classList.add('copied');
        setTimeout(() => {
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        showToast('Failed to copy', 'error');
      }
    });
  });
}

function renderChatMessages(messages, thread = null) {
  const chatMessagesEl = elements.chatMessages || document.getElementById('chat-messages');
  if (!chatMessagesEl) {
    return;
  }

  if (!messages || messages.length === 0) {
    chatMessagesEl.innerHTML = '';
    updateSpacesContextButton(thread, currentSpaceData);
    return;
  }

  const archivedMessages = thread?.archivedMessages || [];
  currentArchivedMessages = archivedMessages;
  const summaryUpdatedAt = thread?.summaryUpdatedAt || null;
  const showSummaryBadge = summaryUpdatedAt && Date.now() - summaryUpdatedAt < 30000;

  const archiveHtml = archivedMessages.length > 0
    ? `
      <div class="chat-archive-block" data-archive-open="false">
        <button class="chat-archive-toggle" type="button" aria-expanded="false">
          Earlier messages (${archivedMessages.length})
        </button>
        <div class="chat-archive-content"></div>
      </div>
    `
    : '';

  const summaryBadgeHtml = showSummaryBadge
    ? '<div class="chat-summary-badge">Summary updated</div>'
    : '';

  const messagesHtml = buildMessageHtml(messages);
  chatMessagesEl.innerHTML = `${archiveHtml}${summaryBadgeHtml}${messagesHtml}`;

  postProcessMessages(chatMessagesEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  updateSpacesContextButton(thread, currentSpaceData);
}

function toggleArchiveSection() {
  const chatMessagesEl = elements.chatMessages || document.getElementById('chat-messages');
  if (!chatMessagesEl) return;
  const archiveBlock = chatMessagesEl.querySelector('.chat-archive-block');
  if (!archiveBlock) return;
  const contentEl = archiveBlock.querySelector('.chat-archive-content');
  if (!contentEl) return;

  const isOpen = archiveBlock.getAttribute('data-archive-open') === 'true';
  const toggleBtn = archiveBlock.querySelector('.chat-archive-toggle');

  if (isOpen) {
    contentEl.innerHTML = '';
    archiveBlock.setAttribute('data-archive-open', 'false');
    archiveBlock.classList.remove('open');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
    return;
  }

  const archivedHtml = buildMessageHtml(currentArchivedMessages);
  contentEl.innerHTML = archivedHtml || '<div class="chat-archive-empty">No archived messages.</div>';
  archiveBlock.setAttribute('data-archive-open', 'true');
  archiveBlock.classList.add('open');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  postProcessMessages(contentEl);
}

function closeExportMenus() {
  document.querySelectorAll('.export-menu').forEach(menu => menu.classList.remove('open'));
}

function renderChatSourcesSummary(messageDiv, sources) {
  const summary = messageDiv?.querySelector('.chat-sources-summary');
  if (!summary) return;
  summary.innerHTML = '';

  if (!sources || sources.length === 0 || typeof getUniqueDomains !== 'function') {
    return;
  }

  const uniqueDomains = getUniqueDomains(sources);
  const stack = document.createElement('div');
  stack.className = 'sources-favicon-stack';

  uniqueDomains.slice(0, 5).forEach((domain, index) => {
    const favicon = document.createElement('img');
    favicon.src = domain.favicon;
    favicon.alt = domain.domain;
    favicon.style.zIndex = String(5 - index);
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" fill=\"%23888\"><circle cx=\"8\" cy=\"8\" r=\"8\"/></svg>';
    };
    stack.appendChild(favicon);
  });

  const count = document.createElement('span');
  count.className = 'sources-count';
  count.textContent = `${sources.length} source${sources.length !== 1 ? 's' : ''}`;

  summary.appendChild(stack);
  summary.appendChild(count);
}

function buildThreadHtml(messages) {
  return (messages || []).map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    const content = typeof applyMarkdownStyles === 'function'
      ? applyMarkdownStyles(msg.content || '')
      : escapeHtml(msg.content || '');
    return `<h2>${role}</h2><div>${content}</div>`;
  }).join('');
}

async function exportCurrentThread(format) {
  if (!currentThreadId) return;
  const thread = await getThread(currentThreadId);
  const messages = thread?.messages || [];

  if (format === 'markdown' && typeof exportMarkdownFile === 'function') {
    exportMarkdownFile(messages, `${thread?.title || 'thread'}.md`);
  } else if (format === 'docx' && typeof exportDocx === 'function') {
    exportDocx(messages, `${thread?.title || 'thread'}.docx`);
  } else if (format === 'pdf' && typeof exportPdf === 'function') {
    const html = buildThreadHtml(messages);
    exportPdf(html, thread?.title || 'thread');
  }
}

if (typeof window !== 'undefined' && window.__TEST__) {
  window.renderChatMessages = renderChatMessages;
  window.buildAssistantMessage = buildAssistantMessage;
  window.buildStreamMessages = buildStreamMessages;
  window.getSourcesData = getSourcesData;
  window.getLiveWindowSize = getLiveWindowSize;
  window.splitMessagesForSummary = splitMessagesForSummary;
  window.shouldSkipSummarization = shouldSkipSummarization;
  window.getSummaryMinLength = getSummaryMinLength;
  window.appendArchivedMessages = appendArchivedMessages;
  window.buildSpacesContextData = buildSpacesContextData;
  window.buildContextBadgeLabel = buildContextBadgeLabel;
  window.sanitizeFilename = sanitizeFilename;
  window.getFullThreadMessages = getFullThreadMessages;
}

async function renderStorageUsage() {
  const usage = await checkStorageUsage();

  elements.storageFill.style.width = `${Math.min(usage.percentUsed, 100)}%`;
  elements.storageText.textContent = `Using ${usage.formatted}`;

  // Update fill color based on usage
  elements.storageFill.classList.remove('warning', 'danger');
  if (usage.percentUsed >= 85) {
    elements.storageFill.classList.add('danger');
  } else if (usage.percentUsed >= 70) {
    elements.storageFill.classList.add('warning');
  }

  // Show warning banner if needed
  if (usage.percentUsed >= 95) {
    showStorageWarning('critical', 'Storage full. Delete threads to free space.');
  } else if (usage.percentUsed >= 85) {
    showStorageWarning('high', 'Storage almost full. Delete threads to continue using Spaces.');
  } else if (usage.percentUsed >= 70) {
    showStorageWarning('medium', 'Storage is filling up. Consider deleting old threads.');
  } else {
    hideStorageWarning();
  }
}

function showStorageWarning(level, message) {
  elements.storageWarning.className = `storage-warning ${level}`;
  elements.storageWarning.style.display = 'flex';
  elements.warningMessage.textContent = message;
}

function hideStorageWarning() {
  elements.storageWarning.style.display = 'none';
}

// ============ ESCAPE HTML ============

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ ACTIONS ============

async function openSpace(spaceId) {
  const space = await getSpace(spaceId);
  if (!space) {
    showToast('Space not found', 'error');
    return;
  }

  currentSpaceId = spaceId;
  currentThreadId = null;

  elements.spaceTitle.textContent = space.name;
  elements.chatEmptyState.style.display = 'flex';
  elements.chatContainer.style.display = 'none';
  updateChatModelIndicator(null);

  showView('space');
  await renderThreadList();
}

function sanitizeFilename(name) {
  return (name || 'thread').replace(/[^a-zA-Z0-9 _-]/g, '').trim().substring(0, 50) || 'thread';
}

function getFullThreadMessages(thread) {
  const archived = Array.isArray(thread.archivedMessages) ? thread.archivedMessages : [];
  const live = Array.isArray(thread.messages) ? thread.messages : [];
  return [...archived, ...live];
}

async function exportThread(threadId, format) {
  try {
    const thread = await getThread(threadId);
    if (!thread) {
      showToast('Thread not found', 'error');
      return;
    }

    const allMessages = getFullThreadMessages(thread);
    if (allMessages.length === 0) {
      showToast('Nothing to export', 'info');
      return;
    }

    const filename = sanitizeFilename(thread.title);

    if (format === 'md') {
      exportMarkdownFile(allMessages, `${filename}.md`);
      showToast('Exported as Markdown', 'success');
    } else if (format === 'docx') {
      exportDocx(allMessages, `${filename}.docx`);
      showToast('Exported as DOCX', 'success');
    } else if (format === 'pdf') {
      const html = allMessages.map(msg => {
        const role = msg.role === 'assistant' ? 'Assistant' : 'User';
        return `<h2>${role}</h2><p>${escapeHtmlForExport(msg.content || '')}</p>`;
      }).join('');
      exportPdf(html, filename);
      showToast('Exported as PDF', 'success');
    }

    // Close menus after export
    document.querySelectorAll('.menu-items').forEach(menu => {
      menu.style.display = 'none';
    });
  } catch (err) {
    console.error('Export error:', err);
    showToast('Export failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

async function openThread(threadId) {
  const thread = await getThread(threadId);
  if (!thread) {
    showToast('Thread not found', 'error');
    return;
  }

  currentThreadId = threadId;

  // Set chat toggles from space settings
  const space = await getSpace(currentSpaceId);
  if (space) {
    currentSpaceData = space;
    elements.chatWebSearch.checked = space.webSearch || false;
    elements.chatReasoning.checked = space.reasoning || false;
    updateChatModelIndicator(space);
  }

  elements.chatEmptyState.style.display = 'none';
  elements.chatContainer.style.display = 'flex';

    renderChatMessages(thread.messages, thread);
  await renderThreadList(); // Update active state
}

async function createNewThread() {
  if (!currentSpaceId) return;

  // Set chat toggles from space settings
  const space = await getSpace(currentSpaceId);
  if (space) {
    currentSpaceData = space;
    elements.chatWebSearch.checked = space.webSearch || false;
    elements.chatReasoning.checked = space.reasoning || false;
  }

  const thread = await createThread(currentSpaceId);
  await renderThreadList();
  openThread(thread.id);
  showToast('New thread created', 'success');
}

function toggleMenu(button) {
  // Close all other menus
  document.querySelectorAll('.menu-items').forEach(menu => {
    if (menu !== button.nextElementSibling) {
      menu.style.display = 'none';
    }
  });

  const menu = button.nextElementSibling;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-dropdown')) {
    document.querySelectorAll('.menu-items').forEach(menu => {
      menu.style.display = 'none';
    });
  }

  if (!e.target.closest('.export-menu')) {
    closeExportMenus();
  }
});

// ============ MODAL HANDLERS ============

function openCreateSpaceModal() {
  editingSpaceId = null;
  elements.modalTitle.textContent = 'Create Space';
  elements.modalSave.textContent = 'Create Space';
  elements.spaceForm.reset();
  // Reset icon to default
  elements.spaceIcon.value = '📁';
  elements.iconPreview.textContent = '📁';
  elements.emojiGrid.classList.remove('show');
  // Reset toggles
  elements.spaceWebSearch.checked = false;
  elements.spaceReasoning.checked = false;
  elements.spaceModal.style.display = 'flex';
  elements.spaceName.focus();
}

async function openEditSpaceModal(spaceId) {
  const space = await getSpace(spaceId);
  if (!space) return;

  editingSpaceId = spaceId;
  elements.modalTitle.textContent = 'Edit Space';
  elements.modalSave.textContent = 'Save Changes';

  elements.spaceName.value = space.name;
  elements.spaceDescription.value = space.description;
  elements.spaceIcon.value = space.icon || '📁';
  elements.iconPreview.textContent = space.icon || '📁';
    const modelProvider = normalizeProviderSafe(space.modelProvider || currentProvider);
    const combinedId = space.model ? buildCombinedModelIdSafe(modelProvider, space.model) : '';
    elements.spaceModel.value = combinedId;
    if (elements.spaceModelInput) {
      elements.spaceModelInput.value = space.model ? getSpaceModelLabel(space) : '';
    }
  elements.spaceInstructions.value = space.customInstructions;
  elements.spaceWebSearch.checked = space.webSearch || false;
  elements.spaceReasoning.checked = space.reasoning || false;
  elements.emojiGrid.classList.remove('show');

  elements.spaceModal.style.display = 'flex';
  elements.spaceName.focus();
}

function closeSpaceModal() {
  elements.spaceModal.style.display = 'none';
  editingSpaceId = null;
}

async function handleSpaceFormSubmit(e) {
  e.preventDefault();

    const combinedModelId = elements.spaceModel.value;
    const parsedModel = parseCombinedModelIdSafe(combinedModelId);
    const modelProvider = combinedModelId ? normalizeProviderSafe(parsedModel.provider) : null;
    const modelId = combinedModelId ? parsedModel.modelId : '';
    const modelDisplayName = combinedModelId
      ? (elements.spaceModelInput?.value || (typeof buildModelDisplayName === 'function'
        ? buildModelDisplayName(modelProvider, modelId)
        : modelId))
      : '';

    const data = {
      name: elements.spaceName.value.trim(),
      description: elements.spaceDescription.value.trim(),
      icon: elements.spaceIcon.value || '📁',
      model: modelId,
      modelProvider,
      modelDisplayName,
      customInstructions: elements.spaceInstructions.value.trim(),
      webSearch: elements.spaceWebSearch.checked,
      reasoning: elements.spaceReasoning.checked
    };

  if (!data.name) {
    showToast('Name is required', 'error');
    return;
  }

  try {
    if (editingSpaceId) {
      await updateSpace(editingSpaceId, data);
      showToast('Space updated', 'success');

      // Update title if viewing this space
      if (currentSpaceId === editingSpaceId) {
        elements.spaceTitle.textContent = data.name;
        updateChatModelIndicator(data);
      }
    } else {
      await createSpace(data);
      showToast('Space created', 'success');
    }

    closeSpaceModal();
    await renderSpacesList();
    await renderStorageUsage();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openRenameModal(threadId) {
  const thread = await getThread(threadId);
  if (!thread) return;

  renamingThreadId = threadId;
  elements.threadTitle.value = thread.title;
  elements.renameModal.style.display = 'flex';
  elements.threadTitle.focus();
  elements.threadTitle.select();
}

function closeRenameModal() {
  elements.renameModal.style.display = 'none';
  renamingThreadId = null;
}

async function handleRenameFormSubmit(e) {
  e.preventDefault();

  const title = elements.threadTitle.value.trim();
  if (!title) {
    showToast('Title is required', 'error');
    return;
  }

  try {
    await updateThread(renamingThreadId, { title });
    showToast('Thread renamed', 'success');
    closeRenameModal();
    await renderThreadList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openDeleteModal(type, id) {
  deletingItem = { type, id };

  if (type === 'space') {
    const space = await getSpace(id);
    const threadCount = await getThreadCount(id);
    elements.deleteTitle.textContent = 'Delete Space';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${space.name}" and all its threads?`;
    elements.deleteSize.textContent = `This will delete ${threadCount} thread${threadCount !== 1 ? 's' : ''}.`;
  } else {
    const thread = await getThread(id);
    const size = await estimateItemSize(thread);
    elements.deleteTitle.textContent = 'Delete Thread';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${thread.title}"?`;
    elements.deleteSize.textContent = `This will free ~${(size / 1024).toFixed(1)}KB.`;
  }

  elements.deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  elements.deleteModal.style.display = 'none';
  deletingItem = null;
}

async function handleDeleteConfirm() {
  if (!deletingItem) return;

  try {
    if (deletingItem.type === 'space') {
      await deleteSpace(deletingItem.id);
      showToast('Space deleted', 'success');

      if (currentSpaceId === deletingItem.id) {
        showView('list');
      }
      await renderSpacesList();
    } else {
      await deleteThread(deletingItem.id);
      showToast('Thread deleted', 'success');

      if (currentThreadId === deletingItem.id) {
        currentThreadId = null;
        elements.chatEmptyState.style.display = 'flex';
        elements.chatContainer.style.display = 'none';
      }
      await renderThreadList();
    }

    closeDeleteModal();
    await renderStorageUsage();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============ MODEL LOADING ============

async function loadModels() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_models' });
    if (response.ok && response.models) {
      spaceModelMap = new Map(response.models.map((model) => [model.id, model]));

      const [localItems, syncItems] = await Promise.all([
        chrome.storage.local.get(['or_recent_models', 'or_recent_models_naga']),
        chrome.storage.sync.get(['or_favorites', 'or_favorites_naga'])
      ]);

      spaceFavoriteModelsByProvider = {
        openrouter: new Set(syncItems.or_favorites || []),
        naga: new Set(syncItems.or_favorites_naga || [])
      };
      spaceRecentModelsByProvider = {
        openrouter: localItems.or_recent_models || [],
        naga: localItems.or_recent_models_naga || []
      };

      if (!spaceModelDropdown && elements.spaceModelInput) {
        spaceModelDropdown = new ModelDropdownManager({
          inputElement: elements.spaceModelInput,
          containerType: 'modal',
          onModelSelect: async (modelId) => {
            const selectedModel = spaceModelMap.get(modelId);
            const displayName = selectedModel ? getModelDisplayName(selectedModel) : modelId;
            if (elements.spaceModelInput) {
              elements.spaceModelInput.value = displayName;
            }
            if (elements.spaceModel) {
              elements.spaceModel.value = modelId;
            }
            return true;
          },
          onToggleFavorite: async (modelId, isFavorite) => {
            const parsed = parseCombinedModelIdSafe(modelId);
            const provider = normalizeProviderSafe(parsed.provider);
            const rawId = parsed.modelId;

            if (!spaceFavoriteModelsByProvider[provider]) {
              spaceFavoriteModelsByProvider[provider] = new Set();
            }

            if (isFavorite) {
              spaceFavoriteModelsByProvider[provider].add(rawId);
            } else {
              spaceFavoriteModelsByProvider[provider].delete(rawId);
            }

            await chrome.storage.sync.set({
              [getProviderStorageKeySafe('or_favorites', provider)]: Array.from(spaceFavoriteModelsByProvider[provider])
            });
          },
          onAddRecent: async (modelId) => {
            const parsed = parseCombinedModelIdSafe(modelId);
            const provider = normalizeProviderSafe(parsed.provider);
            const rawId = parsed.modelId;

            const current = spaceRecentModelsByProvider[provider] || [];
            const next = [rawId, ...current.filter(id => id !== rawId)].slice(0, 5);
            spaceRecentModelsByProvider[provider] = next;

            await chrome.storage.local.set({
              [getProviderStorageKeySafe('or_recent_models', provider)]: next
            });

            spaceModelDropdown.setRecentlyUsed(buildCombinedRecentList(spaceRecentModelsByProvider));
          }
        });
      }

      if (spaceModelDropdown) {
        spaceModelDropdown.setModels(response.models);
        spaceModelDropdown.setFavorites(buildCombinedFavoritesList(spaceFavoriteModelsByProvider));
        spaceModelDropdown.setRecentlyUsed(buildCombinedRecentList(spaceRecentModelsByProvider));
      }

      if (elements.spaceModel) {
        const currentCombinedId = elements.spaceModel.value || '';
        elements.spaceModel.innerHTML = '<option value="">Use default model</option>' +
          response.models.map(m =>
            `<option value="${m.id}" ${m.id === currentCombinedId ? 'selected' : ''}>${getModelDisplayName(m)}</option>`
          ).join('');
      }

      if (elements.spaceModelInput && elements.spaceModel?.value) {
        const selected = spaceModelMap.get(elements.spaceModel.value);
        if (selected) {
          elements.spaceModelInput.value = getModelDisplayName(selected);
        }
      }
    }
  } catch (err) {
    console.error('Error loading models:', err);
  }
}

// ============ EMOJI PICKER ============

function setupEmojiPicker() {
  // Populate emoji grid
  elements.emojiGridInner.innerHTML = SPACE_EMOJIS.map(emoji =>
    `<button type="button" class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`
  ).join('');

  // Toggle emoji grid on icon preview click
  elements.iconPreview.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.emojiGrid.classList.toggle('show');
  });

  // Select emoji
  elements.emojiGridInner.addEventListener('click', (e) => {
    const btn = e.target.closest('.emoji-btn');
    if (btn) {
      const emoji = btn.dataset.emoji;
      elements.spaceIcon.value = emoji;
      elements.iconPreview.textContent = emoji;
      elements.emojiGrid.classList.remove('show');
    }
  });

  // Close emoji grid when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-picker-wrapper')) {
      elements.emojiGrid.classList.remove('show');
    }
  });
}

// ============ EVENT BINDINGS ============

function bindEvents() {
  // Create space buttons
  elements.createSpaceBtn.addEventListener('click', openCreateSpaceModal);
  elements.emptyCreateBtn.addEventListener('click', openCreateSpaceModal);

  // Space modal
  elements.modalClose.addEventListener('click', closeSpaceModal);
  elements.modalCancel.addEventListener('click', closeSpaceModal);
  elements.spaceForm.addEventListener('submit', handleSpaceFormSubmit);

  // Rename modal
  elements.renameModalClose.addEventListener('click', closeRenameModal);
  elements.renameCancel.addEventListener('click', closeRenameModal);
  elements.renameForm.addEventListener('submit', handleRenameFormSubmit);

  // Delete modal
  elements.deleteModalClose.addEventListener('click', closeDeleteModal);
  elements.deleteCancel.addEventListener('click', closeDeleteModal);
  elements.deleteConfirm.addEventListener('click', handleDeleteConfirm);

  // Storage warning
  elements.warningClose.addEventListener('click', hideStorageWarning);

  // Space view
  elements.backBtn.addEventListener('click', async () => {
    showView('list');
    await renderSpacesList();
  });

  elements.spaceSettingsBtn.addEventListener('click', () => {
    if (currentSpaceId) {
      openEditSpaceModal(currentSpaceId);
    }
  });

  elements.newThreadBtn.addEventListener('click', createNewThread);

  if (elements.spacesContextBtn) {
    elements.spacesContextBtn.addEventListener('click', async () => {
      if (elements.spacesContextBtn.classList.contains('inactive')) return;
      if (!currentThreadId || !currentSpaceId) return;
      const thread = await getThread(currentThreadId);
      const space = currentSpaceData || await getSpace(currentSpaceId);
      currentSpaceData = space || currentSpaceData;
      openSpacesContextModal(thread, currentSpaceData);
    });
  }

  elements.chatMessages.addEventListener('click', async (e) => {
    const archiveToggle = e.target.closest('.chat-archive-toggle');
    if (archiveToggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleArchiveSection();
      return;
    }

    const exportBtn = e.target.closest('.export-btn');
    if (exportBtn) {
      e.preventDefault();
      e.stopPropagation();
      const menu = exportBtn.closest('.export-menu');
      if (menu) {
        const isOpen = menu.classList.contains('open');
        closeExportMenus();
        if (!isOpen) {
          menu.classList.add('open');
        }
      }
      return;
    }

    const exportOption = e.target.closest('.export-option');
    if (exportOption) {
      e.preventDefault();
      e.stopPropagation();
      const format = exportOption.getAttribute('data-format');
      await exportCurrentThread(format);
      closeExportMenus();
      return;
    }
  });

  // Close modals on backdrop click
  [elements.spaceModal, elements.renameModal, elements.deleteModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSpaceModal();
      closeRenameModal();
      closeDeleteModal();
    }
  });
}

// ============ CHAT FUNCTIONALITY ============

function buildAssistantMessage(content, meta) {
  return {
    role: 'assistant',
    content,
    meta
  };
}

function buildStreamMessages(messages, prompt, systemInstruction, summary) {
  const baseMessages = Array.isArray(messages) ? [...messages] : [];
  if (baseMessages.length > 0 && typeof prompt === 'string') {
    const lastMessage = baseMessages[baseMessages.length - 1];
    if (lastMessage?.role === 'user' && lastMessage.content === prompt) {
      baseMessages.pop();
    }
  }

  const finalMessages = [];
  if (systemInstruction) {
    const isOngoing = baseMessages.length > 0;
    const content = isOngoing
      ? `[Ongoing conversation. Follow these standing instructions without re-introducing yourself:]\n${systemInstruction}`
      : systemInstruction;
    finalMessages.push({ role: 'system', content });
  }
  if (summary) {
    finalMessages.push({ role: 'system', content: `Summary so far:\n${summary}` });
  }
  finalMessages.push(...baseMessages);
  return finalMessages;
}

function getSourcesData(content) {
  if (typeof extractSources === 'function') {
    return extractSources(content);
  }
  return { sources: [], cleanText: content };
}

function createStreamingAssistantMessage() {
  const tokenStyle = typeof getTokenBarStyle === 'function'
    ? getTokenBarStyle(null)
    : { percent: 0, gradient: 'linear-gradient(90deg, var(--color-success), #16a34a)' };

  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message chat-message-assistant';
  messageDiv.innerHTML = `
    <div class="chat-bubble-wrapper">
      <div class="chat-meta">
        <span class="chat-meta-text">Streaming...</span>
      </div>
      <div class="chat-bubble">
        <div class="chat-content">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        <div class="chat-footer">
          <div class="chat-stats">
            <span class="chat-time">--s</span>
            <span class="chat-tokens">-- tokens</span>
            <span class="chat-context-badge" style="display: none;"></span>
          </div>
          <div class="token-usage-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
            <div class="token-usage-fill" style="width: ${tokenStyle.percent}%; background: ${tokenStyle.gradient};"></div>
          </div>
        </div>
        <div class="chat-actions">
          <div class="chat-actions-left">
            <button class="action-btn chat-copy-btn" title="Copy answer" aria-label="Copy answer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </button>
            <div class="export-menu">
              <button class="action-btn export-btn" title="Export" aria-label="Export" aria-haspopup="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/>
                </svg>
              </button>
              <div class="export-menu-items">
                <button class="export-option" data-format="pdf">Export PDF</button>
                <button class="export-option" data-format="markdown">Export Markdown</button>
                <button class="export-option" data-format="docx">Export DOCX</button>
              </div>
            </div>
          </div>
          <div class="chat-sources-summary"></div>
        </div>
      </div>
    </div>
  `;

  return {
    messageDiv,
    wrapper: messageDiv.querySelector('.chat-bubble-wrapper'),
    content: messageDiv.querySelector('.chat-content'),
    metaText: messageDiv.querySelector('.chat-meta-text'),
    timeEl: messageDiv.querySelector('.chat-time'),
    tokensEl: messageDiv.querySelector('.chat-tokens'),
    contextBadgeEl: messageDiv.querySelector('.chat-context-badge'),
    tokenFillEl: messageDiv.querySelector('.token-usage-fill'),
    tokenBarEl: messageDiv.querySelector('.token-usage-bar'),
    sourcesSummaryEl: messageDiv.querySelector('.chat-sources-summary')
  };
}

function updateAssistantFooter(ui, meta) {
  if (!ui || !meta) return;

  const metaTime = meta.createdAt ? new Date(meta.createdAt).toLocaleTimeString() : '';
  const metaModel = meta.model || 'default model';
  if (ui.metaText) {
    ui.metaText.textContent = `${metaTime} - ${metaModel}`;
  }

  if (ui.timeEl) {
    ui.timeEl.textContent = typeof meta.responseTimeSec === 'number'
      ? `${meta.responseTimeSec.toFixed(2)}s`
      : '--s';
  }

  if (ui.tokensEl) {
    ui.tokensEl.textContent = meta.tokens ? `${meta.tokens} tokens` : '-- tokens';
  }

  if (ui.contextBadgeEl) {
    if (meta.contextSize > 2) {
      ui.contextBadgeEl.style.display = 'inline-flex';
      ui.contextBadgeEl.textContent = `🧠 ${Math.floor(meta.contextSize / 2)} Q&A`;
      ui.contextBadgeEl.title = `${meta.contextSize} messages in conversation context`;
    } else {
      ui.contextBadgeEl.style.display = 'none';
    }
  }

  const tokenStyle = typeof getTokenBarStyle === 'function'
    ? getTokenBarStyle(meta.tokens || null)
    : { percent: 0, gradient: 'linear-gradient(90deg, var(--color-success), #16a34a)' };

  if (ui.tokenFillEl) {
    ui.tokenFillEl.style.width = `${tokenStyle.percent}%`;
    ui.tokenFillEl.style.background = tokenStyle.gradient;
  }

  if (ui.tokenBarEl) {
    ui.tokenBarEl.setAttribute('aria-valuenow', tokenStyle.percent);
  }
}

async function sendMessage() {
  const content = elements.chatInput.value.trim();
  if (!content || !currentThreadId || !currentSpaceId || isStreaming) return;

  const space = await getSpace(currentSpaceId);
  if (!space) return;

  // Add user message to thread
  await addMessageToThread(currentThreadId, {
    role: 'user',
    content
  });

  // Clear input
  elements.chatInput.value = '';
  elements.chatInput.style.height = 'auto';

  // Re-render messages
  let thread = await getThread(currentThreadId);
  if (!thread) return;

  const liveWindowSize = getLiveWindowSize(thread.summary);
  const { historyToSummarize, liveMessages } = splitMessagesForSummary(thread.messages, liveWindowSize);
  const skipSummary = shouldSkipSummarization(content);
  if (historyToSummarize.length > 0 && !skipSummary) {
    try {
      if (typeof showToast === 'function') {
        showToast('Updating summary...', 'info');
      }
      const summaryMessages = typeof buildSummarizerMessages === 'function'
        ? buildSummarizerMessages(thread.summary, historyToSummarize)
        : historyToSummarize;
      const summaryRes = await chrome.runtime.sendMessage({
        type: 'summarize_thread',
        messages: summaryMessages,
        model: space.model || null,
        provider: space.modelProvider || currentProvider
      });
      const minSummaryLength = getSummaryMinLength(historyToSummarize.length);
      if (summaryRes?.ok && typeof summaryRes.summary === 'string' && summaryRes.summary.trim().length >= minSummaryLength) {
        thread.summary = summaryRes.summary.trim();
        thread.summaryUpdatedAt = Date.now();
        const updatedArchive = appendArchivedMessages(thread.archivedMessages, historyToSummarize);
        thread.archivedMessages = updatedArchive;
        thread.archivedUpdatedAt = Date.now();
        thread.messages = liveMessages;
        await updateThread(currentThreadId, {
          messages: liveMessages,
          summary: thread.summary,
          summaryUpdatedAt: thread.summaryUpdatedAt,
          archivedMessages: updatedArchive,
          archivedUpdatedAt: thread.archivedUpdatedAt
        });
      } else if (typeof showToast === 'function') {
        showToast('Summary update failed; continuing without it', 'error');
      }
    } catch (err) {
      console.warn('Summary update failed:', err);
      if (typeof showToast === 'function') {
        showToast('Summary update failed; continuing without it', 'error');
      }
    }
  }

    renderChatMessages(thread.messages, thread);

  const startTime = Date.now();
  const streamingUi = createStreamingAssistantMessage();
  elements.chatMessages.appendChild(streamingUi.messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // Show stop button, hide send
  elements.sendBtn.style.display = 'none';
  elements.stopBtn.style.display = 'block';
  isStreaming = true;

  // Start streaming
  try {
    await streamMessage(content, space, thread, streamingUi, startTime);
  } catch (err) {
    console.error('Stream error:', err);
    showToast(err.message || 'Failed to send message', 'error');
  } finally {
    // Restore buttons
    elements.sendBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    isStreaming = false;

    await renderThreadList();
  }
}

async function streamMessage(content, space, thread, streamingUi, startTime) {
  return new Promise((resolve, reject) => {
    // Create port for streaming
    streamPort = chrome.runtime.connect({ name: 'streaming' });

    let fullContent = '';
    const assistantBubble = streamingUi?.content || null;
    const messageDiv = streamingUi?.messageDiv || null;
    const reasoningStreamState = { inReasoning: false, carry: "" };
    let reasoningTextEl = null;

    const ensureReasoningBubble = () => {
      if (reasoningTextEl) return;
      const bubble = messageDiv?.querySelector('.chat-bubble');
      if (!bubble) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-reasoning-bubble';
      wrapper.style.marginBottom = '12px';
      wrapper.innerHTML = `
        <div style="padding: 12px; background: var(--color-bg-tertiary); border-left: 3px solid var(--color-topic-5); border-radius: 4px;">
          <div class="reasoning-header" style="font-size: 12px; font-weight: 600; color: var(--color-topic-5); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span>💭</span>
            <span>Reasoning:</span>
          </div>
          <div class="reasoning-text" style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap;"></div>
        </div>
      `;
      const contentEl = assistantBubble || bubble.querySelector('.chat-content');
      if (contentEl) {
        bubble.insertBefore(wrapper, contentEl);
      } else {
        bubble.appendChild(wrapper);
      }
      reasoningTextEl = wrapper.querySelector('.reasoning-text');
    };

    streamPort.onMessage.addListener(async (msg) => {
      if (msg.type === 'content') {
        let contentChunk = msg.content || '';
        let reasoningChunk = '';
        if (typeof extractReasoningFromStreamChunk === 'function') {
          const parsed = extractReasoningFromStreamChunk(reasoningStreamState, contentChunk);
          contentChunk = parsed.content;
          reasoningChunk = parsed.reasoning;
        }

        if (reasoningChunk) {
          ensureReasoningBubble();
          if (reasoningTextEl) {
            reasoningTextEl.textContent += reasoningChunk;
          }
        }

        if (!contentChunk) {
          return;
        }

        fullContent += contentChunk;
        if (assistantBubble) {
          assistantBubble.innerHTML = applyMarkdownStyles(fullContent);
        }
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
      } else if (msg.type === 'reasoning' && msg.reasoning) {
        ensureReasoningBubble();
        if (reasoningTextEl) {
          reasoningTextEl.textContent += msg.reasoning;
        }
      } else if (msg.type === 'complete') {
        const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : null;
        let metaModel = msg.model || 'default model';
        if (space.modelDisplayName) {
          metaModel = space.modelDisplayName;
        } else if (space.model && typeof buildModelDisplayName === 'function') {
          metaModel = buildModelDisplayName(space.modelProvider || currentProvider, space.model);
        }
        const meta = {
          model: metaModel,
          tokens: msg.tokens || null,
          responseTimeSec: typeof elapsedSec === 'number' ? Number(elapsedSec.toFixed(2)) : null,
          contextSize: msg.contextSize || 0,
          createdAt: Date.now()
        };

        // Save assistant message to thread
        await addMessageToThread(currentThreadId, buildAssistantMessage(fullContent, meta));
        const updatedThread = await getThread(currentThreadId);
        if (updatedThread) {
          updateSpacesContextButton(updatedThread, currentSpaceData);
        }

        updateAssistantFooter(streamingUi, meta);

        const { sources, cleanText } = getSourcesData(fullContent);
        if (assistantBubble) {
          assistantBubble.innerHTML = applyMarkdownStyles(cleanText);
        }

        if (sources.length > 0) {
          // Make references clickable
          if (typeof makeSourceReferencesClickable === 'function') {
            if (assistantBubble) {
              makeSourceReferencesClickable(assistantBubble, sources);
            }
          }

          // Add sources indicator
          if (typeof createSourcesIndicator === 'function') {
            const sourcesIndicator = createSourcesIndicator(sources, assistantBubble || messageDiv);
            if (sourcesIndicator && assistantBubble) {
              assistantBubble.appendChild(sourcesIndicator);
            }
          }
        }

        renderChatSourcesSummary(messageDiv, sources);

        if (typeof removeReasoningBubbles === 'function') {
          removeReasoningBubbles(messageDiv);
        }

        streamPort.disconnect();
        streamPort = null;
        resolve();
      } else if (msg.type === 'error') {
        if (assistantBubble) {
          assistantBubble.innerHTML = `<div class="error-content">${escapeHtml(msg.error)}</div>`;
        }
        if (streamingUi?.metaText) {
          streamingUi.metaText.textContent = `Error - ${new Date().toLocaleTimeString()}`;
        }
        if (typeof removeReasoningBubbles === 'function') {
          removeReasoningBubbles(messageDiv);
        }
        streamPort.disconnect();
        streamPort = null;
        reject(new Error(msg.error));
      }
    });

    streamPort.onDisconnect.addListener(() => {
      streamPort = null;
      if (isStreaming) {
        resolve(); // Might be stopped by user
      }
    });

    // Build messages array with custom instructions
    const messages = buildStreamMessages(thread.messages, content, space.customInstructions, thread.summary);

    // Use chat toggles (temporary override) instead of space settings
    const webSearch = elements.chatWebSearch.checked;
    const reasoning = elements.chatReasoning.checked;

    // Send stream request
    streamPort.postMessage({
      type: 'start_stream',
      prompt: content,
      messages: messages,
      model: space.model || null,
      provider: space.modelProvider || currentProvider,
      webSearch: webSearch,
      reasoning: reasoning,
      tabId: `space_${space.id}`
    });
  });
}

function stopStreaming() {
  if (streamPort) {
    streamPort.disconnect();
    streamPort = null;
  }
  isStreaming = false;
  elements.sendBtn.style.display = 'block';
  elements.stopBtn.style.display = 'none';
  showToast('Generation stopped', 'info');
}

// ============ CHAT INPUT HANDLERS ============

function setupChatInput() {
  // Auto-resize textarea
  elements.chatInput.addEventListener('input', () => {
    elements.chatInput.style.height = 'auto';
    elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 200) + 'px';
  });

  // Send on Enter (Shift+Enter for new line)
  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button
  elements.sendBtn.addEventListener('click', sendMessage);

  // Stop button
  elements.stopBtn.addEventListener('click', stopStreaming);
}

// ============ INITIALIZATION ============

async function init() {
  initElements();
  bindEvents();
  setupChatInput();
  setupEmojiPicker();

  // Initialize theme
  if (typeof initTheme === 'function') {
    initTheme();
  }

  // Load data
  await loadProviderSetting();
  await loadModels();
  await renderSpacesList();
  await renderStorageUsage();

  showView('list');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// ---- Provider update listener ----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'provider_settings_updated') {
    (async () => {
      await loadProviderSetting();
      await loadModels();
      if (typeof showToast === 'function') {
        const providerLabel = getProviderLabelSafe(msg.provider);
        showToast(`Provider updated. Update Space models to use ${providerLabel}.`, 'info');
      }
    })();
  }
});
