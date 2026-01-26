// spaces.js - Spaces feature logic

// Storage keys (match constants.js)
const STORAGE_KEYS = {
  SPACES: 'or_spaces',
  THREADS: 'or_threads',
  API_KEY: 'or_api_key',
  MODEL: 'or_model'
};

const MAX_STORAGE_BYTES = 10485760; // 10MB

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
    model: data.model || '',
    customInstructions: data.customInstructions || '',
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
let isStreaming = false;
let streamPort = null;
let editingSpaceId = null;
let renamingThreadId = null;
let deletingItem = null; // { type: 'space'|'thread', id: string }

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

  // Space modal
  elements.spaceModal = document.getElementById('space-modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalClose = document.getElementById('modal-close');
  elements.spaceForm = document.getElementById('space-form');
  elements.spaceName = document.getElementById('space-name');
  elements.spaceDescription = document.getElementById('space-description');
  elements.spaceModel = document.getElementById('space-model');
  elements.spaceInstructions = document.getElementById('space-instructions');
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
    const threadCount = await getThreadCount(space.id);
    const modelName = space.model ? space.model.split('/').pop() : 'Default model';

    return `
      <div class="space-card" data-space-id="${space.id}">
        <div class="space-card-header">
          <h3 class="space-card-name">${escapeHtml(space.name)}</h3>
          <div class="space-card-menu menu-dropdown">
            <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu(this)">&#8942;</button>
            <div class="menu-items" style="display: none;">
              <button class="menu-item" onclick="event.stopPropagation(); openEditSpaceModal('${space.id}')">Edit</button>
              <button class="menu-item danger" onclick="event.stopPropagation(); openDeleteModal('space', '${space.id}')">Delete</button>
            </div>
          </div>
        </div>
        <p class="space-card-description">${escapeHtml(space.description) || 'No description'}</p>
        <div class="space-card-footer">
          <span class="space-card-model">🤖 ${escapeHtml(modelName)}</span>
          <span class="space-card-threads">${threadCount} thread${threadCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  }));

  elements.spacesGrid.innerHTML = cardsHtml.join('');

  // Add click handlers
  document.querySelectorAll('.space-card').forEach(card => {
    card.addEventListener('click', () => {
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
        <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu(this)">&#8942;</button>
        <div class="menu-items" style="display: none;">
          <button class="menu-item" onclick="event.stopPropagation(); openRenameModal('${thread.id}')">Rename</button>
          <button class="menu-item danger" onclick="event.stopPropagation(); openDeleteModal('thread', '${thread.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', () => {
      const threadId = item.dataset.threadId;
      openThread(threadId);
    });
  });
}

function renderChatMessages(messages) {
  if (!messages || messages.length === 0) {
    elements.chatMessages.innerHTML = '';
    return;
  }

  elements.chatMessages.innerHTML = messages.map(msg => `
    <div class="chat-message chat-message-${msg.role}">
      <div class="chat-bubble">${msg.role === 'assistant' ? applyMarkdownStyles(msg.content) : escapeHtml(msg.content)}</div>
    </div>
  `).join('');

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
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
