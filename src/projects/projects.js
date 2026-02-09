// projects.js - Projects feature logic

// Storage keys (match constants.js)
const STORAGE_KEYS = {
  PROJECTS: 'or_projects',
  PROJECT_THREADS: 'or_project_threads',
  API_KEY: 'or_api_key',
  MODEL: 'or_model',
  MODEL_PROVIDER: 'or_model_provider',
  IMAGE_CACHE_LIMIT_MB: 'or_image_cache_limit_mb'
};

// Provider state
let currentProvider = 'openrouter';
let lastStreamContext = null;
let retryInProgress = false;
const MAX_CONTEXT_MESSAGES = 16;
const IMAGE_CACHE_LIMIT_DEFAULT = 512;
const IMAGE_CACHE_LIMIT_MIN = 128;
const IMAGE_CACHE_LIMIT_MAX = 2048;
const IMAGE_CACHE_LIMIT_STEP = 64;

const getLocalStorage = (keys) => (
  typeof window.getEncrypted === "function"
    ? window.getEncrypted(keys)
    : chrome.storage.local.get(keys)
);
const setLocalStorage = (values) => (
  typeof window.setEncrypted === "function"
    ? window.setEncrypted(values)
    : chrome.storage.local.set(values)
);
// encrypted-storage

const migrationPromise = (typeof window.migrateLegacySpaceKeys === "function")
  ? window.migrateLegacySpaceKeys().catch((err) => {
    console.warn("Projects migration failed:", err);
  })
  : Promise.resolve();

const chatStore = (typeof window !== "undefined" && window.chatStore) ? window.chatStore : null;
const chatMigrationPromise = (typeof window !== "undefined" && typeof window.migrateLegacyChatToIdb === "function")
  ? window.migrateLegacyChatToIdb().catch((err) => {
    console.warn("Chat migration failed:", err);
  })
  : Promise.resolve();

function normalizeImageCacheLimitMb(value) {
  if (!Number.isFinite(value)) return IMAGE_CACHE_LIMIT_DEFAULT;
  const clamped = Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, value));
  const snapped = Math.round(clamped / IMAGE_CACHE_LIMIT_STEP) * IMAGE_CACHE_LIMIT_STEP;
  return Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, snapped));
}

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

function getProjectModelLabel(Project) {
  if (!Project || !Project.model) return 'Default';
  if (Project.modelDisplayName) return Project.modelDisplayName;
  if (typeof buildModelDisplayName === 'function') {
    return buildModelDisplayName(Project.modelProvider || 'openrouter', Project.model);
  }
  return Project.model.split('/').pop() || Project.model;
}

function updateChatModelIndicator(Project) {
  if (!elements.chatModelIndicator) return;
  if (!Project) {
    elements.chatModelIndicator.textContent = '';
    return;
  }
  if (typeof formatThreadModelLabel === 'function') {
    elements.chatModelIndicator.textContent = formatThreadModelLabel({
      model: Project.model || '',
      modelDisplayName: Project.modelDisplayName || ''
    });
    return;
  }
  elements.chatModelIndicator.textContent = `Model: ${getProjectModelLabel(Project)}`;
}

function getProjectModelRecord(Project) {
  if (!Project?.model) return null;
  const provider = normalizeProviderSafe(Project.modelProvider || currentProvider);
  const combinedId = buildCombinedModelIdSafe(provider, Project.model);
  return ProjectModelMap.get(combinedId) || null;
}

function isImageOnlyModel(model) {
  return Boolean(model?.isImageOnly);
}

