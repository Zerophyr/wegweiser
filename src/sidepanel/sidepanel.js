(() => {

// Import UI constants (if modules are supported, otherwise constants are global)
const UI_CONSTANTS = window.UI_CONSTANTS || {
  TEXTAREA_MAX_HEIGHT: 200,
  TEXTAREA_MIN_HEIGHT: 44,
  CHARS_PER_TOKEN: 4,
  TOKEN_BAR_MAX_TOKENS: 4000,
  COPY_FEEDBACK_DURATION: 500,
  DEBOUNCE_DELAY: 150
};

// Initialize theme on page load
if (typeof initTheme === 'function') {
  initTheme();
}

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
// Keep key names in sidepanel.js for storage-key regression tests.
const SIDEPANEL_TOGGLE_STORAGE_KEYS = ["or_web_search", "or_reasoning", "imageModeEnabled"];
const chatStore = (typeof window !== "undefined" && window.chatStore) ? window.chatStore : null;
const sidepanelModuleResolver = (typeof window !== "undefined" && window.sidepanelModuleResolver)
  || (typeof require === "function" ? require("./sidepanel-module-resolver.js") : null);
const resolveSidepanelModuleSafe = sidepanelModuleResolver?.resolveSidepanelModule
  || ((windowKey) => ((typeof window !== "undefined" && window && window[windowKey]) ? window[windowKey] : {}));
const SIDEPANEL_PROJECT_ID = "__sidepanel__";

const promptEl = document.getElementById("prompt");
const answerEl = document.getElementById("answer");
const answerSection = document.getElementById("answer-section");
const askBtn = document.getElementById("askBtn");
const metaEl = document.getElementById("meta");
const balanceEl = document.getElementById("balance");
const balanceRefreshBtn = document.getElementById("balance-refresh");
const modelInput = document.getElementById("model-input");
const modelStatusEl = document.getElementById("model-status");
const webSearchToggle = document.getElementById("web-search-toggle");
const reasoningToggle = document.getElementById("reasoning-toggle");
const imageToggle = document.getElementById("image-toggle");
const settingsIcon = document.getElementById("settings-icon");
const setupPanel = document.getElementById("setup-panel");
const setupOpenOptionsBtn = document.getElementById("setup-open-options");
const promptContainer = document.getElementById("prompt-container");
const modelSection = document.getElementById("model-section");
const typingIndicator = document.getElementById("typing-indicator");
const stopBtn = document.getElementById("stopBtn");
const estimatedCostEl = document.getElementById("estimated-cost");

function setPromptStreamingState(isStreaming) {
  if (typeof setStreamingUi === "function") {
    setStreamingUi({
      container: promptContainer,
      input: promptEl,
      stopButton: stopBtn,
      isStreaming
    });
    return;
  }
  if (promptEl) {
    promptEl.disabled = Boolean(isStreaming);
  }
  if (stopBtn) {
    stopBtn.style.display = isStreaming ? "inline-flex" : "none";
  }
}

let webSearchEnabled = false;
let reasoningEnabled = false;
let imageModeEnabled = false;

let currentProvider = "openrouter";
let combinedModels = [];
let modelMap = new Map();
let favoriteModelsByProvider = {
  openrouter: new Set()
};
let recentModelsByProvider = {
  openrouter: []
};
let selectedCombinedModelId = null;
let sidebarSetupRequired = false;
let lastStreamContext = null;

const sidepanelProviderModule = resolveSidepanelModuleSafe("sidepanelProviderUtils", "./sidepanel-provider.js");
const {
  normalizeProviderSafe: normalizeProviderSafeFromProvider,
  getProviderLabelSafe: getProviderLabelSafeFromProvider,
  getProviderStorageKeySafe: getProviderStorageKeySafeFromProvider,
  buildCombinedModelIdSafe: buildCombinedModelIdSafeFromProvider,
  parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
  getModelDisplayName: getModelDisplayNameFromProvider
} = sidepanelProviderModule;
const sidepanelStreamModule = resolveSidepanelModuleSafe("sidepanelStreamUtils", "./sidepanel-stream-utils.js");
const {
  buildStreamErrorHtml: buildStreamErrorHtmlSafe,
  sanitizePrompt: sanitizePromptSafe,
  getImageExtension: getImageExtensionFromUtils,
  getImageViewerBaseUrl: getImageViewerBaseUrlFromUtils
} = sidepanelStreamModule;
const sidepanelAnswerStoreModule = resolveSidepanelModuleSafe("sidepanelAnswerStoreUtils", "./sidepanel-answer-store-utils.js");
const { ANSWER_CACHE_KEY_PREFIX: ANSWER_CACHE_KEY_PREFIX_SAFE, getAnswerStorage: getAnswerStorageSafe, getCurrentTabId: getCurrentTabIdSafe, getSidepanelThreadId: getSidepanelThreadIdSafe, buildAnswerCacheKey: buildAnswerCacheKeySafe } = sidepanelAnswerStoreModule;
const sidepanelAnswerUiModule = resolveSidepanelModuleSafe("sidepanelAnswerUiUtils", "./sidepanel-answer-ui-utils.js");
const { hasAnswerContent: hasAnswerContentSafe, buildSourcesCountLabel: buildSourcesCountLabelSafe } = sidepanelAnswerUiModule;
const sidepanelExportModule = resolveSidepanelModuleSafe("sidepanelExportUtils", "./sidepanel-export-utils.js");
const { closeExportMenus: closeExportMenusSafe, getExportPayload: getExportPayloadSafe } = sidepanelExportModule;
const sidepanelSourcesSummaryModule = resolveSidepanelModuleSafe("sidepanelSourcesSummaryUtils", "./sidepanel-sources-summary-utils.js");
const { renderSourcesSummaryToElement: renderSourcesSummaryToElementSafe } = sidepanelSourcesSummaryModule;
const sidepanelPromptControllerModule = resolveSidepanelModuleSafe("sidepanelPromptControllerUtils", "./sidepanel-prompt-controller-utils.js");
const sidepanelModelControllerModule = resolveSidepanelModuleSafe("sidepanelModelControllerUtils", "./sidepanel-model-controller-utils.js");
const sidepanelEventsControllerModule = resolveSidepanelModuleSafe("sidepanelEventsControllerUtils", "./sidepanel-events-controller-utils.js");
const sidepanelSummarizeControllerModule = resolveSidepanelModuleSafe("sidepanelSummarizeControllerUtils", "./sidepanel-summarize-controller-utils.js");

function setImageToggleUi(enabled, disabled = false) {
  if (!imageToggle) return;
  imageToggle.classList.toggle("active", enabled);
  imageToggle.setAttribute("aria-pressed", enabled.toString());
  imageToggle.setAttribute("aria-disabled", disabled ? "true" : "false");
  imageToggle.classList.toggle("disabled", disabled);
}

function setImageToggleTitle(title) {
  if (!imageToggle) return;
  imageToggle.title = title;
}

async function applyImageModeForModel() {
  setImageToggleUi(imageModeEnabled, false);
  setImageToggleTitle("Enable Image Mode");
}

const buildCombinedFavoritesList = () => sidepanelProviderModule.buildCombinedFavoritesList(favoriteModelsByProvider);
const buildCombinedRecentList = () => sidepanelProviderModule.buildCombinedRecentList(recentModelsByProvider);

function loadFavoritesAndRecents(localItems, syncItems) {
  favoriteModelsByProvider = {
    openrouter: new Set(syncItems.or_favorites || [])
  };

  recentModelsByProvider = {
    openrouter: localItems.or_recent_models || []
  };
}

async function refreshFavoritesOnly() {
  try {
    const syncItems = await chrome.storage.sync.get(["or_favorites"]);
    favoriteModelsByProvider = {
      openrouter: new Set(syncItems.or_favorites || [])
    };

    if (modelDropdown) {
      modelDropdown.setFavorites(buildCombinedFavoritesList());
    }
  } catch (e) {
    console.warn("Failed to refresh favorites:", e);
  }
}

async function loadProviderSetting() {
  try {
    const stored = await getLocalStorage(["or_provider", "or_model_provider"]);
    currentProvider = normalizeProviderSafeFromProvider(stored.or_model_provider || stored.or_provider);
  } catch (e) {
    console.warn("Failed to load provider setting:", e);
  }
}

// setup panel
function isProviderReady(localItems) {
  const openrouterKey = typeof localItems.or_api_key === "string" ? localItems.or_api_key.trim() : "";
  return Boolean(openrouterKey);
}

function updateSetupPanelVisibility(isReady) {
  sidebarSetupRequired = !isReady;
  if (setupPanel) {
    setupPanel.style.display = isReady ? "none" : "flex";
  }
  if (promptContainer) {
    promptContainer.style.display = isReady ? "" : "none";
  }
  if (modelSection) {
    modelSection.style.display = isReady ? "" : "none";
  }
  if (!isReady && modelStatusEl) {
    modelStatusEl.textContent = "Add your OpenRouter API key in Options to load models.";
  }
}

async function refreshSidebarSetupState() {
  const localItems = await getLocalStorage([
    "or_api_key"
  ]);
  const ready = isProviderReady(localItems);
  updateSetupPanelVisibility(ready);
  return ready;
}
let modelDropdown = null;

let contextViz = null;

let activePort = null;
const sidepanelControllerState = {
  get webSearchEnabled() { return webSearchEnabled; },
  set webSearchEnabled(value) { webSearchEnabled = Boolean(value); },
  get reasoningEnabled() { return reasoningEnabled; },
  set reasoningEnabled(value) { reasoningEnabled = Boolean(value); },
  get imageModeEnabled() { return imageModeEnabled; },
  set imageModeEnabled(value) { imageModeEnabled = Boolean(value); },
  get currentProvider() { return currentProvider; },
  set currentProvider(value) { currentProvider = normalizeProviderSafeFromProvider(value); },
  get combinedModels() { return combinedModels; },
  set combinedModels(value) { combinedModels = Array.isArray(value) ? value : []; },
  get modelMap() { return modelMap; },
  set modelMap(value) { modelMap = value instanceof Map ? value : new Map(); },
  get favoriteModelsByProvider() { return favoriteModelsByProvider; },
  set favoriteModelsByProvider(value) { favoriteModelsByProvider = value || favoriteModelsByProvider; },
  get recentModelsByProvider() { return recentModelsByProvider; },
  set recentModelsByProvider(value) { recentModelsByProvider = value || recentModelsByProvider; },
  get selectedCombinedModelId() { return selectedCombinedModelId; },
  set selectedCombinedModelId(value) { selectedCombinedModelId = value || null; },
  get sidebarSetupRequired() { return sidebarSetupRequired; },
  set sidebarSetupRequired(value) { sidebarSetupRequired = Boolean(value); },
  get lastStreamContext() { return lastStreamContext; },
  set lastStreamContext(value) { lastStreamContext = value || null; },
  get activePort() { return activePort; },
  set activePort(value) { activePort = value || null; }
};

async function refreshContextVisualization() {
  if (!contextViz) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id || 'default';
    const res = await chrome.runtime.sendMessage({
      type: "get_context_size",
      tabId
    });
    const size = res?.contextSize || 0;
    contextViz.update(size, 'assistant');
  } catch (e) {
    console.warn("Failed to refresh context visualization:", e);
    contextViz.update(0, 'assistant');
  }
}

// Token estimation using constants
function estimateTokens(text) {
  return Math.ceil(text.length / UI_CONSTANTS.CHARS_PER_TOKEN);
}

function updateAnswerVisibility() {
  const clearBtn = document.getElementById("clear-answer-btn");
  if (!hasAnswerContentSafe(answerEl.innerHTML)) {
    answerEl.classList.add("hidden");
    if (clearBtn) clearBtn.style.display = "none";
  } else {
    answerEl.classList.remove("hidden");
    if (clearBtn) clearBtn.style.display = "block";
  }
}

function showAnswerBox() {
  answerEl.classList.remove("hidden");
  const clearBtn = document.getElementById("clear-answer-btn");
  if (clearBtn) clearBtn.style.display = "block";
}

function setAnswerLoading(isLoading) {
  if (isLoading) {
    answerEl.classList.add("loading");
  } else {
    answerEl.classList.remove("loading");
  }
}

let answerPersistTimeout = null;

function setAnswerHtmlSafe(html) {
  if (!answerEl) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(answerEl, html || "");
    return;
  }
  answerEl.innerHTML = typeof html === "string" ? html : "";
}

