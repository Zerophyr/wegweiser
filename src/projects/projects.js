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

const chatStore = (typeof window !== "undefined" && window.chatStore) ? window.chatStore : null;
const projectsModuleResolver = (typeof window !== "undefined" && window.projectsModuleResolver)
  || (typeof require === "function" ? require("./projects-module-resolver.js") : null);
const resolveProjectsModule = projectsModuleResolver?.resolveProjectsModule
  || ((windowKey) => ((typeof window !== "undefined" && window && window[windowKey]) ? window[windowKey] : {}));

function normalizeImageCacheLimitMb(value) {
  if (!Number.isFinite(value)) return IMAGE_CACHE_LIMIT_DEFAULT;
  const clamped = Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, value));
  const snapped = Math.round(clamped / IMAGE_CACHE_LIMIT_STEP) * IMAGE_CACHE_LIMIT_STEP;
  return Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, snapped));
}

const providerUiUtils = resolveProjectsModule('providerUiUtils', '../modules/provider-ui-utils.js');
const normalizeProviderSafe = providerUiUtils.normalizeProviderSafe
  || ((providerId) => (providerId === 'naga' ? 'naga' : 'openrouter'));
const getProviderLabelSafe = providerUiUtils.getProviderLabelSafe
  || ((providerId) => (normalizeProviderSafe(providerId) === 'naga' ? 'NagaAI' : 'OpenRouter'));
const getProviderStorageKeySafe = providerUiUtils.getProviderStorageKeySafe
  || ((baseKey, providerId) => (normalizeProviderSafe(providerId) === 'naga' ? `${baseKey}_naga` : baseKey));
const buildCombinedModelIdSafe = providerUiUtils.buildCombinedModelIdSafe
  || ((providerId, modelId) => `${normalizeProviderSafe(providerId)}:${modelId}`);
const parseCombinedModelIdSafe = providerUiUtils.parseCombinedModelIdSafe
  || ((combinedId) => {
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
  });
const getModelDisplayName = providerUiUtils.getModelDisplayName
  || ((model) => model?.displayName || model?.name || model?.id || '');
const buildCombinedFavoritesList = providerUiUtils.buildCombinedFavoritesList
  || ((favoritesByProvider) => {
    const combined = [];
    ['openrouter', 'naga'].forEach((provider) => {
      const favorites = favoritesByProvider[provider] || new Set();
      favorites.forEach((modelId) => {
        combined.push(buildCombinedModelIdSafe(provider, modelId));
      });
    });
    return combined;
  });
const buildCombinedRecentList = providerUiUtils.buildCombinedRecentList
  || ((recentsByProvider) => {
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
  });

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

function setChatImageToggleState(enabled, disabled = false) {
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
  setChatImageToggleState(Boolean(imageModeEnabled), false);
}

async function loadProviderSetting() {
  try {
    const stored = await getLocalStorage(['or_provider', 'or_model_provider']);
    currentProvider = normalizeProviderSafe(stored.or_model_provider || stored.or_provider);
  } catch (e) {
    console.warn('Failed to load provider setting:', e);
  }
}


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
const projectsBasicUtils = resolveProjectsModule('projectsBasicUtils', './projects-basic-utils.js');
const {
  generateId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  formatRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  },
  formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
  },
  truncateText = (text, maxLength) => text.length <= maxLength ? text : `${text.substring(0, maxLength).trim()}...`,
  generateThreadTitle = (firstMessage) => {
    const firstSentence = firstMessage.split(/[.!?]/)[0];
    return firstSentence.length <= 50 ? firstSentence.trim() : `${firstMessage.substring(0, 50).trim()}...`;
  },
  formatBytes = (bytes) => `${((Number.isFinite(bytes) ? bytes : 0) / 1024 / 1024).toFixed(1)}MB`,
  buildStorageLabel = (label, bytesUsed, maxBytes = null) => (
    typeof maxBytes === "number" && maxBytes > 0
      ? `${label}: ${formatBytes(bytesUsed)} of ${formatBytes(maxBytes)}`
      : `${label}: ${formatBytes(bytesUsed)}`
  ),
  escapeHtml = (str) => String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;"),
  getImageExtension = (mimeType) => (mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : mimeType === "image/gif" ? "gif" : "png"),
  sanitizeFilename = (name) => (name || "thread").replace(/[^a-zA-Z0-9 _-]/g, "").trim().substring(0, 50) || "thread"
} = projectsBasicUtils;
const projectsImageUtils = resolveProjectsModule('projectsImageUtils', './projects-image-utils.js');
const downloadImage = projectsImageUtils.downloadImage || (() => {});
const openImageLightbox = projectsImageUtils.openImageLightbox || (() => {});
const hydrateImageCards = projectsImageUtils.hydrateImageCards || (async () => {});
const projectsThreadListUtils = resolveProjectsModule('projectsThreadListUtils', './projects-thread-list-utils.js');
const buildEmptyThreadListHtml = projectsThreadListUtils.buildEmptyThreadListHtml
  || (() => '<p class="text-muted" style="text-align: center; padding: 20px;">No threads yet</p>');
const buildThreadListHtml = projectsThreadListUtils.buildThreadListHtml
  || (() => '');
const projectsCardsUtils = resolveProjectsModule('projectsCardsUtils', './projects-cards-utils.js');
const buildProjectCardHtml = projectsCardsUtils.buildProjectCardHtml
  || (() => '');
const projectsExportUtils = resolveProjectsModule('projectsExportUtils', './projects-export-utils.js');
const getFullThreadMessages = projectsExportUtils.getFullThreadMessages
  || ((thread) => [...(Array.isArray(thread?.archivedMessages) ? thread.archivedMessages : []), ...(Array.isArray(thread?.messages) ? thread.messages : [])]);
const buildExportPdfHtml = projectsExportUtils.buildExportPdfHtml
  || (() => '');
const buildThreadExportHtml = projectsExportUtils.buildThreadExportHtml
  || ((messages, options = {}) => {
    const markdown = typeof options.applyMarkdownStyles === 'function' ? options.applyMarkdownStyles : null;
    const escape = typeof options.escapeHtml === 'function' ? options.escapeHtml : (v) => String(v || '');
    return (Array.isArray(messages) ? messages : []).map((msg) => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      const content = markdown ? markdown(msg.content || '') : escape(msg.content || '');
      return `<h2>${role}</h2><div>${content}</div>`;
    }).join('');
  });
const projectsStorageUtils = resolveProjectsModule('projectsStorageUtils', './projects-storage-utils.js');
const getIndexedDbStorageUsage = projectsStorageUtils.getIndexedDbStorageUsage || (async () => ({ bytesUsed: 0, percentUsed: 0, quotaBytes: null }));
const estimateItemSize = projectsStorageUtils.estimateItemSize || (async (item) => {
  const json = JSON.stringify(item);
  return new Blob([json]).size;
});
const normalizeThreadProjectId = projectsStorageUtils.normalizeThreadProjectId || ((thread) => {
  if (!thread || typeof thread !== 'object') return thread;
  const projectId = thread.projectId || thread.ProjectId || thread.spaceId || null;
  const normalized = { ...thread, projectId };
  delete normalized.ProjectId;
  delete normalized.spaceId;
  return normalized;
});
const ensureThreadMessage = projectsStorageUtils.ensureThreadMessage || ((message, threadId, index, baseTime) => {
  const createdAt = message.createdAt || message.meta?.createdAt || (baseTime + index);
  const id = message.id || `${threadId}_msg_${index}`;
  return {
    ...message,
    id,
    threadId,
    createdAt
  };
});
const buildThreadRecordForStorage = projectsStorageUtils.buildThreadRecordForStorage || ((thread) => {
  const record = { ...(thread || {}) };
  delete record.messages;
  delete record.summary;
  delete record.summaryUpdatedAt;
  delete record.archivedMessages;
  delete record.archivedUpdatedAt;
  return record;
});
const normalizeLegacyThreadsPayload = projectsStorageUtils.normalizeLegacyThreadsPayload || ((rawThreads) => {
  let threads = [];
  let normalized = false;
  if (Array.isArray(rawThreads)) {
    threads = rawThreads;
  } else if (rawThreads && typeof rawThreads === 'object') {
    Object.entries(rawThreads).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((thread) => {
        if (!thread || typeof thread !== 'object') return;
        const normalizedThread = normalizeThreadProjectId({
          ...thread,
          projectId: thread.projectId === undefined ? (thread.ProjectId || thread.spaceId || key) : thread.projectId
        });
        threads.push(normalizedThread);
        normalized = true;
      });
    });
  }
  threads = threads.map((thread) => {
    const next = normalizeThreadProjectId(thread);
    if (next !== thread || thread?.ProjectId !== undefined || thread?.spaceId !== undefined) {
      normalized = true;
    }
    return next;
  });
  return { threads, normalized };
});
const projectsDataUtils = resolveProjectsModule('projectsDataUtils', './projects-data-utils.js');
const createProjectRecord = projectsDataUtils.createProjectRecord || (({ data = {}, id, now = Date.now() } = {}) => ({
  id,
  name: data.name,
  description: data.description || '',
  icon: data.icon || '📁',
  model: data.model || '',
  modelProvider: data.modelProvider || null,
  modelDisplayName: data.modelDisplayName || '',
  customInstructions: data.customInstructions || '',
  webSearch: data.webSearch || false,
  reasoning: data.reasoning || false,
  createdAt: now,
  updatedAt: now
}));
const applyProjectUpdate = projectsDataUtils.applyProjectUpdate
  || ((project, data = {}, now = Date.now()) => ({ ...project, ...data, updatedAt: now }));
