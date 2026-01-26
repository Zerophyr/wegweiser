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