function clearAnswerHtml() {
  if (!answerEl) return;
  answerEl.innerHTML = "";
}

function scheduleAnswerPersist() {
  if (answerPersistTimeout) {
    clearTimeout(answerPersistTimeout);
  }
  answerPersistTimeout = setTimeout(() => {
    answerPersistTimeout = null;
    persistAnswers().catch((e) => {
      console.warn("Failed to persist answers:", e);
    });
  }, 200);
}

async function persistAnswers() {
  if (!answerEl) return;
  const html = answerEl.innerHTML || "";
  const metaText = metaEl?.textContent || "";
  if (chatStore && typeof chatStore.putThread === "function") {
    const threadId = await getSidepanelThreadIdSafe();
    if (!html.trim()) {
      if (typeof chatStore.deleteThread === "function") {
        await chatStore.deleteThread(threadId);
      }
      return;
    }
    await chatStore.putThread({
      id: threadId,
      projectId: SIDEPANEL_PROJECT_ID,
      title: "Sidepanel",
      html,
      metaText,
      updatedAt: Date.now()
    });
    return;
  }
  const storage = getAnswerStorageSafe();
  if (!storage) return;
  const tabId = await getCurrentTabIdSafe();
  const key = buildAnswerCacheKeySafe(tabId);
  if (!html.trim()) {
    if (typeof storage.remove === "function") {
      await storage.remove([key]);
    } else {
      await storage.set({ [key]: null });
    }
    return;
  }
  await storage.set({ [key]: { html, metaText } });
}