const createThreadRecord = projectsDataUtils.createThreadRecord || (({ id, projectId, title = 'New Thread', now = Date.now() } = {}) => ({
  id,
  projectId,
  title,
  messages: [],
  summary: '',
  summaryUpdatedAt: null,
  archivedMessages: [],
  archivedUpdatedAt: null,
  createdAt: now,
  updatedAt: now
}));
const applyThreadUpdate = projectsDataUtils.applyThreadUpdate
  || ((thread, data = {}, now = Date.now()) => ({ ...thread, ...data, updatedAt: now }));
const appendMessageToThreadData = projectsDataUtils.appendMessageToThread || (({ thread, message, now = Date.now(), generateThreadTitle: generateTitle } = {}) => {
  const nextMessages = [...(Array.isArray(thread?.messages) ? thread.messages : []), message];
  const shouldRetitle = (
    nextMessages.length === 1
    && message?.role === 'user'
    && thread?.title === 'New Thread'
    && typeof generateTitle === 'function'
  );
  return {
    ...thread,
    messages: nextMessages,
    title: shouldRetitle ? generateTitle(message.content || '') : thread?.title,
    updatedAt: now
  };
});
const projectsViewUtils = resolveProjectsModule('projectsViewUtils', './projects-view-utils.js');
const applyViewSelection = projectsViewUtils.applyViewSelection || ((viewName, options = {}) => {
  const listView = options.listView || null;
  const projectView = options.projectView || null;
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  }
  if (viewName === 'list') {
    if (listView) listView.classList.add('active');
    return { shouldResetSelection: true };
  }
  if (viewName === 'Project') {
    if (projectView) projectView.classList.add('active');
  }
  return { shouldResetSelection: false };
});
const getProjectsListVisibilityState = projectsViewUtils.getProjectsListVisibilityState
  || ((Projects) => {
    const safeProjects = Array.isArray(Projects) ? Projects : [];
    const showEmpty = safeProjects.length === 0;
    return {
      showEmpty,
      gridDisplay: showEmpty ? 'none' : 'grid',
      emptyDisplay: showEmpty ? 'flex' : 'none'
    };
  });
const sortProjectsByUpdatedAt = projectsViewUtils.sortProjectsByUpdatedAt
  || ((Projects) => (Array.isArray(Projects) ? Projects.slice() : []).sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0)));
const projectsThreadViewUtils = resolveProjectsModule('projectsThreadViewUtils', './projects-thread-view-utils.js');
const getThreadListViewState = projectsThreadViewUtils.getThreadListViewState
  || ((threads) => {
    const sorted = (Array.isArray(threads) ? threads.slice() : []).sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
    return { threads: sorted, isEmpty: sorted.length === 0 };
  });
const projectsClickActionsUtils = resolveProjectsModule('projectsClickActionsUtils', './projects-click-actions-utils.js');
const resolveProjectCardClickAction = projectsClickActionsUtils.resolveProjectCardClickAction
  || ((target, card) => {
    const toggleBtn = target?.closest?.('[data-action="toggle-menu"]');
    if (toggleBtn) return { type: 'toggle-menu', button: toggleBtn };
    const editBtn = target?.closest?.('[data-action="edit"]');
    if (editBtn) return { type: 'edit', projectId: editBtn.dataset.projectId };
    const deleteBtn = target?.closest?.('[data-action="delete"]');
    if (deleteBtn) return { type: 'delete', projectId: deleteBtn.dataset.projectId };
    if (target?.closest?.('.menu-dropdown')) return { type: 'ignore' };
    return { type: 'open', projectId: card?.dataset?.projectId || null };
  });
const resolveThreadItemClickAction = projectsClickActionsUtils.resolveThreadItemClickAction
  || ((target, item) => {
    const toggleBtn = target?.closest?.('[data-action="toggle-menu"]');
    if (toggleBtn) return { type: 'toggle-menu', button: toggleBtn };
    const renameBtn = target?.closest?.('[data-action="rename"]');
    if (renameBtn) return { type: 'rename', threadId: renameBtn.dataset.threadId };
    const exportBtn = target?.closest?.('[data-action="export"]');
    if (exportBtn) return { type: 'export', threadId: exportBtn.dataset.threadId, format: exportBtn.dataset.format };
    if (target?.closest?.('[data-action="export-parent"]')) return { type: 'ignore' };
    const deleteBtn = target?.closest?.('[data-action="delete-thread"]');
    if (deleteBtn) return { type: 'delete-thread', threadId: deleteBtn.dataset.threadId };
    if (target?.closest?.('.menu-dropdown')) return { type: 'ignore' };
    return { type: 'open', threadId: item?.dataset?.threadId || null };
  });
const projectsArchiveViewUtils = resolveProjectsModule('projectsArchiveViewUtils', './projects-archive-view-utils.js');
const buildArchiveSectionHtml = projectsArchiveViewUtils.buildArchiveSectionHtml
  || ((archivedMessages) => {
    const list = Array.isArray(archivedMessages) ? archivedMessages : [];
    if (list.length === 0) return '';
    return `
      <div class="chat-archive-block" data-archive-open="false">
        <button class="chat-archive-toggle" type="button" aria-expanded="false">
          Earlier messages (${list.length})
        </button>
        <div class="chat-archive-content"></div>
      </div>
    `;
  });
const toggleArchiveSectionInContainer = projectsArchiveViewUtils.toggleArchiveSectionInContainer
  || (({
    chatMessagesEl,
    currentArchivedMessages: archivedMessages,
    buildMessageHtml: buildMessageHtmlFn,
    postProcessMessages: postProcessMessagesFn
  } = {}) => {
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
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      return;
    }
    const archivedHtml = (typeof buildMessageHtmlFn === 'function' ? buildMessageHtmlFn(archivedMessages) : '');
    contentEl.innerHTML = archivedHtml || '<div class="chat-archive-empty">No archived messages.</div>';
    archiveBlock.setAttribute('data-archive-open', 'true');
    archiveBlock.classList.add('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    if (typeof postProcessMessagesFn === 'function') postProcessMessagesFn(contentEl);
  });
const projectsChatViewUtils = resolveProjectsModule('projectsChatViewUtils', './projects-chat-view-utils.js');
const shouldShowSummaryBadge = projectsChatViewUtils.shouldShowSummaryBadge
  || ((summaryUpdatedAt, now = Date.now(), freshnessMs = 30000) => Boolean(summaryUpdatedAt) && (now - summaryUpdatedAt) < freshnessMs);
const buildChatMessagesContainerHtml = projectsChatViewUtils.buildChatMessagesContainerHtml
  || (({ archiveHtml = '', showSummaryBadge = false, messagesHtml = '' } = {}) => {
    const summaryBadgeHtml = showSummaryBadge
      ? '<div class="chat-summary-badge">Summary updated</div>'
      : '';
    return `${archiveHtml}${summaryBadgeHtml}${messagesHtml}`;
  });