function setChatImageToggleState(enabled, disabled = true) {
  if (!elements.chatImageMode) return;
  elements.chatImageMode.checked = enabled;
  elements.chatImageMode.disabled = disabled;
  const label = elements.chatImageMode.closest('.chat-toggle');
  if (label) {
    label.classList.toggle('disabled', disabled);
    label.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
}

function applyProjectImageMode(Project) {
  const model = getProjectModelRecord(Project);
  const enableImage = isImageOnlyModel(model);
  imageModeEnabled = enableImage;
  setChatImageToggleState(enableImage, true);
}

async function loadProviderSetting() {
  try {
    const stored = await getLocalStorage(['or_provider', 'or_model_provider']);
    currentProvider = normalizeProviderSafe(stored.or_model_provider || stored.or_provider);
  } catch (e) {
    console.warn('Failed to load provider setting:', e);
  }
}

const MAX_STORAGE_BYTES = 10485760; // 10MB

// Common emojis for Project icons
const Project_EMOJIS = [
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

function buildProjectsContextData(thread) {
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

function getContextUsageCount(thread, Project) {
  const data = buildProjectsContextData(thread);
  let count = data.liveMessages.length;
  if (data.summary) {
    count += 1;
  }
  if (Project?.customInstructions && Project.customInstructions.trim().length) {
    count += 1;
  }
  return count;
}

function updateProjectsContextButton(thread, Project) {
  if (!elements.ProjectsContextBtn) return;
  const badgeEl = elements.ProjectsContextBadge;
  if (!thread) {
    elements.ProjectsContextBtn.classList.add('inactive');
    elements.ProjectsContextBtn.setAttribute('aria-disabled', 'true');
    if (badgeEl) {
      badgeEl.style.display = 'none';
      badgeEl.textContent = '';
    }
    return;
  }

  const data = buildProjectsContextData(thread);
  const label = buildContextBadgeLabel(data.liveMessages.length);
  const isActive = Boolean(label);
  elements.ProjectsContextBtn.classList.toggle('inactive', !isActive);
  elements.ProjectsContextBtn.setAttribute('aria-disabled', isActive ? 'false' : 'true');

  if (badgeEl) {
    if (isActive) {
      badgeEl.textContent = label;
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
      badgeEl.textContent = '';
    }
  }

  const usedCount = getContextUsageCount(thread, Project);
  const remaining = Math.max(MAX_CONTEXT_MESSAGES - usedCount, 0);
  elements.ProjectsContextBtn.title = isActive
    ? `${usedCount} messages in context · ${remaining} remaining`
    : 'No conversation context yet';
}

function buildContextMessageHtml(messages) {
  return (messages || []).map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'User';
    const roleClass = msg.role === 'assistant' ? 'assistant' : '';
    const preview = truncateText(msg.content || '', 160);
    return `
      <div class="projects-context-item">
        <div class="projects-context-role ${roleClass}">${escapeHtml(role)}</div>
        <div class="projects-context-text">${escapeHtml(preview)}</div>
      </div>
    `;
  }).join('');
}

function openProjectsContextModal(thread, Project) {
  if (!thread) return;
  const data = buildProjectsContextData(thread);
  const usedCount = getContextUsageCount(thread, Project);
  const remaining = Math.max(MAX_CONTEXT_MESSAGES - usedCount, 0);
  const fillPercentage = Math.min((usedCount / MAX_CONTEXT_MESSAGES) * 100, 100);
  const isNearLimit = fillPercentage > 75;

  const overlay = document.createElement('div');
  overlay.className = 'projects-context-overlay';

  const modal = document.createElement('div');
  modal.className = 'projects-context-modal';

  modal.innerHTML = `
    <div class="projects-context-header">
      <h3><span>🧠</span><span>Conversation Context</span></h3>
      <button class="projects-context-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="projects-context-body">
      ${data.summary ? `
        <div class="projects-context-section">
          <h4>Summary</h4>
          <div class="projects-context-text">${escapeHtml(data.summary)}</div>
        </div>
      ` : ''}
      <div class="projects-context-section">
        <h4>Live Messages (${data.liveMessages.length})</h4>
        ${data.liveMessages.length ? buildContextMessageHtml(data.liveMessages) : '<div class="projects-context-text">No live messages yet.</div>'}
      </div>
      ${data.archivedMessages.length ? `
        <div class="projects-context-section">
          <button class="projects-context-archive-toggle" type="button">
            <span>Archived messages (${data.archivedMessages.length})</span>
            <span>+</span>
          </button>
          <div class="projects-context-archive-content">
            ${buildContextMessageHtml(data.archivedMessages)}
          </div>
        </div>
      ` : ''}
      ${Project?.customInstructions && Project.customInstructions.trim().length ? `
        <div class="projects-context-section">
          <h4>Custom Instructions</h4>
          <div class="projects-context-text">${escapeHtml(truncateText(Project.customInstructions, 220))}</div>
        </div>
      ` : ''}
    </div>
    <div class="projects-context-footer">
      <div class="projects-context-text">${usedCount}/${MAX_CONTEXT_MESSAGES} messages in context · ${remaining} remaining</div>
      <div class="projects-context-bar">
        <div class="projects-context-bar-fill" style="width: ${fillPercentage}%; background: ${isNearLimit ? 'var(--color-warning)' : 'var(--color-success)'};"></div>
      </div>
      ${isNearLimit ? '<div class="projects-context-warning">⚠️ Context is nearing capacity.</div>' : ''}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('.projects-context-close');
  closeBtn?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const archiveToggle = modal.querySelector('.projects-context-archive-toggle');
  const archiveContent = modal.querySelector('.projects-context-archive-content');
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

function normalizeThreadProjectId(thread) {
  if (!thread || typeof thread !== 'object') return thread;
  const projectId = thread.projectId || thread.ProjectId || thread.spaceId || null;
  const normalized = { ...thread, projectId };
  delete normalized.ProjectId;
  delete normalized.spaceId;
  return normalized;
}

function ensureThreadMessage(message, threadId, index, baseTime) {
  const createdAt = message.createdAt || message.meta?.createdAt || (baseTime + index);
  const id = message.id || `${threadId}_msg_${index}`;
  return {
    ...message,
    id,
    threadId,
    createdAt
  };
}

async function persistThreadToChatStore(thread) {
  if (!chatStore || typeof chatStore.putThread !== 'function') return;
  if (!thread || !thread.id) return;

  const normalized = normalizeThreadProjectId(thread);
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const archivedMessages = Array.isArray(thread.archivedMessages) ? thread.archivedMessages : [];
  const summary = typeof thread.summary === 'string' ? thread.summary : '';
  const summaryUpdatedAt = thread.summaryUpdatedAt || null;
  const archivedUpdatedAt = thread.archivedUpdatedAt || null;
  const baseTime = normalized.updatedAt || normalized.createdAt || Date.now();

  const threadRecord = { ...normalized };
  delete threadRecord.messages;
  delete threadRecord.summary;
  delete threadRecord.summaryUpdatedAt;
  delete threadRecord.archivedMessages;
  delete threadRecord.archivedUpdatedAt;

  if (typeof chatStore.deleteThread === 'function') {
    await chatStore.deleteThread(threadRecord.id);
  }

  await chatStore.putThread(threadRecord);

  for (let i = 0; i < messages.length; i += 1) {
    await chatStore.putMessage(ensureThreadMessage(messages[i], threadRecord.id, i, baseTime));
  }

  if (typeof chatStore.setSummary === 'function' && (summary || summaryUpdatedAt)) {
    await chatStore.setSummary(threadRecord.id, summary, summaryUpdatedAt);
  }

  if (typeof chatStore.setArchivedMessages === 'function' && (archivedMessages.length || archivedUpdatedAt)) {
    const archivedWithIds = archivedMessages.map((msg, index) => (
      ensureThreadMessage(msg, threadRecord.id, index, baseTime)
    ));
    await chatStore.setArchivedMessages(threadRecord.id, archivedWithIds, archivedUpdatedAt);
  }
}

async function loadProjects() {
  try {
    if (chatStore && typeof chatStore.getProjects === 'function') {
      return await chatStore.getProjects();
    }
    const result = await getLocalStorage([STORAGE_KEYS.PROJECTS]);
    return result[STORAGE_KEYS.PROJECTS] || [];
  } catch (e) {
    console.error('Error loading Projects:', e);
    return [];
  }
}

async function saveProjects(projects) {
  if (chatStore && typeof chatStore.putProject === 'function') {
    const existing = (typeof chatStore.getProjects === 'function')
      ? await chatStore.getProjects()
      : [];
    const nextIds = new Set((projects || []).map((project) => project.id));
    for (const project of (projects || [])) {
      if (project && project.id) {
        await chatStore.putProject(project);
      }
    }
    if (typeof chatStore.deleteProject === 'function') {
      for (const project of existing || []) {
        if (project?.id && !nextIds.has(project.id)) {
          await chatStore.deleteProject(project.id);
        }
      }
    }
    return;
  }
  await setLocalStorage({ [STORAGE_KEYS.PROJECTS]: projects });
}

async function loadThreads(projectId = null) {
  try {
    if (chatStore && typeof chatStore.getThreads === 'function') {
      const rawThreads = projectId && typeof chatStore.getThreadsByProject === 'function'
        ? await chatStore.getThreadsByProject(projectId)
        : await chatStore.getThreads();
      const filteredThreads = (rawThreads || []).filter((thread) => thread?.projectId !== '__sidepanel__');
      const hydrated = [];
      for (const thread of filteredThreads) {
        const messages = await chatStore.getMessages?.(thread.id) || [];
        const summaryData = await chatStore.getSummary?.(thread.id);
        const archivedData = await chatStore.getArchivedMessages?.(thread.id);
        hydrated.push({
          ...thread,
          projectId: thread.projectId || projectId || null,
          messages,
          summary: summaryData?.summary || '',
          summaryUpdatedAt: summaryData?.summaryUpdatedAt || null,
          archivedMessages: archivedData?.archivedMessages || [],
          archivedUpdatedAt: archivedData?.archivedUpdatedAt || null
        });
      }
      return hydrated;
    }

    const result = await getLocalStorage([STORAGE_KEYS.PROJECT_THREADS]);
    const rawThreads = result[STORAGE_KEYS.PROJECT_THREADS];
    let threads = [];
    let normalized = false;

    if (Array.isArray(rawThreads)) {
      threads = rawThreads;
    } else if (rawThreads && typeof rawThreads === 'object') {
      Object.entries(rawThreads).forEach(([key, value]) => {
        if (!Array.isArray(value)) return;
        value.forEach((thread) => {
          if (!thread || typeof thread !== 'object') return;
          const normalizedThread = { ...thread };
          if (normalizedThread.projectId === undefined) {
            normalizedThread.projectId = normalizedThread.ProjectId || key;
          }
          delete normalizedThread.ProjectId;
          threads.push(normalizedThread);
          normalized = true;
        });
      });
    } else {
      threads = [];
    }

    threads.forEach((thread) => {
      if (!thread) return;
      if (thread.projectId === undefined && thread.ProjectId !== undefined) {
        thread.projectId = thread.ProjectId;
        delete thread.ProjectId;
        normalized = true;
        return;
      }
      if (thread.ProjectId !== undefined) {
        delete thread.ProjectId;
        normalized = true;
      }
    });

    if (normalized) {
      await saveThreads(threads);
    }

    if (projectId) {
      return threads.filter(t => t.projectId === projectId);
    }
    return threads;
  } catch (e) {
    console.error('Error loading threads:', e);
    return [];
  }
}

async function saveThreads(threads) {
  if (chatStore && typeof chatStore.putThread === 'function') {
    const existing = (typeof chatStore.getThreads === 'function')
      ? await chatStore.getThreads()
      : [];
    const nextIds = new Set((threads || []).map((thread) => thread.id));
    if (typeof chatStore.deleteThread === 'function') {
      for (const thread of existing || []) {
        if (thread?.id && !nextIds.has(thread.id)) {
          await chatStore.deleteThread(thread.id);
        }
      }
    }
    for (const thread of (threads || [])) {
      await persistThreadToChatStore(thread);
    }
    return;
  }
  await setLocalStorage({ [STORAGE_KEYS.PROJECT_THREADS]: threads });
}

async function getThreadCount(projectId) {
  const threads = await loadThreads(projectId);
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

function formatBytes(bytes) {
  const safeBytes = Number.isFinite(bytes) ? bytes : 0;
  return `${(safeBytes / 1024 / 1024).toFixed(1)}MB`;
}

function buildStorageLabel(label, bytesUsed, maxBytes = null) {
  if (typeof maxBytes === 'number' && maxBytes > 0) {
    return `${label}: ${formatBytes(bytesUsed)} of ${formatBytes(maxBytes)}`;
  }
  return `${label}: ${formatBytes(bytesUsed)}`;
}

async function getIndexedDbStorageUsage() {
  let imageBytes = 0;
  let chatBytes = 0;
  let quotaBytes = null;
  let percentUsed = null;

  if (typeof getImageStoreStats === 'function') {
    const imageStats = await getImageStoreStats();
    if (typeof imageStats?.bytesUsed === 'number') {
      imageBytes = imageStats.bytesUsed;
    }
  }

  if (typeof getChatStoreStats === 'function') {
    const chatStats = await getChatStoreStats();
    if (typeof chatStats?.bytesUsed === 'number') {
      chatBytes = chatStats.bytesUsed;
    }
  } else if (window?.chatStore?.getStats) {
    const chatStats = await window.chatStore.getStats();
    if (typeof chatStats?.bytesUsed === 'number') {
      chatBytes = chatStats.bytesUsed;
    }
  }

  const bytesUsed = imageBytes + chatBytes;

  if (navigator?.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate?.quota === 'number') {
        quotaBytes = estimate.quota;
        if (quotaBytes > 0) {
          percentUsed = (bytesUsed / quotaBytes) * 100;
        }
      }
    } catch (e) {
      console.warn('Failed to estimate storage quota:', e);
    }
  }

  return {
    bytesUsed,
    percentUsed,
    quotaBytes
  };
}

async function estimateItemSize(item) {
  const json = JSON.stringify(item);
  return new Blob([json]).size;
}

// ============ Project CRUD ============

async function createProject(data) {
  const Projects = await loadProjects();
  const Project = {
    id: generateId('project'),
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
  Projects.push(Project);
  await saveProjects(Projects);
  return Project;
}

async function updateProject(id, data) {
  const Projects = await loadProjects();
  const index = Projects.findIndex(s => s.id === id);
  if (index === -1) throw new Error('Project not found');

  Projects[index] = {
    ...Projects[index],
    ...data,
    updatedAt: Date.now()
  };
  await saveProjects(Projects);
  return Projects[index];
}

async function deleteProject(id) {
  const Projects = await loadProjects();
  const filtered = Projects.filter(s => s.id !== id);
  await saveProjects(filtered);

  // Also delete all threads in this Project
  const threads = await loadThreads();
  const filteredThreads = threads.filter(t => t.projectId !== id);
  await saveThreads(filteredThreads);
}

async function getProject(id) {
  const Projects = await loadProjects();
  return Projects.find(s => s.id === id);
}

// ============ THREAD CRUD ============

async function createThread(projectId, title = 'New Thread') {
  const threads = await loadThreads();
  const thread = {
    id: generateId('thread'),
    projectId,
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

let currentProjectId = null;
let currentThreadId = null;
let currentProjectData = null;
let isStreaming = false;
let imageModeEnabled = false;
let streamPort = null;
let editingProjectId = null;
let renamingThreadId = null;
let deletingItem = null; // { type: 'Project'|'thread', id: string }
let ProjectModelDropdown = null;
let ProjectModelMap = new Map();
let ProjectFavoriteModelsByProvider = {
  openrouter: new Set(),
  naga: new Set()
};
let ProjectRecentModelsByProvider = {
  openrouter: [],
  naga: []
};

// ============ DOM ELEMENTS ============

const elements = {};

function initElements() {
  // Views
  elements.ProjectsListView = document.getElementById('projects-list-view');
  elements.ProjectView = document.getElementById('project-view');

  // Projects list
  elements.ProjectsGrid = document.getElementById('projects-grid');
  elements.emptyState = document.getElementById('empty-state');
  elements.createProjectBtn = document.getElementById('create-project-btn');
  elements.ProjectsSettingsBtn = document.getElementById('projects-settings-btn');
  elements.emptyCreateBtn = document.getElementById('empty-create-btn');
  elements.storageFooter = document.getElementById('storage-footer');
  elements.storageFillImages = document.getElementById('storage-fill-images');
  elements.storageTextImages = document.getElementById('storage-text-images');
  elements.storageWarning = document.getElementById('storage-warning');
  elements.warningMessage = document.getElementById('warning-message');
  elements.warningClose = document.getElementById('warning-close');

  // Project view
  elements.backBtn = document.getElementById('back-btn');
  elements.ProjectTitle = document.getElementById('project-title');
  elements.ProjectSettingsBtn = document.getElementById('project-settings-btn');
  elements.newThreadBtn = document.getElementById('new-thread-btn');
  elements.threadList = document.getElementById('thread-list');
  elements.chatEmptyState = document.getElementById('chat-empty-state');
  elements.chatContainer = document.getElementById('chat-container');
  elements.chatMessages = document.getElementById('chat-messages');
  elements.chatInput = document.getElementById('chat-input');
  elements.sendBtn = document.getElementById('send-btn');
  elements.stopBtn = document.getElementById('stop-btn');
  elements.chatModelIndicator = document.getElementById('chat-model-indicator');
  elements.ProjectsContextBtn = document.getElementById('projects-context-btn');
  elements.ProjectsContextBadge = document.querySelector('.projects-context-badge');
  elements.chatWebSearch = document.getElementById('chat-web-search');
  elements.chatReasoning = document.getElementById('chat-reasoning');
  elements.chatImageMode = document.getElementById('chat-image-mode');

  // Project modal
  elements.ProjectModal = document.getElementById('project-modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalClose = document.getElementById('modal-close');
  elements.ProjectForm = document.getElementById('project-form');
  elements.ProjectName = document.getElementById('project-name');
  elements.ProjectDescription = document.getElementById('project-description');
  elements.ProjectModel = document.getElementById('project-model');
  elements.ProjectModelInput = document.getElementById('project-model-input');
  elements.ProjectInstructions = document.getElementById('project-instructions');
  elements.ProjectIcon = document.getElementById('project-icon');
  elements.iconPreview = document.getElementById('icon-preview');
  elements.emojiGrid = document.getElementById('emoji-grid');
  elements.emojiGridInner = document.getElementById('emoji-grid-inner');
  elements.ProjectWebSearch = document.getElementById('project-web-search');
  elements.ProjectReasoning = document.getElementById('project-reasoning');
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
    elements.ProjectsListView.classList.add('active');
    currentProjectId = null;
    currentThreadId = null;
    currentProjectData = null;
    updateProjectsContextButton(null, null);
  } else if (viewName === 'Project') {
    elements.ProjectView.classList.add('active');
  }
}

// ============ RENDERING ============

async function renderProjectsList() {
  const Projects = await loadProjects();

  if (Projects.length === 0) {
    elements.ProjectsGrid.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    return;
  }

  elements.ProjectsGrid.style.display = 'grid';
  elements.emptyState.style.display = 'none';

  // Sort by updatedAt descending
  Projects.sort((a, b) => b.updatedAt - a.updatedAt);

  const cardsHtml = await Promise.all(Projects.map(async Project => {
    const modelName = getProjectModelLabel(Project);
    const ProjectIcon = Project.icon || '📁';
    const dateStr = formatDate(Project.updatedAt);

    return `
      <div class="project-card" data-project-id="${Project.id}">
        <div class="project-card-icon">${ProjectIcon}</div>
        <div class="project-card-menu menu-dropdown">
          <button class="menu-btn" data-action="toggle-menu">&#8942;</button>
          <div class="menu-items" style="display: none;">
            <button class="menu-item" data-action="edit" data-project-id="${Project.id}">Edit</button>
            <button class="menu-item danger" data-action="delete" data-project-id="${Project.id}">Delete</button>
          </div>
        </div>
        <div class="project-card-content">
          <div class="project-card-info">
            <h3 class="project-card-name">${escapeHtml(Project.name)}</h3>
          </div>
          <div class="project-card-footer">
            <span class="project-card-date">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
              ${dateStr}
            </span>
            <span class="project-card-model">${escapeHtml(modelName)}</span>
          </div>
        </div>
      </div>
    `;
  }));

  elements.ProjectsGrid.innerHTML = cardsHtml.join('');

  // Add click handlers using event delegation
  document.querySelectorAll('.project-card').forEach(card => {
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
        const projectId = target.closest('[data-action="edit"]').dataset.projectId;
        openEditProjectModal(projectId);
        return;
      }

      // Handle delete click
      if (target.closest('[data-action="delete"]')) {
        e.stopPropagation();
        const projectId = target.closest('[data-action="delete"]').dataset.projectId;
        openDeleteModal('Project', projectId);
        return;
      }

      // Don't navigate if clicking on menu dropdown area
      if (target.closest('.menu-dropdown')) {
        return;
      }

      // Navigate to Project
      const projectId = card.dataset.projectId;
      openProject(projectId);
    });
  });
}

async function renderThreadList() {
  if (!currentProjectId) return;

  const threads = await loadThreads(currentProjectId);

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
      if (msg.meta?.imageId) {
        const meta = msg.meta || null;
        const metaTime = meta?.createdAt ? new Date(meta.createdAt).toLocaleTimeString() : '';
        const metaModel = meta?.model || 'default model';
        const metaText = meta ? `${metaTime} - ${metaModel}` : '';
        const metaHtml = meta
          ? `<div class="chat-meta"><span class="chat-meta-text">${escapeHtml(metaText)}</span></div>`
          : '';

        return `
          <div class="chat-message chat-message-assistant image-message" data-image-id="${escapeHtml(msg.meta.imageId)}" data-msg-index="${index}">
            <div class="chat-bubble-wrapper">
              ${metaHtml}
              <div class="chat-bubble">
                <div class="chat-content"></div>
              </div>
            </div>
          </div>
        `;
      }

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
    updateProjectsContextButton(thread, currentProjectData);
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
  hydrateImageCards(chatMessagesEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  updateProjectsContextButton(thread, currentProjectData);
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
  window.formatBytes = formatBytes;
  window.buildStorageLabel = buildStorageLabel;
  window.appendArchivedMessages = appendArchivedMessages;
  window.buildProjectsContextData = buildProjectsContextData;
  window.buildContextBadgeLabel = buildContextBadgeLabel;
  window.sanitizeFilename = sanitizeFilename;
  window.getFullThreadMessages = getFullThreadMessages;
  window.openImageLightbox = openImageLightbox;
  window.loadThreads = loadThreads;
}

async function renderStorageUsage() {
  if (!elements.storageFillImages || !elements.storageTextImages) {
    return;
  }

  if (!renderStorageUsage._lastUpdate) {
    renderStorageUsage._lastUpdate = 0;
    renderStorageUsage._cachedUsage = null;
    renderStorageUsage._inflight = null;
  }

  const now = Date.now();
  const maxAgeMs = 30_000;
  const hasFreshCache = renderStorageUsage._cachedUsage && (now - renderStorageUsage._lastUpdate) < maxAgeMs;

  if (!hasFreshCache) {
    if (!renderStorageUsage._inflight) {
      renderStorageUsage._inflight = getIndexedDbStorageUsage()
        .then((usage) => {
          renderStorageUsage._cachedUsage = usage;
          renderStorageUsage._lastUpdate = Date.now();
          return usage;
        })
        .finally(() => {
          renderStorageUsage._inflight = null;
        });
    }
    renderStorageUsage._cachedUsage = await renderStorageUsage._inflight;
  }

  const storageUsage = renderStorageUsage._cachedUsage || { bytesUsed: 0, percentUsed: 0, quotaBytes: null };
  const percentUsed = typeof storageUsage.percentUsed === 'number' ? storageUsage.percentUsed : 0;

  elements.storageTextImages.textContent = buildStorageLabel('IndexedDB Storage', storageUsage.bytesUsed, storageUsage.quotaBytes);
  elements.storageFillImages.style.width = `${Math.min(percentUsed, 100)}%`;

  elements.storageFillImages.classList.remove('warning', 'danger');
  if (percentUsed >= 85) {
    elements.storageFillImages.classList.add('danger');
  } else if (percentUsed >= 70) {
    elements.storageFillImages.classList.add('warning');
  }

  if (percentUsed >= 95) {
    showStorageWarning('critical', 'Storage full. Delete images or threads to free space.');
  } else if (percentUsed >= 85) {
    showStorageWarning('high', 'Storage almost full. Delete images or threads to continue using Projects.');
  } else if (percentUsed >= 70) {
    showStorageWarning('medium', 'Storage is filling up. Consider deleting old threads or images.');
  } else {
    hideStorageWarning();
  }
}
renderStorageUsage._cachedUsage = null;
renderStorageUsage._lastUpdate = 0;
renderStorageUsage._inflight = null;

function invalidateStorageUsageCache() {
  renderStorageUsage._cachedUsage = null;
  renderStorageUsage._lastUpdate = 0;
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

function getImageExtension(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'png';
}

function downloadImage(dataUrl, imageId, mimeType) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `wegweiser-image-${imageId}.${getImageExtension(mimeType)}`;
  link.click();
}

function openImageLightbox(dataUrl, imageId, mimeType) {
  if (!dataUrl) return;
  const overlay = document.createElement('div');
  overlay.className = 'image-lightbox';

  const content = document.createElement('div');
  content.className = 'image-lightbox-content';

  const toolbar = document.createElement('div');
  toolbar.className = 'image-lightbox-toolbar';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn btn-secondary';
  downloadBtn.textContent = 'Download';
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    downloadImage(dataUrl, imageId, mimeType);
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-secondary';
  closeBtn.textContent = 'Close';

  toolbar.appendChild(downloadBtn);
  toolbar.appendChild(closeBtn);

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = 'Generated image';

  content.appendChild(toolbar);
  content.appendChild(img);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') {
      close();
    }
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', handleKey);
}

async function hydrateImageCards(root) {
  if (typeof buildImageCard !== 'function') return;
  if (typeof getImageCacheEntry !== 'function') return;

  const scope = root || document;
  const messages = scope.querySelectorAll('.image-message');
  for (const message of messages) {
    const imageId = message.getAttribute('data-image-id');
    const contentEl = message.querySelector('.chat-content');
    if (!imageId || !contentEl) continue;

    const entry = await getImageCacheEntry(imageId);
    const dataUrl = entry?.dataUrl || entry?.data || '';
    const mimeType = entry?.mimeType || 'image/png';

    let card;
    if (dataUrl) {
      card = buildImageCard({
        state: 'ready',
        imageUrl: dataUrl,
        mode: 'Projects',
        onView: () => openImageLightbox(dataUrl, imageId, mimeType),
        onDownload: () => downloadImage(dataUrl, imageId, mimeType)
      });
      const thumb = card.querySelector('.image-card-thumb');
      if (thumb) {
        thumb.addEventListener('click', () => openImageLightbox(dataUrl, imageId, mimeType));
      }
    } else {
      card = buildImageCard({ state: 'expired' });
    }

    contentEl.innerHTML = '';
    contentEl.appendChild(card);
  }
}

// ============ ACTIONS ============

async function openProject(projectId) {
  const Project = await getProject(projectId);
  if (!Project) {
    showToast('Project not found', 'error');
    return;
  }

  currentProjectId = projectId;
  currentThreadId = null;

  elements.ProjectTitle.textContent = Project.name;
  elements.chatEmptyState.style.display = 'flex';
  elements.chatContainer.style.display = 'none';
  updateChatModelIndicator(null);

  showView('Project');
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

  // Set chat toggles from Project settings
  const Project = await getProject(currentProjectId);
  if (Project) {
    currentProjectData = Project;
    elements.chatWebSearch.checked = Project.webSearch || false;
    elements.chatReasoning.checked = Project.reasoning || false;
    applyProjectImageMode(Project);
    updateChatModelIndicator(Project);
  }

  elements.chatEmptyState.style.display = 'none';
  elements.chatContainer.style.display = 'flex';

    renderChatMessages(thread.messages, thread);
  await renderThreadList(); // Update active state
}

async function createNewThread() {
  if (!currentProjectId) return;

  // Set chat toggles from Project settings
  const Project = await getProject(currentProjectId);
  if (Project) {
    currentProjectData = Project;
    elements.chatWebSearch.checked = Project.webSearch || false;
    elements.chatReasoning.checked = Project.reasoning || false;
    applyProjectImageMode(Project);
  }

  const thread = await createThread(currentProjectId);
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

function openCreateProjectModal() {
  editingProjectId = null;
  elements.modalTitle.textContent = 'Create Project';
  elements.modalSave.textContent = 'Create Project';
  elements.ProjectForm.reset();
  // Reset icon to default
  elements.ProjectIcon.value = '📁';
  elements.iconPreview.textContent = '📁';
  elements.emojiGrid.classList.remove('show');
  // Reset toggles
  elements.ProjectWebSearch.checked = false;
  elements.ProjectReasoning.checked = false;
  elements.ProjectModal.style.display = 'flex';
  elements.ProjectName.focus();
}

async function openEditProjectModal(projectId) {
  const Project = await getProject(projectId);
  if (!Project) return;

  editingProjectId = projectId;
  elements.modalTitle.textContent = 'Edit Project';
  elements.modalSave.textContent = 'Save Changes';

  elements.ProjectName.value = Project.name;
  elements.ProjectDescription.value = Project.description;
  elements.ProjectIcon.value = Project.icon || '📁';
  elements.iconPreview.textContent = Project.icon || '📁';
    const modelProvider = normalizeProviderSafe(Project.modelProvider || currentProvider);
    const combinedId = Project.model ? buildCombinedModelIdSafe(modelProvider, Project.model) : '';
    elements.ProjectModel.value = combinedId;
    if (elements.ProjectModelInput) {
      elements.ProjectModelInput.value = Project.model ? getProjectModelLabel(Project) : '';
    }
  elements.ProjectInstructions.value = Project.customInstructions;
  elements.ProjectWebSearch.checked = Project.webSearch || false;
  elements.ProjectReasoning.checked = Project.reasoning || false;
  elements.emojiGrid.classList.remove('show');

  elements.ProjectModal.style.display = 'flex';
  elements.ProjectName.focus();
}

function closeProjectModal() {
  elements.ProjectModal.style.display = 'none';
  editingProjectId = null;
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();

    const combinedModelId = elements.ProjectModel.value;
    const parsedModel = parseCombinedModelIdSafe(combinedModelId);
    const modelProvider = combinedModelId ? normalizeProviderSafe(parsedModel.provider) : null;
    const modelId = combinedModelId ? parsedModel.modelId : '';
    const modelDisplayName = combinedModelId
      ? (elements.ProjectModelInput?.value || (typeof buildModelDisplayName === 'function'
        ? buildModelDisplayName(modelProvider, modelId)
        : modelId))
      : '';

    const data = {
      name: elements.ProjectName.value.trim(),
      description: elements.ProjectDescription.value.trim(),
      icon: elements.ProjectIcon.value || '📁',
      model: modelId,
      modelProvider,
      modelDisplayName,
      customInstructions: elements.ProjectInstructions.value.trim(),
      webSearch: elements.ProjectWebSearch.checked,
      reasoning: elements.ProjectReasoning.checked
    };

  if (!data.name) {
    showToast('Name is required', 'error');
    return;
  }

  try {
    if (editingProjectId) {
      await updateProject(editingProjectId, data);
      showToast('Project updated', 'success');

      // Update title if viewing this Project
      if (currentProjectId === editingProjectId) {
        elements.ProjectTitle.textContent = data.name;
        updateChatModelIndicator(data);
      }
    } else {
      await createProject(data);
      showToast('Project created', 'success');
    }

    closeProjectModal();
    invalidateStorageUsageCache();
    await renderProjectsList();
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

  if (type === 'Project') {
    const Project = await getProject(id);
    const threadCount = await getThreadCount(id);
    elements.deleteTitle.textContent = 'Delete Project';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${Project.name}" and all its threads?`;
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
    if (deletingItem.type === 'Project') {
      await deleteProject(deletingItem.id);
      showToast('Project deleted', 'success');

      if (currentProjectId === deletingItem.id) {
        showView('list');
      }
      invalidateStorageUsageCache();
      await renderProjectsList();
    } else {
      await deleteThread(deletingItem.id);
      showToast('Thread deleted', 'success');

      if (currentThreadId === deletingItem.id) {
        currentThreadId = null;
        elements.chatEmptyState.style.display = 'flex';
        elements.chatContainer.style.display = 'none';
      }
      invalidateStorageUsageCache();
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
      ProjectModelMap = new Map(response.models.map((model) => [model.id, model]));

      const [localItems, syncItems] = await Promise.all([
        getLocalStorage(['or_recent_models', 'or_recent_models_naga']),
        chrome.storage.sync.get(['or_favorites', 'or_favorites_naga'])
      ]);

      ProjectFavoriteModelsByProvider = {
        openrouter: new Set(syncItems.or_favorites || []),
        naga: new Set(syncItems.or_favorites_naga || [])
      };
      ProjectRecentModelsByProvider = {
        openrouter: localItems.or_recent_models || [],
        naga: localItems.or_recent_models_naga || []
      };

      if (!ProjectModelDropdown && elements.ProjectModelInput) {
        ProjectModelDropdown = new ModelDropdownManager({
          inputElement: elements.ProjectModelInput,
          containerType: 'modal',
          onModelSelect: async (modelId) => {
            const selectedModel = ProjectModelMap.get(modelId);
            const displayName = selectedModel ? getModelDisplayName(selectedModel) : modelId;
            if (elements.ProjectModelInput) {
              elements.ProjectModelInput.value = displayName;
            }
            if (elements.ProjectModel) {
              elements.ProjectModel.value = modelId;
            }
            return true;
          },
          onToggleFavorite: async (modelId, isFavorite) => {
            const parsed = parseCombinedModelIdSafe(modelId);
            const provider = normalizeProviderSafe(parsed.provider);
            const rawId = parsed.modelId;

            if (!ProjectFavoriteModelsByProvider[provider]) {
              ProjectFavoriteModelsByProvider[provider] = new Set();
            }

            if (isFavorite) {
              ProjectFavoriteModelsByProvider[provider].add(rawId);
            } else {
              ProjectFavoriteModelsByProvider[provider].delete(rawId);
            }

            await chrome.storage.sync.set({
              [getProviderStorageKeySafe('or_favorites', provider)]: Array.from(ProjectFavoriteModelsByProvider[provider])
            });
          },
          onAddRecent: async (modelId) => {
            const parsed = parseCombinedModelIdSafe(modelId);
            const provider = normalizeProviderSafe(parsed.provider);
            const rawId = parsed.modelId;

            const current = ProjectRecentModelsByProvider[provider] || [];
            const next = [rawId, ...current.filter(id => id !== rawId)].slice(0, 5);
            ProjectRecentModelsByProvider[provider] = next;

            await setLocalStorage({
              [getProviderStorageKeySafe('or_recent_models', provider)]: next
            });

            ProjectModelDropdown.setRecentlyUsed(buildCombinedRecentList(ProjectRecentModelsByProvider));
          }
        });
      }

      if (ProjectModelDropdown) {
        ProjectModelDropdown.setModels(response.models);
        ProjectModelDropdown.setFavorites(buildCombinedFavoritesList(ProjectFavoriteModelsByProvider));
        ProjectModelDropdown.setRecentlyUsed(buildCombinedRecentList(ProjectRecentModelsByProvider));
      }

      if (elements.ProjectModel) {
        const currentCombinedId = elements.ProjectModel.value || '';
        elements.ProjectModel.innerHTML = '<option value="">Use default model</option>' +
          response.models.map(m =>
            `<option value="${m.id}" ${m.id === currentCombinedId ? 'selected' : ''}>${getModelDisplayName(m)}</option>`
          ).join('');
      }

      if (elements.ProjectModelInput && elements.ProjectModel?.value) {
        const selected = ProjectModelMap.get(elements.ProjectModel.value);
        if (selected) {
          elements.ProjectModelInput.value = getModelDisplayName(selected);
        }
      }

      if (currentProjectData) {
        applyProjectImageMode(currentProjectData);
      }
    }
  } catch (err) {
    console.error('Error loading models:', err);
  }
}