async function restorePersistedAnswers() {
  if (!answerEl) return;
  if (chatStore && typeof chatStore.getThread === "function") {
    const threadId = await getSidepanelThreadIdSafe();
    const payload = await chatStore.getThread(threadId);
    if (payload?.html) {
      setAnswerHtmlSafe(payload.html);
      if (payload.metaText) {
        metaEl.textContent = payload.metaText;
      }
      updateAnswerVisibility();
    } else {
      clearAnswerHtml();
      updateAnswerVisibility();
    }
    return;
  }
  const storage = getAnswerStorageSafe();
  if (!storage) return;
  const tabId = await getCurrentTabIdSafe();
  const key = buildAnswerCacheKeySafe(tabId);
  const stored = await storage.get([key]);
  const payload = stored?.[key];
  if (payload?.html) {
    setAnswerHtmlSafe(payload.html);
    if (payload.metaText) {
      metaEl.textContent = payload.metaText;
    }
    updateAnswerVisibility();
  } else {
    clearAnswerHtml();
    updateAnswerVisibility();
  }
}

function renderSourcesSummary(answerItem, sources) {
  const summary = answerItem?.querySelector('.answer-sources-summary');
  renderSourcesSummaryToElementSafe(summary, sources, getUniqueDomains, buildSourcesCountLabelSafe);
}

