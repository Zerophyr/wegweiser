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
const projectsUiControllerUtils = resolveProjectsModule("projectsUiControllerUtils", "./projects-ui-controller-utils.js");
const projectsStorageBindingsUtils = resolveProjectsModule("projectsStorageBindingsUtils", "./projects-storage-bindings-utils.js");
const normalizeImageCacheLimitMb = projectsUiControllerUtils.normalizeImageCacheLimitMb
  || ((value) => Number.isFinite(value) ? value : IMAGE_CACHE_LIMIT_DEFAULT);
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
const getProjectModelLabel = (project) => projectsUiControllerUtils.getProjectModelLabel(project, { buildModelDisplayName });
const updateChatModelIndicator = (project) => projectsUiControllerUtils.updateChatModelIndicator(project, { elements, formatThreadModelLabel });
const setChatImageToggleState = (enabled, disabled = false) => projectsUiControllerUtils.setChatImageToggleState(enabled, disabled, { elements });
const applyProjectImageMode = (project) => projectsUiControllerUtils.applyProjectImageMode(project, { imageModeEnabled: () => imageModeEnabled, elements });
const loadProviderSetting = () => projectsUiControllerUtils.loadProviderSetting({
  getLocalStorage,
  normalizeProviderSafe,
  setCurrentProvider: (provider) => { currentProvider = provider; }
});
const Project_EMOJIS = projectsUiControllerUtils.PROJECT_EMOJIS || [];
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
const projectsRuntimeEventsControllerUtils = resolveProjectsModule('projectsRuntimeEventsControllerUtils', './projects-runtime-events-controller-utils.js');
const projectsSendControllerUtils = resolveProjectsModule('projectsSendControllerUtils', './projects-send-controller-utils.js');
const projectsModelControllerUtils = resolveProjectsModule('projectsModelControllerUtils', './projects-model-controller-utils.js');
const projectsStorageUsageControllerUtils = resolveProjectsModule('projectsStorageUsageControllerUtils', './projects-storage-usage-controller-utils.js');
const projectsThreadControllerUtils = resolveProjectsModule('projectsThreadControllerUtils', './projects-thread-controller-utils.js');
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
const updateProjectsContextButton = (thread, project) => projectsUiControllerUtils.updateProjectsContextButton(thread, project, {
  elements,
  getProjectsContextButtonState,
  maxContextMessages: MAX_CONTEXT_MESSAGES
});
const openProjectsContextModal = (thread, project) => projectsUiControllerUtils.openProjectsContextModal(thread, project, {
  buildProjectsContextModalHtml,
  truncateText,
  escapeHtml,
  maxContextMessages: MAX_CONTEXT_MESSAGES
});