// ============ EMOJI PICKER ============

function setupEmojiPicker() {
  // Populate emoji grid
  elements.emojiGridInner.innerHTML = Project_EMOJIS.map(emoji =>
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
      elements.ProjectIcon.value = emoji;
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
  // Create Project buttons
  elements.createProjectBtn.addEventListener('click', openCreateProjectModal);
  elements.emptyCreateBtn.addEventListener('click', openCreateProjectModal);
  if (elements.ProjectsSettingsBtn) {
    elements.ProjectsSettingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    elements.ProjectsSettingsBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      }
    });
  }

  // Project modal
  elements.modalClose.addEventListener('click', closeProjectModal);
  elements.modalCancel.addEventListener('click', closeProjectModal);
  elements.ProjectForm.addEventListener('submit', handleProjectFormSubmit);

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

  // Project view
  elements.backBtn.addEventListener('click', async () => {
    showView('list');
    await renderProjectsList();
  });

  elements.ProjectSettingsBtn.addEventListener('click', () => {
    if (currentProjectId) {
      openEditProjectModal(currentProjectId);
    }
  });

  elements.newThreadBtn.addEventListener('click', createNewThread);

  if (elements.chatImageMode) {
    elements.chatImageMode.addEventListener('change', () => {
      if (elements.chatImageMode.disabled) {
        elements.chatImageMode.checked = imageModeEnabled;
        return;
      }
      imageModeEnabled = elements.chatImageMode.checked;
    });
  }

  if (elements.ProjectsContextBtn) {
    elements.ProjectsContextBtn.addEventListener('click', async () => {
      if (elements.ProjectsContextBtn.classList.contains('inactive')) return;
      if (!currentThreadId || !currentProjectId) return;
      const thread = await getThread(currentThreadId);
      const Project = currentProjectData || await getProject(currentProjectId);
      currentProjectData = Project || currentProjectData;
      openProjectsContextModal(thread, currentProjectData);
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
  [elements.ProjectModal, elements.renameModal, elements.deleteModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProjectModal();
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

function getTypingIndicatorHtml() {
  return `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
}

function getStreamErrorHtml(message) {
  const safeMessage = escapeHtml(message || 'Unknown error');
  return `
    <div class="error-content">
      <div class="error-text">${safeMessage}</div>
      <div class="error-actions">
        <button class="retry-btn" type="button">Retry</button>
      </div>
    </div>
  `;
}

function resetStreamingUi(ui) {
  if (!ui) return ui;
  if (ui.content) {
    ui.content.innerHTML = getTypingIndicatorHtml();
  }
  if (ui.metaText) {
    ui.metaText.textContent = 'Streaming...';
  }
  if (ui.timeEl) {
    ui.timeEl.textContent = '--s';
  }
  if (ui.tokensEl) {
    ui.tokensEl.textContent = '-- tokens';
  }
  if (ui.contextBadgeEl) {
    ui.contextBadgeEl.style.display = 'none';
    ui.contextBadgeEl.textContent = '';
  }
  if (ui.sourcesSummaryEl) {
    ui.sourcesSummaryEl.textContent = '';
  }
  if (ui.wrapper) {
    const reasoningBubble = ui.wrapper.querySelector('.chat-reasoning-bubble');
    if (reasoningBubble) {
      reasoningBubble.remove();
    }
  }
  const tokenStyle = typeof getTokenBarStyle === 'function'
    ? getTokenBarStyle(null)
    : { percent: 0, gradient: 'linear-gradient(90deg, var(--color-success), #16a34a)' };
  if (ui.tokenFillEl) {
    ui.tokenFillEl.style.width = `${tokenStyle.percent}%`;
    ui.tokenFillEl.style.background = tokenStyle.gradient;
  }
  if (ui.tokenBarEl) {
    ui.tokenBarEl.setAttribute('aria-valuenow', '0');
  }
  return ui;
}

function renderStreamError(ui, message, retryContext) {
  if (!ui || !ui.content) return;
  ui.content.innerHTML = getStreamErrorHtml(message);
  const retryBtn = ui.content.querySelector('.retry-btn');
  if (!retryBtn) return;
  retryBtn.addEventListener('click', async () => {
    if (retryInProgress || isStreaming) return;
    retryBtn.disabled = true;
    await retryStreamFromContext(retryContext, ui);
  });
}

async function retryStreamFromContext(retryContext, ui) {
  if (!retryContext || isStreaming) {
    if (typeof showToast === 'function') {
      showToast('Nothing to retry yet', 'error');
    }
    return;
  }
  retryInProgress = true;
  try {
    const thread = await getThread(retryContext.threadId);
    const Project = await getProject(retryContext.projectId);
    if (!thread || !Project) {
      if (typeof showToast === 'function') {
        showToast('Retry failed: Project or thread not found', 'error');
      }
      return;
    }
    const effectiveProject = {
      ...Project,
      model: retryContext.model,
      modelProvider: retryContext.modelProvider,
      modelDisplayName: retryContext.modelDisplayName,
      customInstructions: retryContext.customInstructions
    };

    resetStreamingUi(ui);
    elements.sendBtn.style.display = 'none';
    elements.stopBtn.style.display = 'block';
    isStreaming = true;
    const startTime = Date.now();
    await streamMessage(
      retryContext.prompt,
      effectiveProject,
      thread,
      ui,
      startTime,
      {
        webSearch: retryContext.webSearch,
        reasoning: retryContext.reasoning,
        retryContext,
        retry: true
      }
    );
  } catch (err) {
    console.error('Stream retry failed:', err);
    if (typeof showToast === 'function') {
      showToast(err?.message || 'Retry failed', 'error');
    }
  } finally {
    elements.sendBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    isStreaming = false;
    retryInProgress = false;
    await renderThreadList();
  }
}

async function sendImageMessage(content, Project) {
  if (!currentThreadId || !currentProjectId) return;

  isStreaming = true;
  if (elements.sendBtn) {
    elements.sendBtn.disabled = true;
  }
  if (elements.stopBtn) {
    elements.stopBtn.style.display = 'none';
  }

  await addMessageToThread(currentThreadId, {
    role: 'user',
    content
  });

  elements.chatInput.value = '';
  elements.chatInput.style.height = 'auto';

  const thread = await getThread(currentThreadId);
  if (thread) {
    renderChatMessages(thread.messages, thread);
  }

  const tempWrapper = document.createElement('div');
  tempWrapper.className = 'chat-message chat-message-assistant image-message';
  tempWrapper.innerHTML = `
    <div class="chat-bubble-wrapper">
      <div class="chat-bubble">
        <div class="chat-content"></div>
      </div>
    </div>
  `;

  const tempContent = tempWrapper.querySelector('.chat-content');
  if (tempContent && typeof buildImageCard === 'function') {
    tempContent.appendChild(buildImageCard({ state: 'generating' }));
  } else if (tempContent) {
    tempContent.textContent = 'Generating image...';
  }

  elements.chatMessages.appendChild(tempWrapper);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  try {
    const provider = Project?.modelProvider || currentProvider;
    const model = Project?.model || null;

    const res = await chrome.runtime.sendMessage({
      type: 'image_query',
      prompt: content,
      provider,
      model
    });

    tempWrapper.remove();

    if (!res?.ok) {
      showToast(res?.error || 'Failed to generate image', 'error');
      return;
    }

    const image = res.image || {};
    const imageId = image.imageId || generateId('image');
    const mimeType = image.mimeType || 'image/png';
    const dataUrl = image.dataUrl || image.data || '';

    if (typeof putImageCacheEntry === 'function') {
      await putImageCacheEntry({
        imageId,
        mimeType,
        dataUrl,
        createdAt: Date.now()
      });
    }

    let metaModel = 'default model';
    if (Project?.modelDisplayName) {
      metaModel = Project.modelDisplayName;
    } else if (Project?.model && typeof buildModelDisplayName === 'function') {
      metaModel = buildModelDisplayName(provider, Project.model);
    }

    await addMessageToThread(currentThreadId, {
      role: 'assistant',
      content: 'Image generated',
      meta: {
        createdAt: Date.now(),
        model: metaModel,
        imageId,
        mimeType
      }
    });

    const updatedThread = await getThread(currentThreadId);
    if (updatedThread) {
      renderChatMessages(updatedThread.messages, updatedThread);
      updateProjectsContextButton(updatedThread, currentProjectData);
    }
  } catch (err) {
    console.error('Image generation failed:', err);
    tempWrapper.remove();
    showToast(err.message || 'Failed to generate image', 'error');
  } finally {
    isStreaming = false;
    if (elements.sendBtn) {
      elements.sendBtn.disabled = false;
    }
    await renderThreadList();
  }
}

async function sendMessage() {
  const content = elements.chatInput.value.trim();
  if (!content || !currentThreadId || !currentProjectId || isStreaming) return;

  const Project = await getProject(currentProjectId);
  if (!Project) return;

  if (imageModeEnabled) {
    await sendImageMessage(content, Project);
    return;
  }

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
        model: Project.model || null,
        provider: Project.modelProvider || currentProvider
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

  const webSearch = elements.chatWebSearch?.checked;
  const reasoning = elements.chatReasoning?.checked;
  const streamContext = {
    prompt: content,
    projectId: currentProjectId,
    threadId: currentThreadId,
    model: Project.model || null,
    modelProvider: Project.modelProvider || currentProvider,
    modelDisplayName: Project.modelDisplayName || null,
    customInstructions: Project.customInstructions || '',
    summary: thread.summary || '',
    webSearch: Boolean(webSearch),
    reasoning: Boolean(reasoning)
  };
  lastStreamContext = streamContext;

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
    await streamMessage(content, Project, thread, streamingUi, startTime, {
      webSearch: streamContext.webSearch,
      reasoning: streamContext.reasoning,
      retryContext: streamContext
    });
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

async function streamMessage(content, Project, thread, streamingUi, startTime, options = {}) {
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
        if (Project.modelDisplayName) {
          metaModel = Project.modelDisplayName;
        } else if (Project.model && typeof buildModelDisplayName === 'function') {
          metaModel = buildModelDisplayName(Project.modelProvider || currentProvider, Project.model);
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
          updateProjectsContextButton(updatedThread, currentProjectData);
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
        renderStreamError(streamingUi, msg.error, options.retryContext || lastStreamContext);
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
    const messages = buildStreamMessages(thread.messages, content, Project.customInstructions, thread.summary);

    // Use chat toggles (temporary override) instead of Project settings
    const webSearch = typeof options.webSearch === 'boolean'
      ? options.webSearch
      : elements.chatWebSearch.checked;
    const reasoning = typeof options.reasoning === 'boolean'
      ? options.reasoning
      : elements.chatReasoning.checked;

    // Send stream request
    streamPort.postMessage({
      type: 'start_stream',
      prompt: content,
      messages: messages,
      model: Project.model || null,
      provider: Project.modelProvider || currentProvider,
      webSearch: webSearch,
      reasoning: reasoning,
      tabId: `Project_${Project.id}`,
      retry: options.retry === true
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
  await Promise.all([migrationPromise, chatMigrationPromise]);
  initElements();
  bindEvents();
  setupChatInput();
  setupEmojiPicker();

  // Initialize theme
  if (typeof initTheme === 'function') {
    initTheme();
  }

  if (typeof cleanupImageCache === 'function') {
    cleanupImageCache().catch((e) => {
      console.warn('Failed to cleanup image cache:', e);
    });
  }

  // Load data
  await loadProviderSetting();
  await loadModels();
  await renderProjectsList();
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
        showToast(`Provider updated. Update Project models to use ${providerLabel}.`, 'info');
      }
    })();
  }
});