function exportAnswer(answerItem, format) {
  if (!answerItem) return;
  const payload = getExportPayloadSafe(answerItem);
  const messages = payload.messages;

  if (format === 'markdown' && typeof exportMarkdownFile === 'function') {
    exportMarkdownFile(messages, 'answer.md');
  } else if (format === 'docx' && typeof exportDocx === 'function') {
    exportDocx(messages, 'answer.docx');
  } else if (format === 'pdf' && typeof exportPdf === 'function') {
    exportPdf(payload.html, 'answer');
  }
}

sidepanelEventsControllerModule.registerAnswerEventHandlers({
  answerEl,
  closeExportMenus: closeExportMenusSafe,
  exportAnswer,
  copyFeedbackDuration: UI_CONSTANTS.COPY_FEEDBACK_DURATION,
  showToast,
  openLinkInTab: (href) => chrome.tabs.create({ url: href })
});

// Note: escapeHtml() and validateUrl() are now in utils.js

function openImageInNewTab(dataUrl, imageId) {
  if (!dataUrl) return;
  const viewerBaseUrl = getImageViewerBaseUrlFromUtils();
  const openUrl = typeof buildImageOpenUrl === "function"
    ? buildImageOpenUrl(dataUrl, imageId || "", viewerBaseUrl)
    : dataUrl;

  chrome.tabs.create({ url: openUrl }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn("Failed to open image:", chrome.runtime.lastError.message);
      if (typeof showToast === "function") {
        showToast("Unable to open image in a new tab.", "error");
      }
    }
  });
}

