(() => {
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
const IMAGE_CACHE_LIMIT_DEFAULT = 512, IMAGE_CACHE_LIMIT_MIN = 128, IMAGE_CACHE_LIMIT_MAX = 2048, IMAGE_CACHE_LIMIT_STEP = 64;
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
  || (() => 'openrouter');
const getProviderLabelSafe = providerUiUtils.getProviderLabelSafe
  || (() => 'OpenRouter');
const getProviderStorageKeySafe = providerUiUtils.getProviderStorageKeySafe
  || ((baseKey) => baseKey);
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
    ['openrouter'].forEach((provider) => {
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
    ['openrouter'].forEach((provider) => {
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
const { generateId, formatRelativeTime, formatDate, truncateText, generateThreadTitle, formatBytes, buildStorageLabel, escapeHtml, getImageExtension, sanitizeFilename } = resolveProjectsModule('projectsBasicUtils', './projects-basic-utils.js');
const { downloadImage, openImageLightbox, hydrateImageCards } = resolveProjectsModule('projectsImageUtils', './projects-image-utils.js');
const { buildEmptyThreadListHtml, buildThreadListHtml } = resolveProjectsModule('projectsThreadListUtils', './projects-thread-list-utils.js');
const { buildProjectCardHtml } = resolveProjectsModule('projectsCardsUtils', './projects-cards-utils.js');
const { getFullThreadMessages, buildExportPdfHtml, buildThreadExportHtml } = resolveProjectsModule('projectsExportUtils', './projects-export-utils.js');
const { getIndexedDbStorageUsage, estimateItemSize, normalizeThreadProjectId, ensureThreadMessage, buildThreadRecordForStorage, normalizeLegacyThreadsPayload } = resolveProjectsModule('projectsStorageUtils', './projects-storage-utils.js');
const { createProjectRecord, applyProjectUpdate, createThreadRecord, applyThreadUpdate, appendMessageToThread: appendMessageToThreadData } = resolveProjectsModule('projectsDataUtils', './projects-data-utils.js');
const projectsStorageControllerUtils = resolveProjectsModule('projectsStorageControllerUtils', './projects-storage-controller-utils.js');
const projectsModalControllerUtils = resolveProjectsModule('projectsModalControllerUtils', './projects-modal-controller-utils.js');
const projectsEventsControllerUtils = resolveProjectsModule('projectsEventsControllerUtils', './projects-events-controller-utils.js');
const projectsSendControllerUtils = resolveProjectsModule('projectsSendControllerUtils', './projects-send-controller-utils.js');
const { applyViewSelection, getProjectsListVisibilityState, sortProjectsByUpdatedAt } = resolveProjectsModule('projectsViewUtils', './projects-view-utils.js');
const { getThreadListViewState } = resolveProjectsModule('projectsThreadViewUtils', './projects-thread-view-utils.js');
const { resolveProjectCardClickAction, resolveThreadItemClickAction } = resolveProjectsModule('projectsClickActionsUtils', './projects-click-actions-utils.js');
const { buildArchiveSectionHtml, toggleArchiveSectionInContainer } = resolveProjectsModule('projectsArchiveViewUtils', './projects-archive-view-utils.js');
const { shouldShowSummaryBadge, buildChatMessagesContainerHtml } = resolveProjectsModule('projectsChatViewUtils', './projects-chat-view-utils.js');
const { resolveChatMessageClickAction } = resolveProjectsModule('projectsChatClickUtils', './projects-chat-click-utils.js');
const { closeProjectsExportMenus, toggleProjectsExportMenu } = resolveProjectsModule('projectsExportMenuUtils', './projects-export-menu-utils.js');
const { setModalVisibility, shouldCloseModalOnBackdropClick, isEscapeCloseEvent } = resolveProjectsModule('projectsModalUiUtils', './projects-modal-ui-utils.js');
const { renderProjectsSourcesSummary } = resolveProjectsModule('projectsSourcesSummaryUtils', './projects-sources-summary-utils.js');
const { buildProjectsMessageHtml } = resolveProjectsModule('projectsMessageRenderUtils', './projects-message-render-utils.js');
const { processProjectsAssistantSources, bindProjectsCopyButtons } = resolveProjectsModule('projectsMessagePostprocessUtils', './projects-message-postprocess-utils.js');
const applyMarkdownStyles = (typeof window !== 'undefined' && typeof window.applyMarkdownStyles === 'function')
  ? window.applyMarkdownStyles
  : ((markdown) => escapeHtml(markdown || ''));
const { initProjectFormState, populateProjectForm, clearProjectModelInput, syncProjectFormModel, updateProjectIconDisplay, filterProjectEmojis } = resolveProjectsModule('projectsFormUtils', './projects-form-utils.js');
const { getProjectDeleteModalContent, buildThreadDeleteModalContent } = resolveProjectsModule('projectsDeleteModalUtils', './projects-delete-modal-utils.js');
const { buildCreateProjectModalViewState, buildEditProjectModalViewState } = resolveProjectsModule('projectsProjectModalUtils', './projects-project-modal-utils.js');
const { applyProjectChatSettingsToElements } = resolveProjectsModule('projectsChatSettingsUtils', './projects-chat-settings-utils.js');
const { buildEmptyChatPanelState, buildActiveChatPanelState, applyChatPanelStateToElements } = resolveProjectsModule('projectsChatPanelUtils', './projects-chat-panel-utils.js');
const { showProjectsStorageWarning, hideProjectsStorageWarning } = resolveProjectsModule('projectsStorageWarningUtils', './projects-storage-warning-utils.js');
const { shouldUseCachedStorageUsage, buildStorageMeterViewState } = resolveProjectsModule('projectsStorageViewUtils', './projects-storage-view-utils.js');
const {
  getLiveWindowSize,
  splitMessagesForSummary,
  shouldSkipSummarization,
  getSummaryMinLength,
  appendArchivedMessages,
  buildProjectsContextData,
  buildContextBadgeLabel,
  getContextUsageCount,
  buildContextMessageHtml,
  getProjectsContextButtonState,
  getProjectsContextModalState,
  buildProjectsContextModalHtml
} = resolveProjectsModule('projectsContextUtils', './projects-context.js');
const {
  buildAssistantMessage,
  buildStreamMessages,
  getSourcesData,
  getTypingIndicatorHtml,
  getStreamErrorHtml,
  createStreamingAssistantMessage,
  updateAssistantFooter,
  resetStreamingUi
} = resolveProjectsModule('projectsStreamUtils', './projects-stream-utils.js');
const {
  renderStreamError: renderStreamErrorRuntime,
  retryStreamFromContext: retryStreamFromContextRuntime,
  createReasoningAppender,
  renderAssistantContent,
  buildStreamMeta,
  disconnectStreamPort
} = resolveProjectsModule('projectsStreamRuntimeUtils', './projects-stream-runtime-utils.js');
const {
  clearChatInput,
  createGeneratingImageMessage,
  resolveAssistantModelLabel,
  buildStreamContext,
  setSendStreamingState
} = resolveProjectsModule('projectsMessageFlowUtils', './projects-message-flow-utils.js');
const { maybeSummarizeBeforeStreaming } = resolveProjectsModule('projectsSummarizationFlowUtils', './projects-summarization-flow-utils.js');
const { resolveStreamToggles, buildStartStreamPayload } = resolveProjectsModule('projectsStreamRequestUtils', './projects-stream-request-utils.js');
const { createStreamChunkState, applyContentChunk, applyReasoningChunk } = resolveProjectsModule('projectsStreamChunkUtils', './projects-stream-chunk-utils.js');
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
async function persistThreadToChatStore(thread) {
  return projectsStorageControllerUtils.persistThreadToChatStore(thread, {
    chatStore,
    normalizeThreadProjectId,
    buildThreadRecordForStorage,
    ensureThreadMessage
  });
}
async function loadProjects() {
  const projects = await projectsStorageControllerUtils.loadProjects({
    chatStore,
    getLocalStorage,
    storageKeys: STORAGE_KEYS,
    logger: console
  });
  let changed = false;
  const migrated = (Array.isArray(projects) ? projects : []).map((project) => {
    if (!project || typeof project !== 'object') return project;
    if (String(project.modelProvider || '').toLowerCase() !== 'naga') return project;
    changed = true;
    const nextModel = 'openai/gpt-4o-mini';
    return {
      ...project,
      modelProvider: 'openrouter',
      model: nextModel,
      modelDisplayName: nextModel
    };
  });
  if (changed) {
    await saveProjects(migrated);
  }

  return migrated;
}
async function saveProjects(projects) {
  return projectsStorageControllerUtils.saveProjects(projects, {
    chatStore,
    setLocalStorage,
    storageKeys: STORAGE_KEYS
  });
}
async function loadThreads(projectId = null) {
  return projectsStorageControllerUtils.loadThreads(projectId, {
    chatStore,
    getLocalStorage,
    storageKeys: STORAGE_KEYS,
    normalizeLegacyThreadsPayload,
    saveThreads,
    logger: console
  });
}
async function saveThreads(threads) {
  return projectsStorageControllerUtils.saveThreads(threads, {
    chatStore,
    setLocalStorage,
    storageKeys: STORAGE_KEYS,
    persistThreadToChatStore
  });
}
async function getThreadCount(projectId) {
  return projectsStorageControllerUtils.getThreadCount(projectId, { loadThreads });
}
async function createProject(data) {
  return projectsStorageControllerUtils.createProject(data, {
    loadProjects,
    saveProjects,
    createProjectRecord,
    generateId
  });
}
async function updateProject(id, data) {
  return projectsStorageControllerUtils.updateProject(id, data, {
    loadProjects,
    saveProjects,
    applyProjectUpdate
  });
}
async function deleteProject(id) {
  return projectsStorageControllerUtils.deleteProject(id, {
    loadProjects,
    saveProjects,
    loadThreads,
    saveThreads
  });
}
async function getProject(id) {
  return projectsStorageControllerUtils.getProject(id, { loadProjects });
}
async function createThread(projectId, title = 'New Thread') {
  return projectsStorageControllerUtils.createThread(projectId, title, {
    loadThreads,
    saveThreads,
    createThreadRecord,
    generateId
  });
}
async function updateThread(id, data) {
  return projectsStorageControllerUtils.updateThread(id, data, {
    loadThreads,
    saveThreads,
    applyThreadUpdate
  });
}
async function deleteThread(id) {
  return projectsStorageControllerUtils.deleteThread(id, { loadThreads, saveThreads });
}
async function getThread(id) {
  return projectsStorageControllerUtils.getThread(id, { loadThreads });
}
async function addMessageToThread(threadId, message) {
  return projectsStorageControllerUtils.addMessageToThread(threadId, message, {
    getThread,
    loadThreads,
    saveThreads,
    appendMessageToThreadData,
    generateThreadTitle
  });
}
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
  openrouter: new Set()
};
let ProjectRecentModelsByProvider = {
  openrouter: []
};
const elements = {};
function initElements() {
  Object.assign(elements, collectProjectsElements(document));
}
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
      renderStorageUsage._inflight = (async () => {
        const settings = await getLocalStorage([STORAGE_KEYS.IMAGE_CACHE_LIMIT_MB]);
        const quotaBytesOverride = normalizeImageCacheLimitMb(Number(settings?.[STORAGE_KEYS.IMAGE_CACHE_LIMIT_MB])) * 1024 * 1024;
        return getIndexedDbStorageUsage({
          getImageStoreStats: (typeof window.getImageStoreStats === 'function') ? window.getImageStoreStats : null,
          getChatStoreStats: (chatStore && typeof chatStore.getStats === 'function') ? (() => chatStore.getStats()) : null,
          chatStore, quotaBytesOverride
        });
      })().then((usage) => {
        renderStorageUsage._cachedUsage = usage;
        renderStorageUsage._lastUpdate = Date.now();
        return usage;
      }).finally(() => { renderStorageUsage._inflight = null; });
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
function openCreateProjectModal() {
  projectsModalControllerUtils.openCreateProjectModal({
    buildCreateProjectModalViewState,
    elements,
    setModalVisibility,
    setEditingProjectId: (value) => { editingProjectId = value; }
  });
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
  await projectsModalControllerUtils.openEditProjectModal(projectId, {
    getProject,
    buildEditProjectModalViewState,
    currentProvider,
    normalizeProviderSafe,
    buildCombinedModelIdSafe,
    getProjectModelLabel,
    elements,
    setModalVisibility,
    setEditingProjectId: (value) => { editingProjectId = value; }
  });
}
function closeProjectModal() {
  projectsModalControllerUtils.closeProjectModal({
    elements,
    setModalVisibility,
    setEditingProjectId: (value) => { editingProjectId = value; }
  });
}
async function handleProjectFormSubmit(e) {
  await projectsModalControllerUtils.handleProjectFormSubmit(e, {
    elements,
    buildProjectFormData,
    parseCombinedModelIdSafe,
    normalizeProviderSafe,
    buildModelDisplayName,
    showToast,
    getEditingProjectId: () => editingProjectId,
    updateProject,
    currentProjectId: () => currentProjectId,
    setCurrentProjectData: (value) => { currentProjectData = value; },
    updateChatModelIndicator,
    createProject,
    closeProjectModal,
    invalidateStorageUsageCache,
    renderProjectsList,
    renderStorageUsage
  });
}
async function openRenameModal(threadId) {
  await projectsModalControllerUtils.openRenameModal(threadId, {
    getThread,
    elements,
    setRenamingThreadId: (value) => { renamingThreadId = value; },
    setModalVisibility
  });
}
function closeRenameModal() {
  projectsModalControllerUtils.closeRenameModal({
    elements,
    setModalVisibility,
    setRenamingThreadId: (value) => { renamingThreadId = value; }
  });
}
async function handleRenameFormSubmit(e) {
  await projectsModalControllerUtils.handleRenameFormSubmit(e, {
    elements,
    showToast,
    getRenamingThreadId: () => renamingThreadId,
    updateThread,
    closeRenameModal,
    renderThreadList
  });
}
async function openDeleteModal(type, id) {
  await projectsModalControllerUtils.openDeleteModal(type, id, {
    setDeletingItem: (value) => { deletingItem = value; },
    getProject,
    getThreadCount,
    buildProjectDeleteModalContent,
    getThread,
    estimateItemSize,
    buildThreadDeleteModalContent,
    elements,
    setModalVisibility
  });
}
function closeDeleteModal() {
  projectsModalControllerUtils.closeDeleteModal({
    elements,
    setModalVisibility,
    setDeletingItem: (value) => { deletingItem = value; }
  });
}
async function handleDeleteConfirm() {
  await projectsModalControllerUtils.handleDeleteConfirm({
    getDeletingItem: () => deletingItem,
    deleteProject,
    showToast,
    currentProjectId: () => currentProjectId,
    showView,
    invalidateStorageUsageCache,
    renderProjectsList,
    deleteThread,
    currentThreadId: () => currentThreadId,
    setCurrentThreadId: (value) => { currentThreadId = value; },
    applyChatPanelStateToElements,
    elements,
    buildEmptyChatPanelState,
    renderThreadList,
    closeDeleteModal,
    renderStorageUsage
  });
}
async function loadModels() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_models' });
    if (response.ok && response.models) {
      ProjectModelMap = new Map(response.models.map((model) => [model.id, model]));
      const [localItems, syncItems] = await Promise.all([
        getLocalStorage(['or_recent_models']),
        chrome.storage.sync.get(['or_favorites'])
      ]);
      ProjectFavoriteModelsByProvider = {
        openrouter: new Set(syncItems.or_favorites || [])
      };
      ProjectRecentModelsByProvider = {
        openrouter: localItems.or_recent_models || []
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
function setupEmojiPicker() {
  projectsEventsControllerUtils.setupEmojiPicker({
    elements,
    buildEmojiButtonsHtml,
    PROJECT_EMOJIS: Project_EMOJIS,
    shouldCloseEmojiGridOnDocumentClick
  });
}
function bindEvents() {
  const imageModeState = { changed: false };
  projectsEventsControllerUtils.bindEvents({
    elements,
    openCreateProjectModal,
    openOptionsPage: () => chrome.runtime.openOptionsPage(),
    closeProjectModal,
    handleProjectFormSubmit,
    closeRenameModal,
    handleRenameFormSubmit,
    closeDeleteModal,
    handleDeleteConfirm,
    hideStorageWarning,
    showView,
    renderProjectsList,
    currentProjectId: () => currentProjectId,
    openEditProjectModal,
    createNewThread,
    imageModeState,
    getImageModeEnabled: () => imageModeEnabled,
    setImageModeEnabled: (value) => { imageModeEnabled = Boolean(value); },
    getThread,
    currentThreadId: () => currentThreadId,
    currentProjectData: () => currentProjectData,
    getProject,
    setCurrentProjectData: (value) => { currentProjectData = value; },
    openProjectsContextModal,
    resolveChatMessageClickAction,
    toggleArchiveSection,
    toggleProjectsExportMenu,
    exportCurrentThread,
    closeExportMenus,
    shouldCloseModalOnBackdropClick,
    setModalVisibility,
    isEscapeCloseEvent
  });
}
function renderStreamError(ui, message, retryContext) {
  return projectsSendControllerUtils.renderStreamError({
    renderStreamErrorRuntime,
    getStreamErrorHtml,
    safeHtmlSetter: (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === 'function')
      ? window.safeHtml.setSanitizedHtml
      : null,
    getRetryInProgress: () => retryInProgress,
    getIsStreaming: () => isStreaming,
    retryStreamFromContext
  }, ui, message, retryContext);
}
async function retryStreamFromContext(retryContext, ui) {
  return projectsSendControllerUtils.retryStreamFromContext({
    retryStreamFromContextRuntime,
    getIsStreaming: () => isStreaming,
    getRetryInProgress: () => retryInProgress,
    setRetryInProgress: (value) => { retryInProgress = Boolean(value); },
    getThread,
    getProject,
    showToast: (typeof showToast === 'function') ? showToast : null,
    resetStreamingUi,
    getTokenBarStyle,
    elements,
    setChatStreamingState,
    setIsStreaming: (value) => { isStreaming = Boolean(value); },
    streamMessage,
    renderThreadList
  }, retryContext, ui);
}
async function sendImageMessage(content, Project) {
  return projectsSendControllerUtils.sendImageMessage({
    currentThreadId: () => currentThreadId,
    currentProjectId: () => currentProjectId,
    setIsStreaming: (value) => { isStreaming = Boolean(value); },
    elements,
    setChatStreamingState,
    addMessageToThread,
    clearChatInput,
    getThread,
    renderChatMessages,
    createGeneratingImageMessage,
    buildImageCard,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    showToast,
    generateId,
    putImageCacheEntry,
    resolveAssistantModelLabel,
    buildModelDisplayName,
    currentProvider: () => currentProvider,
    currentProjectData: () => currentProjectData,
    updateProjectsContextButton,
    renderThreadList
  }, content, Project);
}
async function sendMessage() {
  return projectsSendControllerUtils.sendMessage({
    elements,
    currentThreadId: () => currentThreadId,
    currentProjectId: () => currentProjectId,
    getIsStreaming: () => isStreaming,
    getProject,
    getImageModeEnabled: () => imageModeEnabled,
    addMessageToThread,
    clearChatInput,
    getThread,
    maybeSummarizeBeforeStreaming,
    summarizationDeps: {
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
    },
    renderChatMessages,
    buildStreamContext,
    currentProvider: () => currentProvider,
    setLastStreamContext: (value) => { lastStreamContext = value; },
    createStreamingAssistantMessage,
    getTokenBarStyle,
    setSendStreamingState,
    setChatStreamingState,
    setIsStreaming: (value) => { isStreaming = Boolean(value); },
    streamMessage,
    showToast,
    renderThreadList
  });
}
async function streamMessage(content, Project, thread, streamingUi, startTime, options = {}) {
  return projectsSendControllerUtils.streamMessage({
    createPort: () => chrome.runtime.connect({ name: 'streaming' }),
    setStreamPort: (port) => { streamPort = port; },
    getStreamPort: () => streamPort,
    createStreamChunkState,
    createReasoningAppender,
    safeHtmlSetter: (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === 'function')
      ? window.safeHtml.setSanitizedHtml
      : null,
    applyContentChunk,
    extractReasoningFromStreamChunk: (typeof extractReasoningFromStreamChunk === 'function')
      ? extractReasoningFromStreamChunk
      : null,
    renderAssistantContent,
    applyMarkdownStyles,
    elements,
    applyReasoningChunk,
    buildStreamMeta,
    buildModelDisplayName,
    currentProvider: () => currentProvider,
    addMessageToThread,
    currentThreadId: () => currentThreadId,
    buildAssistantMessage,
    getThread,
    currentProjectData: () => currentProjectData,
    updateProjectsContextButton,
    updateAssistantFooter,
    getTokenBarStyle,
    getSourcesData,
    makeSourceReferencesClickable,
    createSourcesIndicator,
    renderChatSourcesSummary,
    removeReasoningBubbles,
    disconnectStreamPort,
    renderStreamError,
    lastStreamContext: () => lastStreamContext,
    getIsStreaming: () => isStreaming,
    buildStreamMessages,
    resolveStreamToggles,
    buildStartStreamPayload
  }, content, Project, thread, streamingUi, startTime, options || {});
}
function stopStreaming() {
  projectsSendControllerUtils.stopStreaming({
    getStreamPort: () => streamPort,
    setStreamPort: (port) => { streamPort = port; },
    setIsStreaming: (value) => { isStreaming = Boolean(value); },
    setSendStreamingState,
    elements,
    setChatStreamingState,
    showToast
  });
}
function setupChatInput() {
  projectsEventsControllerUtils.setupChatInput({
    elements,
    sendMessage,
    stopStreaming
  });
}
async function init() {
  await projectsEventsControllerUtils.initProjectsApp({
    initElements,
    bindEvents,
    setupChatInput,
    setupEmojiPicker,
    initTheme,
    cleanupImageCache,
    loadProviderSetting,
    loadModels,
    renderProjectsList,
    renderStorageUsage,
    showView
  });
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
})();