const projectsChatClickUtils = resolveProjectsModule('projectsChatClickUtils', './projects-chat-click-utils.js');
const resolveChatMessageClickAction = projectsChatClickUtils.resolveChatMessageClickAction
  || ((target) => {
    if (target?.closest?.('.chat-archive-toggle')) {
      return { type: 'archive-toggle' };
    }
    const exportBtn = target?.closest?.('.export-btn');
    if (exportBtn) {
      return { type: 'export-menu-toggle', menu: exportBtn.closest('.export-menu') };
    }
    const exportOption = target?.closest?.('.export-option');
    if (exportOption) {
      return { type: 'export-option', format: exportOption.getAttribute('data-format') };
    }
    return { type: 'none' };
  });
const projectsExportMenuUtils = resolveProjectsModule('projectsExportMenuUtils', './projects-export-menu-utils.js');
const closeProjectsExportMenus = projectsExportMenuUtils.closeProjectsExportMenus
  || ((rootDocument) => {
    const doc = rootDocument || document;
    doc.querySelectorAll('.export-menu').forEach((menu) => menu.classList.remove('open'));
  });
const toggleProjectsExportMenu = projectsExportMenuUtils.toggleProjectsExportMenu
  || ((buttonEl, rootDocument) => {
    const menu = buttonEl?.closest?.('.export-menu');
    if (!menu) return false;
    const isOpen = menu.classList.contains('open');
    closeProjectsExportMenus(rootDocument);
    if (!isOpen) {
      menu.classList.add('open');
      return true;
    }
    return false;
  });
const projectsModalUiUtils = resolveProjectsModule('projectsModalUiUtils', './projects-modal-ui-utils.js');
const setModalVisibility = projectsModalUiUtils.setModalVisibility
  || ((modalEl, isOpen) => {
    if (!modalEl) return;
    modalEl.style.display = isOpen ? 'flex' : 'none';
  });
const shouldCloseModalOnBackdropClick = projectsModalUiUtils.shouldCloseModalOnBackdropClick
  || ((event, modalEl) => Boolean(event && modalEl && event.target === modalEl));
const isEscapeCloseEvent = projectsModalUiUtils.isEscapeCloseEvent
  || ((event) => event?.key === 'Escape');
const projectsSourcesSummaryUtils = resolveProjectsModule('projectsSourcesSummaryUtils', './projects-sources-summary-utils.js');
const renderProjectsSourcesSummary = projectsSourcesSummaryUtils.renderProjectsSourcesSummary
  || ((messageDiv, sources, getUniqueDomainsFn) => {
    const summary = messageDiv?.querySelector?.('.chat-sources-summary');
    if (!summary) return;
    summary.innerHTML = '';
    if (!Array.isArray(sources) || sources.length === 0 || typeof getUniqueDomainsFn !== 'function') return;
    const uniqueDomains = getUniqueDomainsFn(sources);
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
  });
const projectsMessageRenderUtils = resolveProjectsModule('projectsMessageRenderUtils', './projects-message-render-utils.js');
const buildProjectsMessageHtml = projectsMessageRenderUtils.buildProjectsMessageHtml
  || ((messages, deps = {}) => {
    const list = Array.isArray(messages) ? messages : [];
    const escape = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : (v) => String(v || '');
    return list.map((msg) => `
      <div class="chat-message ${msg.role === 'assistant' ? 'chat-message-assistant' : 'chat-message-user'}">
        <div class="chat-bubble">${escape(msg.content || '')}</div>
      </div>
    `).join('');
  });
const projectsMessagePostprocessUtils = resolveProjectsModule('projectsMessagePostprocessUtils', './projects-message-postprocess-utils.js');
const processProjectsAssistantSources = projectsMessagePostprocessUtils.processProjectsAssistantSources
  || ((root, deps = {}) => {
    const scope = root || document;
    scope.querySelectorAll('.chat-message-assistant .chat-content').forEach((contentEl) => {
      try {
        const sources = JSON.parse(contentEl.dataset.sources || '[]');
        if (sources.length > 0 && typeof deps.makeSourceReferencesClickable === 'function') {
          deps.makeSourceReferencesClickable(contentEl, sources);
          if (typeof deps.createSourcesIndicator === 'function') {
            const indicator = deps.createSourcesIndicator(sources, contentEl);
            if (indicator) contentEl.appendChild(indicator);
          }
        }
        const messageDiv = contentEl.closest('.chat-message-assistant');
        if (messageDiv && typeof deps.renderChatSourcesSummary === 'function') {
          deps.renderChatSourcesSummary(messageDiv, sources);
        }
      } catch (e) {
        (deps.logger || console).error('Error processing sources:', e);
      }
    });
  });
const bindProjectsCopyButtons = projectsMessagePostprocessUtils.bindProjectsCopyButtons
  || ((root, deps = {}) => {
    const scope = root || document;
    const writeText = deps.writeText || ((text) => navigator.clipboard.writeText(text));
    const showToastFn = deps.showToast || (() => {});
    const setTimeoutFn = deps.setTimeoutFn || setTimeout;
    scope.querySelectorAll('.chat-copy-btn').forEach((btn) => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const message = btn.closest('.chat-message-assistant');
        const contentEl = message?.querySelector('.chat-content');
        const content = contentEl?.innerText || contentEl?.textContent || '';
        try {
          await writeText(content);
          btn.classList.add('copied');
          setTimeoutFn(() => btn.classList.remove('copied'), 2000);
        } catch (_) {
          showToastFn('Failed to copy', 'error');
        }
      });
    });
  });
const projectsElementsUtils = resolveProjectsModule('projectsElementsUtils', './projects-elements-utils.js');
const collectProjectsElements = projectsElementsUtils.collectProjectsElements
  || ((doc) => ({
    ProjectsListView: doc?.getElementById?.('projects-list-view') || null
  }));
const projectsMenuUtils = resolveProjectsModule('projectsMenuUtils', './projects-menu-utils.js');
const closeProjectsDropdownMenus = projectsMenuUtils.closeProjectsDropdownMenus
  || ((rootDocument) => {
    const doc = rootDocument || document;
    doc.querySelectorAll('.menu-items').forEach((menu) => {
      menu.style.display = 'none';
    });
  });
const toggleProjectsDropdownMenu = projectsMenuUtils.toggleProjectsDropdownMenu
  || ((buttonEl, rootDocument) => {
    if (!buttonEl) return false;
    const doc = rootDocument || document;
    const targetMenu = buttonEl.nextElementSibling;
    doc.querySelectorAll('.menu-items').forEach((menu) => {
      if (menu !== targetMenu) {
        menu.style.display = 'none';
      }
    });
    if (!targetMenu) return false;
    targetMenu.style.display = targetMenu.style.display === 'none' ? 'block' : 'none';
    return targetMenu.style.display === 'block';
  });
const projectsFormUtils = resolveProjectsModule('projectsFormUtils', './projects-form-utils.js');
const buildProjectFormData = projectsFormUtils.buildProjectFormData
  || (({
    elements: el,
    parseCombinedModelId,
    normalizeProvider,
    buildModelDisplayName: buildName
  } = {}) => {
    const combinedModelId = el?.ProjectModel?.value || '';
    const parsedModel = typeof parseCombinedModelId === 'function'
      ? parseCombinedModelId(combinedModelId)
      : { provider: 'openrouter', modelId: combinedModelId };
    const modelProvider = combinedModelId
      ? (typeof normalizeProvider === 'function' ? normalizeProvider(parsedModel.provider) : parsedModel.provider)
      : null;
    const modelId = combinedModelId ? (parsedModel.modelId || '') : '';
    const modelDisplayName = combinedModelId
      ? (el?.ProjectModelInput?.value || (typeof buildName === 'function' ? buildName(modelProvider, modelId) : modelId))
      : '';
    return {
      name: (el?.ProjectName?.value || '').trim(),
      description: (el?.ProjectDescription?.value || '').trim(),
      icon: el?.ProjectIcon?.value || '📁',
      model: modelId,
      modelProvider,
      modelDisplayName,
      customInstructions: (el?.ProjectInstructions?.value || '').trim(),
      webSearch: Boolean(el?.ProjectWebSearch?.checked),
      reasoning: Boolean(el?.ProjectReasoning?.checked)
    };
  });
const projectsEmojiUtils = resolveProjectsModule('projectsEmojiUtils', './projects-emoji-utils.js');
const buildEmojiButtonsHtml = projectsEmojiUtils.buildEmojiButtonsHtml
  || ((emojis) => (Array.isArray(emojis) ? emojis : []).map((emoji) => (
    `<button type="button" class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`
  )).join(''));