function downloadImage(dataUrl, imageId, mimeType) {
  if (!dataUrl) return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `wegweiser-image-${imageId}.${getImageExtensionFromUtils(mimeType)}`;
  link.click();
}

async function refreshBalance() {
  if (!balanceEl) return;

  balanceEl.textContent = "Loading…";
  try {
    const res = await chrome.runtime.sendMessage({ type: "get_balance" });
    if (!res?.ok) {
      balanceEl.textContent = res?.error || "Error";
      return;
    }

    if (res.supported === false) {
      balanceEl.textContent = "Not supported";
      return;
    }

    const value = res.balance;
    if (value == null || Number.isNaN(value)) {
      balanceEl.textContent = "Unknown";
    } else {
      balanceEl.textContent = `$${value.toFixed(4)}`;
    }
  } catch (e) {
    console.error("Error refreshing balance:", e);
    balanceEl.textContent = "Error";
  }
}

if (balanceRefreshBtn) {
  balanceRefreshBtn.addEventListener("click", refreshBalance);
}

function buildSidepanelPromptDeps() {
  return {
    state: sidepanelControllerState,
    promptEl,
    askBtn,
    setPromptStreamingState,
    metaEl,
    showAnswerBox,
    answerEl,
    updateAnswerVisibility,
    answerSection,
    parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
    normalizeProviderSafe: normalizeProviderSafeFromProvider,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    buildImageCard: (typeof buildImageCard === "function") ? buildImageCard : null,
    putImageCacheEntry: (typeof putImageCacheEntry === "function") ? putImageCacheEntry : null,
    getImageCacheEntry: (typeof getImageCacheEntry === "function") ? getImageCacheEntry : null,
    openImageInNewTab,
    downloadImage,
    refreshBalance,
    sanitizePrompt: sanitizePromptSafe,
    clearPromptAfterSend: (typeof clearPromptAfterSend === "function") ? clearPromptAfterSend : null,
    generateImageImpl: (prompt) => generateImage(prompt),
    typingIndicator,
    showTypingIndicator,
    queryActiveTab: () => chrome.tabs.query({ active: true, currentWindow: true }),
    getProviderLabelSafe: getProviderLabelSafeFromProvider,
    hideTypingIndicator,
    buildStreamErrorHtml: buildStreamErrorHtmlSafe,
    getStreamingFallbackMessage: (typeof getStreamingFallbackMessage === "function") ? getStreamingFallbackMessage : null,
    extractReasoningFromStreamChunk: (typeof extractReasoningFromStreamChunk === "function") ? extractReasoningFromStreamChunk : null,
    extractSources,
    applyMarkdownStyles,
    safeHtmlSetter: (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function")
      ? window.safeHtml.setSanitizedHtml
      : null,
    modelMap,
    getModelDisplayName: getModelDisplayNameFromProvider,
    UI_CONSTANTS,
    removeReasoningBubbles: (typeof removeReasoningBubbles === "function") ? removeReasoningBubbles : null,
    makeSourceReferencesClickable,
    createSourcesIndicator,
    renderSourcesSummary,
    contextViz,
    escapeHtml,
    estimatedCostEl
  };
}

async function generateImage(prompt) {
  return sidepanelPromptControllerModule.generateImage(buildSidepanelPromptDeps(), prompt);
}

async function askQuestion() {
  try {
    return await sidepanelPromptControllerModule.askQuestion(buildSidepanelPromptDeps());
  } finally {
    if (!activePort) {
      askBtn.disabled = false;
      setPromptStreamingState(false);
    }
  }
}

askBtn.addEventListener("click", askQuestion);

stopBtn.addEventListener("click", () => {
  if (activePort) {
    activePort.disconnect();
    activePort = null;
    setPromptStreamingState(false);
    askBtn.disabled = false;
    metaEl.textContent = "⚠️ Generation stopped by user.";
    hideTypingIndicator();
    showToast('Generation stopped', 'info');
  }
});

const summarizeBtn = document.getElementById("summarizeBtn");

sidepanelSummarizeControllerModule.registerSummarizeHandler({
  summarizeBtn,
  askBtn,
  metaEl,
  answerEl,
  answerSection,
  showAnswerBox,
  showTypingIndicator,
  hideTypingIndicator,
  getProviderLabel: getProviderLabelSafeFromProvider,
  getCurrentProvider: () => currentProvider,
  getWebSearchEnabled: () => webSearchEnabled,
  getReasoningEnabled: () => reasoningEnabled,
  sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
  renderMarkdown: (element, text) => renderStreamingText(element, text),
  renderSourcesSummary,
  makeSourceReferencesClickable,
  createSourcesIndicator,
  extractSources,
  updateAnswerVisibility,
  refreshBalance,
  getContextViz: () => contextViz,
  getSelectedModel: () => (selectedCombinedModelId ? getModelDisplayNameFromProvider(modelMap.get(selectedCombinedModelId)) : null),
  getDefaultModel: (value) => value,
  estimateTokenBarPercentage: (tokens) => tokens ? Math.min((tokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) * 100, 100) : 0,
  escapeHtml,
  toast
});

function autoResizeTextarea() {
  // Reset height to auto to get the correct scrollHeight
  promptEl.style.height = 'auto';
  // Set height to scrollHeight, using constants for limits
  const newHeight = Math.min(promptEl.scrollHeight, UI_CONSTANTS.TEXTAREA_MAX_HEIGHT);
  promptEl.style.height = newHeight + 'px';
}

// Update token estimation display
function updateTokenEstimation() {
  const text = promptEl.value.trim();
  if (text.length > 0) {
    const tokens = estimateTokens(text);
    estimatedCostEl.textContent = `~${tokens} tokens`;
    estimatedCostEl.style.display = 'block';
  } else {
    estimatedCostEl.style.display = 'none';
  }
}

// Create debounced version for performance
const debouncedTokenEstimation = typeof debounce === 'function'
  ? debounce(updateTokenEstimation, UI_CONSTANTS.DEBOUNCE_DELAY)
  : updateTokenEstimation;

sidepanelEventsControllerModule.registerPromptEventHandlers({
  promptEl,
  askQuestion,
  autoResizeTextarea,
  debouncedTokenEstimation
});

sidepanelEventsControllerModule.registerGlobalShortcutHandlers({
  promptEl,
  metaEl,
  findClearButton: () => document.getElementById("clear-answer-btn")
});

async function loadModels() {
  return sidepanelModelControllerModule.loadModels({
    state: sidepanelControllerState,
    modelStatusEl,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    getLocalStorage,
    loadFavoritesAndRecents,
    modelInput,
    modelDropdownRef: () => modelDropdown,
    ModelDropdownManager,
    parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
    normalizeProviderSafe: normalizeProviderSafeFromProvider,
    getModelDisplayName: getModelDisplayNameFromProvider,
    setLocalStorage,
    getProviderStorageKeySafe: getProviderStorageKeySafeFromProvider,
    buildCombinedRecentList,
    buildCombinedFavoritesList,
    setModelDropdown: (value) => { modelDropdown = value; },
    applyImageModeForModel,
    buildCombinedModelIdSafe: buildCombinedModelIdSafeFromProvider
  });
}

async function loadToggleSettings() {
  return sidepanelModelControllerModule.loadToggleSettings({
    state: sidepanelControllerState,
    getLocalStorage,
    setLocalStorage,
    webSearchToggle,
    reasoningToggle,
    imageToggle,
    setImageToggleUi,
    setImageToggleTitle
  });
}

async function saveToggleSettings() {
  return sidepanelModelControllerModule.saveToggleSettings({
    state: sidepanelControllerState,
    setLocalStorage
  });
}

webSearchToggle.addEventListener("click", async () => {
  webSearchEnabled = !webSearchEnabled;
  webSearchToggle.classList.toggle("active");
  webSearchToggle.setAttribute('aria-pressed', webSearchEnabled.toString());
  await saveToggleSettings();
});

reasoningToggle.addEventListener("click", async () => {
  reasoningEnabled = !reasoningEnabled;
  reasoningToggle.classList.toggle("active");
  reasoningToggle.setAttribute('aria-pressed', reasoningEnabled.toString());
  await saveToggleSettings();
});

if (imageToggle) {
  imageToggle.addEventListener("click", async () => {
    imageModeEnabled = !imageModeEnabled;
    imageToggle.classList.toggle("active");
    imageToggle.setAttribute('aria-pressed', imageModeEnabled.toString());
    await saveToggleSettings();
  });
}

settingsIcon.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

if (setupOpenOptionsBtn) {
  setupOpenOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

const projectsBtn = document.getElementById("projects-btn");

sidepanelEventsControllerModule.registerProjectsButtonHandlers({
  projectsBtn,
  getLocalStorage,
  closeSidepanel: async () => {
    try {
      await chrome.runtime.sendMessage({ type: "close_sidepanel" });
    } catch (_) {}
    try {
      window.close();
    } catch (_) {}
  },
  getProjectsUrl: () => chrome.runtime.getURL("src/projects/projects.html"),
  queryTabsByUrl: (url) => chrome.tabs.query({ url }),
  focusExistingTab: async (tab) => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  },
  openNewTab: (url) => chrome.tabs.create({ url })
});

const clearAnswerBtn = document.getElementById("clear-answer-btn");
sidepanelEventsControllerModule.registerClearAnswerHandler({
  clearAnswerBtn,
  answerEl,
  clearAnswerHtml,
  updateAnswerVisibility,
  setAnswerHtml: setAnswerHtmlSafe,
  metaEl,
  scheduleAnswerPersist,
  showToast,
  clearContext: async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id || "default";
      await chrome.runtime.sendMessage({ type: "clear_context", tabId });
    } catch (e) {
      console.error("Error clearing context:", e);
    }
  },
  refreshContextVisualization: () => {
    if (contextViz) {
      contextViz.update(0, "user");
    }
  }
});