const storageBindings = projectsStorageBindingsUtils.createProjectsStorageBindings({
  storageController: projectsStorageControllerUtils,
  chatStore,
  normalizeThreadProjectId,
  buildThreadRecordForStorage,
  ensureThreadMessage,
  getLocalStorage,
  setLocalStorage,
  storageKeys: STORAGE_KEYS,
  normalizeLegacyThreadsPayload,
  createProjectRecord,
  applyProjectUpdate,
  createThreadRecord,
  applyThreadUpdate,
  appendMessageToThreadData,
  generateThreadTitle,
  generateId,
  fallbackModel: "openai/gpt-4o-mini",
  logger: console
});
const {
  persistThreadToChatStore, loadProjects, saveProjects, loadThreads, saveThreads, getThreadCount,
  createProject, updateProject, deleteProject, getProject, createThread, updateThread,
  deleteThread, getThread, addMessageToThread
} = storageBindings;
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
    item.addEventListener('click', async (e) => {
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
        const threadId = action.threadId || item?.dataset?.threadId || null;
        if (threadId) {
          await openThread(threadId);
        }
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
const storageUsageController = projectsStorageUsageControllerUtils.createProjectsStorageUsageController({
  elements,
  storageKeys: STORAGE_KEYS,
  getLocalStorage,
  normalizeImageCacheLimitMb,
  getIndexedDbStorageUsage,
  getImageStoreStats: (typeof window.getImageStoreStats === "function") ? window.getImageStoreStats : null,
  getChatStoreStats: (chatStore && typeof chatStore.getStats === "function") ? (() => chatStore.getStats()) : null,
  chatStore,
  shouldUseCachedStorageUsage,
  buildStorageMeterViewState,
  buildStorageLabel,
  showStorageWarning,
  hideStorageWarning
});
const renderStorageUsage = storageUsageController.renderStorageUsage;
const invalidateStorageUsageCache = storageUsageController.invalidateStorageUsageCache;
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
const openThread = (threadId) => projectsThreadControllerUtils.openProjectThread(threadId, {
  getThread,
  loadThreads,
  showToast,
  setCurrentThreadId: (value) => { currentThreadId = value; },
  getProject,
  getCurrentProjectId: () => currentProjectId,
  setCurrentProjectData: (value) => { currentProjectData = value; },
  applyProjectChatSettings: (project) => applyProjectChatSettingsToElements(project, elements, applyProjectImageMode),
  updateChatModelIndicator,
  applyChatPanelStateToElements,
  buildActiveChatPanelState,
  elements,
  renderChatMessages,
  renderThreadList
});
const createNewThread = () => projectsThreadControllerUtils.createProjectThread({
  getCurrentProjectId: () => currentProjectId,
  getProject,
  setCurrentProjectData: (value) => { currentProjectData = value; },
  applyProjectChatSettings: (project) => applyProjectChatSettingsToElements(project, elements, applyProjectImageMode),
  createThread,
  renderThreadList,
  openThread,
  showToast
});
const toggleMenu = (button) => projectsThreadControllerUtils.toggleThreadMenu(button, {
  toggleProjectsDropdownMenu,
  documentRef: document
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
  if (typeof setStreamingUi === "function") {
    setStreamingUi({ container: elements.chatInputContainer, input: elements.chatInput, stopButton: elements.stopBtn, isStreaming });
    return;
  }
  if (elements.chatInput) elements.chatInput.disabled = Boolean(isStreaming);
  if (elements.stopBtn) elements.stopBtn.style.display = isStreaming ? "inline-flex" : "none";
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
function closeProjectModal() { projectsModalControllerUtils.closeProjectModal({ elements, setModalVisibility, setEditingProjectId: (value) => { editingProjectId = value; } }); }
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
function closeRenameModal() { projectsModalControllerUtils.closeRenameModal({ elements, setModalVisibility, setRenamingThreadId: (value) => { renamingThreadId = value; } }); }
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
function closeDeleteModal() { projectsModalControllerUtils.closeDeleteModal({ elements, setModalVisibility, setDeletingItem: (value) => { deletingItem = value; } }); }
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
  return projectsModelControllerUtils.loadProjectModels({
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    getLocalStorage,
    getSyncStorage: (keys) => chrome.storage.sync.get(keys),
    setLocalStorage,
    setSyncStorage: (payload) => chrome.storage.sync.set(payload),
    getProviderStorageKeySafe,
    normalizeProviderSafe,
    parseCombinedModelIdSafe,
    ModelDropdownManager,
    getProjectModelInput: () => elements.ProjectModelInput || document.getElementById("project-model-input"),
    getProjectModelDropdown: () => ProjectModelDropdown,
    setProjectModelDropdown: (value) => { ProjectModelDropdown = value; },
    getProjectModelMap: () => ProjectModelMap,
    setProjectModelMap: (value) => { ProjectModelMap = value; },
    getFavoritesByProvider: () => ProjectFavoriteModelsByProvider,
    setFavoritesByProvider: (value) => { ProjectFavoriteModelsByProvider = value; },
    getRecentsByProvider: () => ProjectRecentModelsByProvider,
    setRecentsByProvider: (value) => { ProjectRecentModelsByProvider = value; },
    buildCombinedFavoritesList,
    buildCombinedRecentList,
    getModelDisplayName,
    updateSelectedModelInput: (displayName, modelId) => {
      if (elements.ProjectModelInput) elements.ProjectModelInput.value = displayName;
      if (elements.ProjectModel) elements.ProjectModel.value = modelId;
    },
    renderModelSelectOptions: (models) => {
      if (!elements.ProjectModel) return;
      const currentCombinedId = elements.ProjectModel.value || "";
      elements.ProjectModel.innerHTML = '<option value="">Use default model</option>' + models.map((m) =>
        `<option value="${m.id}" ${m.id === currentCombinedId ? "selected" : ""}>${getModelDisplayName(m)}</option>`
      ).join("");
    },
    syncSelectedModelInputWithSelect: () => {
      if (!elements.ProjectModelInput || !elements.ProjectModel?.value) return;
      const selected = ProjectModelMap.get(elements.ProjectModel.value);
      if (selected) elements.ProjectModelInput.value = getModelDisplayName(selected);
    },
    applyProjectImageMode,
    getCurrentProjectData: () => currentProjectData,
    logError: (...args) => console.error(...args)
  });
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
// ---- Provider/model runtime listeners ----
projectsRuntimeEventsControllerUtils.registerProjectsRuntimeMessageHandlers?.({
  runtime: chrome.runtime,
  loadProviderSetting,
  loadModels,
  getProviderLabelSafe,
  showToast: (typeof showToast === 'function') ? showToast : null
});
})();