const shouldCloseEmojiGridOnDocumentClick = projectsEmojiUtils.shouldCloseEmojiGridOnDocumentClick
  || ((target) => !target?.closest?.('.icon-picker-wrapper'));
const projectsDeleteModalUtils = resolveProjectsModule('projectsDeleteModalUtils', './projects-delete-modal-utils.js');
const buildProjectDeleteModalContent = projectsDeleteModalUtils.buildProjectDeleteModalContent
  || ((projectName, threadCount) => ({
    title: 'Delete Project',
    message: `Are you sure you want to delete "${projectName}" and all its threads?`,
    sizeText: `This will delete ${threadCount} thread${threadCount !== 1 ? 's' : ''}.`
  }));
const buildThreadDeleteModalContent = projectsDeleteModalUtils.buildThreadDeleteModalContent
  || ((threadTitle, sizeBytes) => ({
    title: 'Delete Thread',
    message: `Are you sure you want to delete "${threadTitle}"?`,
    sizeText: `This will free ~${(sizeBytes / 1024).toFixed(1)}KB.`
  }));
const projectsProjectModalUtils = resolveProjectsModule('projectsProjectModalUtils', './projects-project-modal-utils.js');
const buildCreateProjectModalViewState = projectsProjectModalUtils.buildCreateProjectModalViewState
  || (() => ({
    title: 'Create Project',
    saveLabel: 'Create Project',
    icon: '📁',
    webSearch: false,
    reasoning: false
  }));
const buildEditProjectModalViewState = projectsProjectModalUtils.buildEditProjectModalViewState
  || (({
    project,
    currentProvider: currentProviderValue,
    normalizeProvider,
    buildCombinedModelId,
    getProjectModelLabel: getLabel
  } = {}) => {
    const modelProvider = typeof normalizeProvider === 'function'
      ? normalizeProvider(project?.modelProvider || currentProviderValue)
      : (project?.modelProvider || currentProviderValue || 'openrouter');
    const modelCombinedId = project?.model
      ? (typeof buildCombinedModelId === 'function' ? buildCombinedModelId(modelProvider, project.model) : `${modelProvider}:${project.model}`)
      : '';
    return {
      title: 'Edit Project',
      saveLabel: 'Save Changes',
      name: project?.name || '',
      description: project?.description || '',
      icon: project?.icon || '📁',
      modelCombinedId,
      modelDisplayName: project?.model ? (typeof getLabel === 'function' ? getLabel(project) : project.model) : '',
      customInstructions: project?.customInstructions || '',
      webSearch: Boolean(project?.webSearch),
      reasoning: Boolean(project?.reasoning)
    };
  });
const projectsChatSettingsUtils = resolveProjectsModule('projectsChatSettingsUtils', './projects-chat-settings-utils.js');
const applyProjectChatSettingsToElements = projectsChatSettingsUtils.applyProjectChatSettingsToElements
  || ((project, el, applyProjectImageModeFn) => {
    if (!project || !el) return;
    if (el.chatWebSearch) el.chatWebSearch.checked = Boolean(project.webSearch);
    if (el.chatReasoning) el.chatReasoning.checked = Boolean(project.reasoning);
    if (typeof applyProjectImageModeFn === 'function') applyProjectImageModeFn(project);
  });
const projectsChatPanelUtils = resolveProjectsModule('projectsChatPanelUtils', './projects-chat-panel-utils.js');
const buildEmptyChatPanelState = projectsChatPanelUtils.buildEmptyChatPanelState
  || (() => ({ chatEmptyDisplay: 'flex', chatContainerDisplay: 'none', hasActiveThread: false }));
const buildActiveChatPanelState = projectsChatPanelUtils.buildActiveChatPanelState
  || (() => ({ chatEmptyDisplay: 'none', chatContainerDisplay: 'flex', hasActiveThread: true }));
const applyChatPanelStateToElements = projectsChatPanelUtils.applyChatPanelStateToElements
  || ((el, state) => {
    if (!el || !state) return;
    if (el.chatEmptyState?.style) el.chatEmptyState.style.display = state.chatEmptyDisplay;
    if (el.chatContainer?.style) el.chatContainer.style.display = state.chatContainerDisplay;
  });
const projectsStorageWarningUtils = resolveProjectsModule('projectsStorageWarningUtils', './projects-storage-warning-utils.js');
const showProjectsStorageWarning = projectsStorageWarningUtils.showProjectsStorageWarning
  || ((warningEl, messageEl, level, message) => {
    if (!warningEl) return;
    warningEl.className = `storage-warning ${level}`;
    warningEl.style.display = 'flex';
    if (messageEl) messageEl.textContent = message;
  });
const hideProjectsStorageWarning = projectsStorageWarningUtils.hideProjectsStorageWarning
  || ((warningEl) => {
    if (!warningEl) return;
    warningEl.style.display = 'none';
  });
const projectsStorageViewUtils = resolveProjectsModule('projectsStorageViewUtils', './projects-storage-view-utils.js');
const shouldUseCachedStorageUsage = projectsStorageViewUtils.shouldUseCachedStorageUsage
  || (({ now, lastUpdate, maxAgeMs, cachedUsage } = {}) => Boolean(cachedUsage) && Number.isFinite(now) && Number.isFinite(lastUpdate) && Number.isFinite(maxAgeMs) && (now - lastUpdate) < maxAgeMs);
const buildStorageMeterViewState = projectsStorageViewUtils.buildStorageMeterViewState
  || (({ usage, buildStorageLabel: buildStorageLabelFn } = {}) => {
    const safeUsage = usage || { bytesUsed: 0, percentUsed: 0, quotaBytes: null };
    const percentUsed = typeof safeUsage.percentUsed === 'number' ? safeUsage.percentUsed : 0;
    let warning = null;
    if (percentUsed >= 95) {
      warning = { level: 'critical', message: 'Storage full. Delete images or threads to free space.' };
    } else if (percentUsed >= 85) {
      warning = { level: 'high', message: 'Storage almost full. Delete images or threads to continue using Projects.' };
    } else if (percentUsed >= 70) {
      warning = { level: 'medium', message: 'Storage is filling up. Consider deleting old threads or images.' };
    }
    return {
      text: typeof buildStorageLabelFn === 'function' ? buildStorageLabelFn('IndexedDB Storage', safeUsage.bytesUsed, safeUsage.quotaBytes) : '',
      width: `${Math.min(percentUsed, 100)}%`,
      fillClass: percentUsed >= 85 ? 'danger' : (percentUsed >= 70 ? 'warning' : ''),
      warning
    };
  });

const projectsContextUtils = resolveProjectsModule('projectsContextUtils', './projects-context.js');
const getLiveWindowSize = projectsContextUtils.getLiveWindowSize || ((summary) => summary ? 8 : 12);
const splitMessagesForSummary = projectsContextUtils.splitMessagesForSummary || ((messages, liveWindowSize) => ({ historyToSummarize: [], liveMessages: Array.isArray(messages) ? messages.slice(-liveWindowSize) : [] }));
const shouldSkipSummarization = projectsContextUtils.shouldSkipSummarization || (() => false);
const getSummaryMinLength = projectsContextUtils.getSummaryMinLength || (() => 80);
const appendArchivedMessages = projectsContextUtils.appendArchivedMessages || ((currentArchive, newMessages) => ([...(Array.isArray(currentArchive) ? currentArchive : []), ...(Array.isArray(newMessages) ? newMessages : [])]));
const buildProjectsContextData = projectsContextUtils.buildProjectsContextData || ((thread) => ({ summary: thread?.summary || '', liveMessages: Array.isArray(thread?.messages) ? thread.messages : [], archivedMessages: Array.isArray(thread?.archivedMessages) ? thread.archivedMessages : [] }));
const buildContextBadgeLabel = projectsContextUtils.buildContextBadgeLabel || ((contextSize) => {
  if (!contextSize || contextSize <= 2) {
    return '';
  }
  return `${Math.floor(contextSize / 2)} Q&A`;
});
const getContextUsageCount = projectsContextUtils.getContextUsageCount || ((thread, Project) => buildProjectsContextData(thread).liveMessages.length + (buildProjectsContextData(thread).summary ? 1 : 0) + (Project?.customInstructions?.trim?.().length ? 1 : 0));
const buildContextMessageHtml = projectsContextUtils.buildContextMessageHtml
  || ((messages, truncateTextFn, escapeHtmlFn) => (messages || []).map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'User';
    const roleClass = msg.role === 'assistant' ? 'assistant' : '';
    const preview = (truncateTextFn || truncateText)(msg.content || '', 160);
    return `
      <div class="projects-context-item">
        <div class="projects-context-role ${roleClass}">${(escapeHtmlFn || escapeHtml)(role)}</div>
        <div class="projects-context-text">${(escapeHtmlFn || escapeHtml)(preview)}</div>
      </div>
    `;
  }).join(''));
