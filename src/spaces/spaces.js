// spaces.js - Spaces feature logic

// Storage keys (match constants.js)
const STORAGE_KEYS = {
  SPACES: 'or_spaces',
  THREADS: 'or_threads',
  API_KEY: 'or_api_key',
  MODEL: 'or_model'
};

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
    icon: data.icon || '📁',
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
  elements.spaceIcon = document.getElementById('space-icon');
  elements.iconPreview = document.getElementById('icon-preview');
  elements.emojiGrid = document.getElementById('emoji-grid');
  elements.emojiGridInner = document.getElementById('emoji-grid-inner');
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
    const modelName = space.model ? space.model.split('/').pop() : 'Default';
    const spaceIcon = space.icon || '📁';

    return `
      <div class="space-card" data-space-id="${space.id}">
        <div class="space-card-icon">${spaceIcon}</div>
        <div class="space-card-content">
          <div class="space-card-info">
            <h3 class="space-card-name">${escapeHtml(space.name)}</h3>
            <p class="space-card-description">${escapeHtml(space.description) || 'No description'}</p>
          </div>
          <span class="space-card-model">${escapeHtml(modelName)}</span>
          <div class="space-card-menu menu-dropdown">
            <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu(this)">&#8942;</button>
            <div class="menu-items" style="display: none;">
              <button class="menu-item" onclick="event.stopPropagation(); openEditSpaceModal('${space.id}')">Edit</button>
              <button class="menu-item danger" onclick="event.stopPropagation(); openDeleteModal('space', '${space.id}')">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }));

  elements.spacesGrid.innerHTML = cardsHtml.join('');

  // Add click handlers - but not on menu elements
  document.querySelectorAll('.space-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on menu or its children
      if (e.target.closest('.menu-dropdown')) {
        return;
      }
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

  // Add click handlers - but not on menu elements
  document.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't navigate if clicking on menu or its children
      if (e.target.closest('.menu-dropdown')) {
        return;
      }
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

  showView('space');
  await renderThreadList();
}

async function openThread(threadId) {
  const thread = await getThread(threadId);
  if (!thread) {
    showToast('Thread not found', 'error');
    return;
  }

  currentThreadId = threadId;

  elements.chatEmptyState.style.display = 'none';
  elements.chatContainer.style.display = 'flex';

  renderChatMessages(thread.messages);
  await renderThreadList(); // Update active state
}

async function createNewThread() {
  if (!currentSpaceId) return;

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
  elements.spaceModel.value = space.model;
  elements.spaceInstructions.value = space.customInstructions;
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

  const data = {
    name: elements.spaceName.value.trim(),
    description: elements.spaceDescription.value.trim(),
    icon: elements.spaceIcon.value || '📁',
    model: elements.spaceModel.value,
    customInstructions: elements.spaceInstructions.value.trim()
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
      const currentModel = (await chrome.storage.local.get([STORAGE_KEYS.MODEL]))[STORAGE_KEYS.MODEL] || '';

      elements.spaceModel.innerHTML = '<option value="">Use default model</option>' +
        response.models.map(m =>
          `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${m.name}</option>`
        ).join('');
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
  const thread = await getThread(currentThreadId);
  renderChatMessages(thread.messages);

  // Show typing indicator
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'chat-message chat-message-assistant';
  typingIndicator.id = 'typing-indicator';
  typingIndicator.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  elements.chatMessages.appendChild(typingIndicator);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // Show stop button, hide send
  elements.sendBtn.style.display = 'none';
  elements.stopBtn.style.display = 'block';
  isStreaming = true;

  // Start streaming
  try {
    await streamMessage(content, space, thread);
  } catch (err) {
    console.error('Stream error:', err);
    showToast(err.message || 'Failed to send message', 'error');
  } finally {
    // Remove typing indicator
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();

    // Restore buttons
    elements.sendBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    isStreaming = false;

    await renderThreadList();
  }
}

async function streamMessage(content, space, thread) {
  return new Promise((resolve, reject) => {
    // Create port for streaming
    streamPort = chrome.runtime.connect({ name: 'streaming' });

    let fullContent = '';
    let assistantBubble = null;

    // Remove typing indicator and add empty assistant message
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message chat-message-assistant';
    messageDiv.innerHTML = '<div class="chat-bubble"></div>';
    assistantBubble = messageDiv.querySelector('.chat-bubble');
    elements.chatMessages.appendChild(messageDiv);

    streamPort.onMessage.addListener(async (msg) => {
      if (msg.type === 'content') {
        fullContent += msg.content;
        assistantBubble.innerHTML = applyMarkdownStyles(fullContent);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
      } else if (msg.type === 'complete') {
        // Save assistant message to thread
        await addMessageToThread(currentThreadId, {
          role: 'assistant',
          content: fullContent
        });

        streamPort.disconnect();
        streamPort = null;
        resolve();
      } else if (msg.type === 'error') {
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
    const messages = [];
    if (space.customInstructions) {
      messages.push({ role: 'system', content: space.customInstructions });
    }
    messages.push(...thread.messages);

    // Send stream request
    streamPort.postMessage({
      type: 'start_stream',
      prompt: content,
      messages: messages,
      model: space.model || null,
      webSearch: false,
      reasoning: false,
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
  await loadModels();
  await renderSpacesList();
  await renderStorageUsage();

  showView('list');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// Expose functions globally for onclick handlers in dynamic HTML
window.toggleMenu = toggleMenu;
window.openEditSpaceModal = openEditSpaceModal;
window.openDeleteModal = openDeleteModal;
window.openRenameModal = openRenameModal;