function showTypingIndicator() {
  typingIndicator.classList.add("active");
}

function hideTypingIndicator() {
  typingIndicator.classList.remove("active");
}

document.addEventListener("DOMContentLoaded", async () => {
  // Hide answer box initially if empty
  updateAnswerVisibility();
  await restorePersistedAnswers();

  if (answerEl && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      scheduleAnswerPersist();
    });
    observer.observe(answerEl, { childList: true, subtree: true, characterData: true });
  }

  if (typeof cleanupImageCache === "function") {
    cleanupImageCache().catch((e) => {
      console.warn("Failed to cleanup image cache:", e);
    });
  }

  // Load toggle settings
  loadToggleSettings();

  const providerReady = await refreshSidebarSetupState();
  await loadProviderSetting();
  if (providerReady) {
    refreshBalance();
    loadModels();
  } else if (balanceEl) {
    balanceEl.textContent = "–";
  }

  // Initialize context visualization
  const contextVizContainer = document.getElementById('context-viz-section');
  if (contextVizContainer) {
    contextViz = new ContextVisualization(contextVizContainer);
    await refreshContextVisualization();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "provider_settings_updated") {
    (async () => {
      const providerReady = await refreshSidebarSetupState();
      await loadProviderSetting();
      if (providerReady) {
        await loadModels();
        await refreshBalance();
      } else if (balanceEl) {
        balanceEl.textContent = "–";
      }
    })();
  }
  if (msg?.type === "models_updated") {
    loadModels();
  }
  if (msg?.type === "favorites_updated") {
    refreshFavoritesOnly();
  }
});
})();