const getProjectsContextButtonState = projectsContextUtils.getProjectsContextButtonState
  || ((thread, Project, maxContextMessages = MAX_CONTEXT_MESSAGES) => {
    const data = buildProjectsContextData(thread);
    const label = buildContextBadgeLabel(data.liveMessages.length);
    const isActive = Boolean(label);
    const usedCount = getContextUsageCount(thread, Project);
    const remaining = Math.max(maxContextMessages - usedCount, 0);
    return {
      label,
      isActive,
      usedCount,
      remaining,
      title: isActive
        ? `${usedCount} messages in context · ${remaining} remaining`
        : 'No conversation context yet'
    };
  });
const getProjectsContextModalState = projectsContextUtils.getProjectsContextModalState
  || ((thread, Project, maxContextMessages = MAX_CONTEXT_MESSAGES) => {
    const data = buildProjectsContextData(thread);
    const usedCount = getContextUsageCount(thread, Project);
    const remaining = Math.max(maxContextMessages - usedCount, 0);
    const fillPercentage = Math.min((usedCount / maxContextMessages) * 100, 100);
    const isNearLimit = fillPercentage > 75;
    return { data, usedCount, remaining, fillPercentage, isNearLimit };
  });
const buildProjectsContextModalHtml = projectsContextUtils.buildProjectsContextModalHtml
  || (({
    thread,
    project,
    maxContextMessages = MAX_CONTEXT_MESSAGES,
    truncateText: truncateTextFn,
    escapeHtml: escapeHtmlFn
  } = {}) => {
    const modalState = getProjectsContextModalState(thread, project, maxContextMessages);
    const { data, usedCount, remaining, fillPercentage, isNearLimit } = modalState;
    return `
      <div class="projects-context-header">
        <h3><span>🧠</span><span>Conversation Context</span></h3>
        <button class="projects-context-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="projects-context-body">
        ${data.summary ? `
          <div class="projects-context-section">
            <h4>Summary</h4>
            <div class="projects-context-text">${escapeHtmlFn(data.summary)}</div>
          </div>
        ` : ''}
        <div class="projects-context-section">
          <h4>Live Messages (${data.liveMessages.length})</h4>
          ${data.liveMessages.length ? buildContextMessageHtml(data.liveMessages, truncateTextFn, escapeHtmlFn) : '<div class="projects-context-text">No live messages yet.</div>'}
        </div>
        ${data.archivedMessages.length ? `
          <div class="projects-context-section">
            <button class="projects-context-archive-toggle" type="button">
              <span>Archived messages (${data.archivedMessages.length})</span>
              <span>+</span>
            </button>
            <div class="projects-context-archive-content">
              ${buildContextMessageHtml(data.archivedMessages, truncateTextFn, escapeHtmlFn)}
            </div>
          </div>
        ` : ''}
        ${project?.customInstructions && project.customInstructions.trim().length ? `
          <div class="projects-context-section">
            <h4>Custom Instructions</h4>
            <div class="projects-context-text">${escapeHtmlFn(truncateTextFn(project.customInstructions, 220))}</div>
          </div>
        ` : ''}
      </div>
      <div class="projects-context-footer">
        <div class="projects-context-text">${usedCount}/${maxContextMessages} messages in context · ${remaining} remaining</div>
        <div class="projects-context-bar">
          <div class="projects-context-bar-fill" style="width: ${fillPercentage}%; background: ${isNearLimit ? 'var(--color-warning)' : 'var(--color-success)'};"></div>
        </div>
        ${isNearLimit ? '<div class="projects-context-warning">⚠️ Context is nearing capacity.</div>' : ''}
      </div>
    `;
  });
const projectsStreamUtils = resolveProjectsModule('projectsStreamUtils', './projects-stream-utils.js');
const buildAssistantMessage = projectsStreamUtils.buildAssistantMessage || ((content, meta) => ({
  role: 'assistant',
  content,
  meta
}));
const buildStreamMessages = projectsStreamUtils.buildStreamMessages || ((messages) => (Array.isArray(messages) ? [...messages] : []));
const getSourcesData = projectsStreamUtils.getSourcesData || ((content) => ({ sources: [], cleanText: content || '' }));
const getTypingIndicatorHtml = projectsStreamUtils.getTypingIndicatorHtml || (() => '');
const getStreamErrorHtml = projectsStreamUtils.getStreamErrorHtml || ((message) => `<div class="error-content">${escapeHtml(message || 'Unknown error')}</div>`);
const createStreamingAssistantMessage = projectsStreamUtils.createStreamingAssistantMessage || (() => ({ messageDiv: document.createElement('div') }));
const updateAssistantFooter = projectsStreamUtils.updateAssistantFooter || (() => {});
const resetStreamingUi = projectsStreamUtils.resetStreamingUi || ((ui) => ui);
const projectsStreamRuntimeUtils = resolveProjectsModule('projectsStreamRuntimeUtils', './projects-stream-runtime-utils.js');
const renderStreamErrorRuntime = projectsStreamRuntimeUtils.renderStreamError;
const retryStreamFromContextRuntime = projectsStreamRuntimeUtils.retryStreamFromContext;
const createReasoningAppender = projectsStreamRuntimeUtils.createReasoningAppender
  || (() => ({ append: () => {} }));
const renderAssistantContent = projectsStreamRuntimeUtils.renderAssistantContent
  || ((assistantBubble, text) => { if (assistantBubble) assistantBubble.textContent = String(text || ''); });
const buildStreamMeta = projectsStreamRuntimeUtils.buildStreamMeta
  || ((msg, _project, elapsedSec) => ({
    model: msg?.model || 'default model',
    tokens: msg?.tokens || null,
    responseTimeSec: typeof elapsedSec === 'number' ? Number(elapsedSec.toFixed(2)) : null,
    contextSize: msg?.contextSize || 0,
    createdAt: Date.now()
  }));
const disconnectStreamPort = projectsStreamRuntimeUtils.disconnectStreamPort
  || ((port) => { try { port?.disconnect(); } catch (_) {} return null; });
const projectsMessageFlowUtils = resolveProjectsModule('projectsMessageFlowUtils', './projects-message-flow-utils.js');
const clearChatInput = projectsMessageFlowUtils.clearChatInput || ((inputEl) => {
  if (!inputEl) return;
  inputEl.value = '';
  inputEl.style.height = 'auto';
});
const createGeneratingImageMessage = projectsMessageFlowUtils.createGeneratingImageMessage || (() => {
  const tempWrapper = document.createElement('div');
  tempWrapper.className = 'chat-message chat-message-assistant image-message';
  tempWrapper.innerHTML = `
    <div class="chat-bubble-wrapper">
      <div class="chat-bubble">
        <div class="chat-content">Generating image...</div>
      </div>
    </div>
  `;
  return tempWrapper;
});
const resolveAssistantModelLabel = projectsMessageFlowUtils.resolveAssistantModelLabel
  || ((project, provider, buildModelDisplayNameFn) => {
    if (project?.modelDisplayName) return project.modelDisplayName;
    if (project?.model && typeof buildModelDisplayNameFn === 'function') {
      return buildModelDisplayNameFn(provider, project.model);
    }
    return 'default model';
  });
const buildStreamContext = projectsMessageFlowUtils.buildStreamContext || ((params = {}) => ({
  prompt: params.content || '',
  projectId: params.currentProjectId || null,
  threadId: params.currentThreadId || null,
  model: params.project?.model || null,
  modelProvider: params.project?.modelProvider || params.currentProvider || 'openrouter',
  modelDisplayName: params.project?.modelDisplayName || null,
  customInstructions: params.project?.customInstructions || '',
  summary: params.summary || '',
  webSearch: Boolean(params.webSearch),
  reasoning: Boolean(params.reasoning)
}));
const setSendStreamingState = projectsMessageFlowUtils.setSendStreamingState
  || ((sendBtn, setChatStreamingStateFn, isStreaming) => {
    if (sendBtn) sendBtn.style.display = isStreaming ? 'none' : 'block';
    if (typeof setChatStreamingStateFn === 'function') setChatStreamingStateFn(Boolean(isStreaming));
  });
const projectsSummarizationFlowUtils = resolveProjectsModule('projectsSummarizationFlowUtils', './projects-summarization-flow-utils.js');
const maybeSummarizeBeforeStreaming = projectsSummarizationFlowUtils.maybeSummarizeBeforeStreaming
  || (async ({ thread }) => thread);
const projectsStreamRequestUtils = resolveProjectsModule('projectsStreamRequestUtils', './projects-stream-request-utils.js');
const resolveStreamToggles = projectsStreamRequestUtils.resolveStreamToggles
  || ((options, el) => ({
    webSearch: typeof options?.webSearch === 'boolean' ? options.webSearch : Boolean(el?.chatWebSearch?.checked),
    reasoning: typeof options?.reasoning === 'boolean' ? options.reasoning : Boolean(el?.chatReasoning?.checked)
  }));
const buildStartStreamPayload = projectsStreamRequestUtils.buildStartStreamPayload
  || ((params = {}) => ({
    type: 'start_stream',
    prompt: params.content || '',
    messages: Array.isArray(params.messages) ? params.messages : [],
    model: params.project?.model || null,
    provider: params.project?.modelProvider || params.provider || 'openrouter',
    webSearch: Boolean(params.webSearch),
    reasoning: Boolean(params.reasoning),
    tabId: `Project_${params.project?.id || ''}`,
    retry: params.retry === true
  }));
const projectsStreamChunkUtils = resolveProjectsModule('projectsStreamChunkUtils', './projects-stream-chunk-utils.js');
const createStreamChunkState = projectsStreamChunkUtils.createStreamChunkState
  || ((streamingUi, createReasoningAppenderFn) => ({
    fullContent: '',
    assistantBubble: streamingUi?.content || null,
    messageDiv: streamingUi?.messageDiv || null,
    reasoningStreamState: { inReasoning: false, carry: '' },
    reasoningAppender: typeof createReasoningAppenderFn === 'function'
      ? createReasoningAppenderFn(streamingUi?.messageDiv || null, streamingUi?.content || null)
      : { append: () => {} }
  }));
const applyContentChunk = projectsStreamChunkUtils.applyContentChunk
  || ((state, msg, deps = {}) => {
    if (!state || msg?.type !== 'content') return false;
    let contentChunk = msg.content || '';
    let reasoningChunk = '';
    if (typeof deps.extractReasoningFromStreamChunk === 'function') {
      const parsed = deps.extractReasoningFromStreamChunk(state.reasoningStreamState, contentChunk);
      contentChunk = parsed.content;
      reasoningChunk = parsed.reasoning;
    }
    if (reasoningChunk) state.reasoningAppender?.append?.(reasoningChunk);
    if (!contentChunk) return true;
    state.fullContent += contentChunk;
    deps.renderAssistantContent?.(state.assistantBubble, state.fullContent);
    deps.scrollToBottom?.();
    return true;
  });
const applyReasoningChunk = projectsStreamChunkUtils.applyReasoningChunk
  || ((state, msg) => {
    if (!state || msg?.type !== 'reasoning' || !msg.reasoning) return false;
    state.reasoningAppender?.append?.(msg.reasoning);
    return true;
  });

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

  const state = getProjectsContextButtonState(thread, Project, MAX_CONTEXT_MESSAGES);
  const { isActive, label } = state;
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

  elements.ProjectsContextBtn.title = state.title;
}

function openProjectsContextModal(thread, Project) {
  if (!thread) return;

  const overlay = document.createElement('div');
  overlay.className = 'projects-context-overlay';

  const modal = document.createElement('div');
  modal.className = 'projects-context-modal';
  modal.innerHTML = buildProjectsContextModalHtml({
    thread,
    project: Project,
    maxContextMessages: MAX_CONTEXT_MESSAGES,
    truncateText,
    escapeHtml
  });

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

  const threadRecord = buildThreadRecordForStorage(normalized);

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
    const normalizedResult = normalizeLegacyThreadsPayload(rawThreads);
    const threads = normalizedResult.threads;
    const normalized = normalizedResult.normalized;

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

// ============ Project CRUD ============

async function createProject(data) {
  const Projects = await loadProjects();
  const Project = createProjectRecord({
    data,
    id: generateId('project'),
    now: Date.now()
  });
  Projects.push(Project);
  await saveProjects(Projects);
  return Project;
}

async function updateProject(id, data) {
  const Projects = await loadProjects();
  const index = Projects.findIndex(s => s.id === id);
  if (index === -1) throw new Error('Project not found');

  Projects[index] = applyProjectUpdate(Projects[index], data, Date.now());
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
  const thread = createThreadRecord({
    id: generateId('thread'),
    projectId,
    title,
    now: Date.now()
  });
  threads.push(thread);
  await saveThreads(threads);
  return thread;
}

async function updateThread(id, data) {
  const threads = await loadThreads();
  const index = threads.findIndex(t => t.id === id);
  if (index === -1) throw new Error('Thread not found');

  threads[index] = applyThreadUpdate(threads[index], data, Date.now());
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
  let thread = await getThread(threadId);
  if (!thread) throw new Error('Thread not found');
  thread = appendMessageToThreadData({
    thread,
    message,
    now: Date.now(),
    generateThreadTitle
  });

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
  Object.assign(elements, collectProjectsElements(document));
}

// ============ VIEW SWITCHING ============

function showView(viewName) {
  const state = applyViewSelection(viewName, {
    listView: elements.ProjectsListView,
    projectView: elements.ProjectView
  });

  if (state.shouldResetSelection) {
    currentProjectId = null;
    currentThreadId = null;
    currentProjectData = null;
    updateProjectsContextButton(null, null);
  }
}

// ============ RENDERING ============

async function renderProjectsList() {
  const ProjectsRaw = await loadProjects();
  const visibility = getProjectsListVisibilityState(ProjectsRaw);
  elements.ProjectsGrid.style.display = visibility.gridDisplay;
  elements.emptyState.style.display = visibility.emptyDisplay;
  if (visibility.showEmpty) {
    return;
  }

  const Projects = sortProjectsByUpdatedAt(ProjectsRaw);

  const cardsHtml = await Promise.all(Projects.map(async (Project) => {
    const modelName = getProjectModelLabel(Project);
    const dateStr = formatDate(Project.updatedAt);
    return buildProjectCardHtml(Project, modelName, dateStr, escapeHtml);
  }));

  elements.ProjectsGrid.innerHTML = cardsHtml.join('');

  // Add click handlers using event delegation
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = e.target;
      const action = resolveProjectCardClickAction(target, card);
      if (action.type === 'toggle-menu') {
        e.stopPropagation();
        toggleMenu(action.button);
      } else if (action.type === 'edit') {
        e.stopPropagation();
        openEditProjectModal(action.projectId);
      } else if (action.type === 'delete') {
        e.stopPropagation();
        openDeleteModal('Project', action.projectId);
      } else if (action.type === 'open') {
        openProject(action.projectId);
      }
    });
  });
}

async function renderThreadList() {
  if (!currentProjectId) return;

  const threads = await loadThreads(currentProjectId);
  const threadViewState = getThreadListViewState(threads);
  if (threadViewState.isEmpty) {
    elements.threadList.innerHTML = buildEmptyThreadListHtml();
    return;
  }

  elements.threadList.innerHTML = buildThreadListHtml(
    threadViewState.threads,
    currentThreadId,
    escapeHtml,
    formatRelativeTime
  );

  // Add click handlers using event delegation
  document.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target;
      const action = resolveThreadItemClickAction(target, item);
      if (action.type === 'toggle-menu') {
        e.stopPropagation();
        toggleMenu(action.button);
      } else if (action.type === 'rename') {
        e.stopPropagation();
        openRenameModal(action.threadId);
      } else if (action.type === 'export') {
        e.stopPropagation();
        exportThread(action.threadId, action.format);
      } else if (action.type === 'delete-thread') {
        e.stopPropagation();
        openDeleteModal('thread', action.threadId);
      } else if (action.type === 'ignore') {
        e.stopPropagation();
      } else if (action.type === 'open') {
        openThread(action.threadId);
      }
    });
  });
}

let currentArchivedMessages = [];

function buildMessageHtml(messages) {
  return buildProjectsMessageHtml(messages, {
    escapeHtml,
    applyMarkdownStyles,
    extractSources: (typeof extractSources === 'function' ? extractSources : null),
    getTokenBarStyle: (typeof getTokenBarStyle === 'function' ? getTokenBarStyle : null)
  });
}

function postProcessMessages(root) {
  processProjectsAssistantSources(root, {
    makeSourceReferencesClickable: (typeof makeSourceReferencesClickable === 'function' ? makeSourceReferencesClickable : null),
    createSourcesIndicator: (typeof createSourcesIndicator === 'function' ? createSourcesIndicator : null),
    renderChatSourcesSummary,
    logger: console
  });
  bindProjectsCopyButtons(root, {
    writeText: (text) => navigator.clipboard.writeText(text),
    showToast: (typeof showToast === 'function' ? showToast : () => {}),
    setTimeoutFn: setTimeout
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
  const showSummaryBadge = shouldShowSummaryBadge(summaryUpdatedAt, Date.now(), 30000);

  const archiveHtml = buildArchiveSectionHtml(archivedMessages);

  const messagesHtml = buildMessageHtml(messages);
  chatMessagesEl.innerHTML = buildChatMessagesContainerHtml({
    archiveHtml,
    showSummaryBadge,
    messagesHtml
  });

  postProcessMessages(chatMessagesEl);
  hydrateImageCards(chatMessagesEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  updateProjectsContextButton(thread, currentProjectData);
}

function toggleArchiveSection() {
  const chatMessagesEl = elements.chatMessages || document.getElementById('chat-messages');
  toggleArchiveSectionInContainer({
    chatMessagesEl,
    currentArchivedMessages,
    buildMessageHtml,
    postProcessMessages
  });
}

function closeExportMenus() {
  closeProjectsExportMenus(document);
}

function renderChatSourcesSummary(messageDiv, sources) {
  renderProjectsSourcesSummary(messageDiv, sources, (typeof getUniqueDomains === 'function' ? getUniqueDomains : null));
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
    const html = buildThreadExportHtml(messages, { applyMarkdownStyles, escapeHtml });
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
  const hasFreshCache = shouldUseCachedStorageUsage({
    now,
    lastUpdate: renderStorageUsage._lastUpdate,
    maxAgeMs,
    cachedUsage: renderStorageUsage._cachedUsage
  });

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
  const meterState = buildStorageMeterViewState({ usage: storageUsage, buildStorageLabel });

  elements.storageTextImages.textContent = meterState.text;
  elements.storageFillImages.style.width = meterState.width;

  elements.storageFillImages.classList.remove('warning', 'danger');
  if (meterState.fillClass) {
    elements.storageFillImages.classList.add(meterState.fillClass);
  }

  if (meterState.warning) {
    showStorageWarning(meterState.warning.level, meterState.warning.message);
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
  showProjectsStorageWarning(elements.storageWarning, elements.warningMessage, level, message);
}

function hideStorageWarning() {
  hideProjectsStorageWarning(elements.storageWarning);
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
  applyChatPanelStateToElements(elements, buildEmptyChatPanelState());
  updateChatModelIndicator(null);

  showView('Project');
  await renderThreadList();
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
      const html = buildExportPdfHtml(allMessages, escapeHtmlForExport);
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
    applyProjectChatSettingsToElements(Project, elements, applyProjectImageMode);
    updateChatModelIndicator(Project);
  }

  applyChatPanelStateToElements(elements, buildActiveChatPanelState());

    renderChatMessages(thread.messages, thread);
  await renderThreadList(); // Update active state
}

async function createNewThread() {
  if (!currentProjectId) return;

  // Set chat toggles from Project settings
  const Project = await getProject(currentProjectId);
  if (Project) {
    currentProjectData = Project;
    applyProjectChatSettingsToElements(Project, elements, applyProjectImageMode);
  }

  const thread = await createThread(currentProjectId);
  await renderThreadList();
  openThread(thread.id);
  showToast('New thread created', 'success');
}

function toggleMenu(button) {
  toggleProjectsDropdownMenu(button, document);
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-dropdown')) {
    closeProjectsDropdownMenus(document);
  }

  if (!e.target.closest('.export-menu')) {
    closeExportMenus();
  }
});

// ============ MODAL HANDLERS ============

function openCreateProjectModal() {
  const viewState = buildCreateProjectModalViewState();
  editingProjectId = null;
  elements.modalTitle.textContent = viewState.title;
  elements.modalSave.textContent = viewState.saveLabel;
  elements.ProjectForm.reset();
  // Reset icon to default
  elements.ProjectIcon.value = viewState.icon;
  elements.iconPreview.textContent = viewState.icon;
  elements.emojiGrid.classList.remove('show');
  // Reset toggles
  elements.ProjectWebSearch.checked = viewState.webSearch;
  elements.ProjectReasoning.checked = viewState.reasoning;
  setModalVisibility(elements.ProjectModal, true);
  elements.ProjectName.focus();
}

function setChatStreamingState(isStreaming) {
  if (typeof setStreamingUi === 'function') {
    setStreamingUi({
      container: elements.chatInputContainer,
      input: elements.chatInput,
      stopButton: elements.stopBtn,
      isStreaming
    });
    return;
  }
  if (elements.chatInput) {
    elements.chatInput.disabled = Boolean(isStreaming);
  }
  if (elements.stopBtn) {
    elements.stopBtn.style.display = isStreaming ? 'inline-flex' : 'none';
  }
}

async function openEditProjectModal(projectId) {
  const Project = await getProject(projectId);
  if (!Project) return;
  const viewState = buildEditProjectModalViewState({
    project: Project,
    currentProvider,
    normalizeProvider: normalizeProviderSafe,
    buildCombinedModelId: buildCombinedModelIdSafe,
    getProjectModelLabel
  });

  editingProjectId = projectId;
  elements.modalTitle.textContent = viewState.title;
  elements.modalSave.textContent = viewState.saveLabel;

  elements.ProjectName.value = viewState.name;
  elements.ProjectDescription.value = viewState.description;
  elements.ProjectIcon.value = viewState.icon;
  elements.iconPreview.textContent = viewState.icon;
    elements.ProjectModel.value = viewState.modelCombinedId;
    if (elements.ProjectModelInput) {
      elements.ProjectModelInput.value = viewState.modelDisplayName;
    }
  elements.ProjectInstructions.value = viewState.customInstructions;
  elements.ProjectWebSearch.checked = viewState.webSearch;
  elements.ProjectReasoning.checked = viewState.reasoning;
  elements.emojiGrid.classList.remove('show');

  setModalVisibility(elements.ProjectModal, true);
  elements.ProjectName.focus();
}

function closeProjectModal() {
  setModalVisibility(elements.ProjectModal, false);
  editingProjectId = null;
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();

  const data = buildProjectFormData({
    elements,
    parseCombinedModelId: parseCombinedModelIdSafe,
    normalizeProvider: normalizeProviderSafe,
    buildModelDisplayName
  });

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
  setModalVisibility(elements.renameModal, true);
  elements.threadTitle.focus();
  elements.threadTitle.select();
}

function closeRenameModal() {
  setModalVisibility(elements.renameModal, false);
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
    const modalContent = buildProjectDeleteModalContent(Project.name, threadCount);
    elements.deleteTitle.textContent = modalContent.title;
    elements.deleteMessage.textContent = modalContent.message;
    elements.deleteSize.textContent = modalContent.sizeText;
  } else {
    const thread = await getThread(id);
    const size = await estimateItemSize(thread);
    const modalContent = buildThreadDeleteModalContent(thread.title, size);
    elements.deleteTitle.textContent = modalContent.title;
    elements.deleteMessage.textContent = modalContent.message;
    elements.deleteSize.textContent = modalContent.sizeText;
  }

  setModalVisibility(elements.deleteModal, true);
}

function closeDeleteModal() {
  setModalVisibility(elements.deleteModal, false);
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
        applyChatPanelStateToElements(elements, buildEmptyChatPanelState());
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

      const resolvedModelInput = elements.ProjectModelInput || document.getElementById('project-model-input');
      if (!ProjectModelDropdown && resolvedModelInput) {
        ProjectModelDropdown = new ModelDropdownManager({
          inputElement: resolvedModelInput,
          containerType: 'modal',
          preferProvidedRecents: true,
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
      } else if (ProjectModelDropdown && resolvedModelInput) {
        ProjectModelDropdown.bindInput(resolvedModelInput);
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
  elements.emojiGridInner.innerHTML = buildEmojiButtonsHtml(Project_EMOJIS);

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
    if (shouldCloseEmojiGridOnDocumentClick(e.target)) {
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
    const action = resolveChatMessageClickAction(e.target);
    if (action.type === 'archive-toggle') {
      e.preventDefault();
      e.stopPropagation();
      toggleArchiveSection();
      return;
    }

    if (action.type === 'export-menu-toggle') {
      e.preventDefault();
      e.stopPropagation();
      toggleProjectsExportMenu(e.target.closest('.export-btn'), document);
      return;
    }

    if (action.type === 'export-option') {
      e.preventDefault();
      e.stopPropagation();
      await exportCurrentThread(action.format);
      closeExportMenus();
      return;
    }
  });

  // Close modals on backdrop click
  [elements.ProjectModal, elements.renameModal, elements.deleteModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (shouldCloseModalOnBackdropClick(e, modal)) {
        setModalVisibility(modal, false);
      }
    });
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (isEscapeCloseEvent(e)) {
      closeProjectModal();
      closeRenameModal();
      closeDeleteModal();
    }
  });
}

// ============ CHAT FUNCTIONALITY ============

function renderStreamError(ui, message, retryContext) {
  if (typeof renderStreamErrorRuntime === 'function') {
    renderStreamErrorRuntime(ui, message, retryContext, {
      getStreamErrorHtml,
      setSanitizedHtml: (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === 'function')
        ? window.safeHtml.setSanitizedHtml
        : null,
      getRetryInProgress: () => retryInProgress,
      getIsStreaming: () => isStreaming,
      retryStreamFromContext: (ctx, state) => retryStreamFromContext(ctx, state)
    });
    return;
  }
  if (!ui || !ui.content) return;
  ui.content.innerHTML = getStreamErrorHtml(message);
}

async function retryStreamFromContext(retryContext, ui) {
  if (typeof retryStreamFromContextRuntime === 'function') {
    await retryStreamFromContextRuntime(retryContext, ui, {
      getIsStreaming: () => isStreaming,
      getRetryInProgress: () => retryInProgress,
      setRetryInProgress: (value) => { retryInProgress = Boolean(value); },
      getThread,
      getProject,
      showToast: (typeof showToast === 'function') ? showToast : null,
      resetStreamingUi: (state) => resetStreamingUi(state, getTokenBarStyle),
      sendBtn: elements.sendBtn,
      setChatStreamingState,
      setIsStreaming: (value) => { isStreaming = Boolean(value); },
      streamMessage,
      renderThreadList,
      logger: console
    });
    return;
  }
  if (!retryContext || isStreaming) return;
}

async function sendImageMessage(content, Project) {
  if (!currentThreadId || !currentProjectId) return;

  isStreaming = true;
  if (elements.sendBtn) {
    elements.sendBtn.disabled = true;
  }
  setChatStreamingState(false);

  await addMessageToThread(currentThreadId, {
    role: 'user',
    content
  });

  clearChatInput(elements.chatInput);

  const thread = await getThread(currentThreadId);
  if (thread) {
    renderChatMessages(thread.messages, thread);
  }

  const tempWrapper = createGeneratingImageMessage(typeof buildImageCard === 'function' ? buildImageCard : null);

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

    const metaModel = resolveAssistantModelLabel(Project, provider, buildModelDisplayName);

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
  clearChatInput(elements.chatInput);

  // Re-render messages
  let thread = await getThread(currentThreadId);
  if (!thread) return;

  thread = await maybeSummarizeBeforeStreaming({
    thread,
    content,
    currentThreadId,
    project: Project,
    currentProvider
  }, {
    getLiveWindowSize,
    splitMessagesForSummary,
    shouldSkipSummarization,
    getSummaryMinLength,
    appendArchivedMessages,
    buildSummarizerMessages: (typeof buildSummarizerMessages === 'function') ? buildSummarizerMessages : null,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    updateThread,
    showToast: (typeof showToast === 'function') ? showToast : null,
    logger: console
  });

    renderChatMessages(thread.messages, thread);

  const webSearch = elements.chatWebSearch?.checked;
  const reasoning = elements.chatReasoning?.checked;
  const streamContext = buildStreamContext({
    content,
    currentProjectId,
    currentThreadId,
    project: Project,
    currentProvider,
    summary: thread.summary || '',
    webSearch,
    reasoning
  });
  lastStreamContext = streamContext;

  const startTime = Date.now();
  const streamingUi = createStreamingAssistantMessage(getTokenBarStyle);
  elements.chatMessages.appendChild(streamingUi.messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // Show stop button, hide send
  setSendStreamingState(elements.sendBtn, setChatStreamingState, true);
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
    setSendStreamingState(elements.sendBtn, setChatStreamingState, false);
    isStreaming = false;

    await renderThreadList();
  }
}

async function streamMessage(content, Project, thread, streamingUi, startTime, options = {}) {
  return new Promise((resolve, reject) => {
    // Create port for streaming
    streamPort = chrome.runtime.connect({ name: 'streaming' });

    const chunkState = createStreamChunkState(streamingUi, createReasoningAppender);
    const assistantBubble = chunkState.assistantBubble;
    const messageDiv = chunkState.messageDiv;
    const safeHtmlSetter = (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === 'function')
      ? window.safeHtml.setSanitizedHtml
      : null;

    streamPort.onMessage.addListener(async (msg) => {
      if (applyContentChunk(chunkState, msg, {
        extractReasoningFromStreamChunk: (typeof extractReasoningFromStreamChunk === 'function')
          ? extractReasoningFromStreamChunk
          : null,
        renderAssistantContent: (bubble, text) => renderAssistantContent(bubble, text, {
          applyMarkdownStyles,
          setSanitizedHtml: safeHtmlSetter
        }),
        scrollToBottom: () => { elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight; }
      })) {
        return;
      }
      if (applyReasoningChunk(chunkState, msg)) {
        return;
      } else if (msg.type === 'complete') {
        const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : null;
        const meta = buildStreamMeta(msg, Project, elapsedSec, {
          buildModelDisplayName,
          currentProvider
        });

        // Save assistant message to thread
        await addMessageToThread(currentThreadId, buildAssistantMessage(chunkState.fullContent, meta));
        const updatedThread = await getThread(currentThreadId);
        if (updatedThread) {
          updateProjectsContextButton(updatedThread, currentProjectData);
        }

        updateAssistantFooter(streamingUi, meta, getTokenBarStyle);

        const { sources, cleanText } = getSourcesData(chunkState.fullContent);
        renderAssistantContent(assistantBubble, cleanText, {
          applyMarkdownStyles,
          setSanitizedHtml: safeHtmlSetter
        });

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

        streamPort = disconnectStreamPort(streamPort);
        resolve();
      } else if (msg.type === 'error') {
        renderStreamError(streamingUi, msg.error, options.retryContext || lastStreamContext);
        if (streamingUi?.metaText) {
          streamingUi.metaText.textContent = `Error - ${new Date().toLocaleTimeString()}`;
        }
        if (typeof removeReasoningBubbles === 'function') {
          removeReasoningBubbles(messageDiv);
        }
        streamPort = disconnectStreamPort(streamPort);
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
    const { webSearch, reasoning } = resolveStreamToggles(options, elements);

    // Send stream request
    streamPort.postMessage(buildStartStreamPayload({
      content,
      messages,
      project: Project,
      provider: currentProvider,
      webSearch,
      reasoning,
      retry: options.retry === true
    }));
  });
}

function stopStreaming() {
  if (streamPort) {
    streamPort.disconnect();
    streamPort = null;
  }
  isStreaming = false;
  setSendStreamingState(elements.sendBtn, setChatStreamingState, false);
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
  if (msg?.type === 'models_updated') {
    loadModels();
  }
});


