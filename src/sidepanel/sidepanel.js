(() => {
const UI_CONSTANTS = window.UI_CONSTANTS || {
  TEXTAREA_MAX_HEIGHT: 200,
  TEXTAREA_MIN_HEIGHT: 44,
  CHARS_PER_TOKEN: 4,
  TOKEN_BAR_MAX_TOKENS: 4000,
  COPY_FEEDBACK_DURATION: 500,
  DEBOUNCE_DELAY: 150
};
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
const { getAnswerStorage: getAnswerStorageSafe, getCurrentTabId: getCurrentTabIdSafe, getSidepanelThreadId: getSidepanelThreadIdSafe, buildAnswerCacheKey: buildAnswerCacheKeySafe } = sidepanelAnswerStoreModule;
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
const sidepanelStreamControllerModule = resolveSidepanelModuleSafe("sidepanelStreamControllerUtils", "./sidepanel-stream-controller-utils.js");
const sidepanelRuntimeEventsControllerModule = resolveSidepanelModuleSafe("sidepanelRuntimeEventsControllerUtils", "./sidepanel-runtime-events-controller-utils.js");
const sidepanelAnswerPersistenceControllerModule = resolveSidepanelModuleSafe("sidepanelAnswerPersistenceControllerUtils", "./sidepanel-answer-persistence-controller-utils.js");
const sidepanelModelSyncControllerModule = resolveSidepanelModuleSafe("sidepanelModelSyncControllerUtils", "./sidepanel-model-sync-controller-utils.js");
const sidepanelSetupControllerModule = resolveSidepanelModuleSafe("sidepanelSetupControllerUtils", "./sidepanel-setup-controller-utils.js");
const sidepanelBalanceControllerModule = resolveSidepanelModuleSafe("sidepanelBalanceControllerUtils", "./sidepanel-balance-controller-utils.js");
const sidepanelUiHelpersUtils = (typeof window !== "undefined" && window.sidepanelUiHelpersUtils)
  || (typeof require === "function" ? require("./sidepanel-ui-helpers-utils.js") : null)
  || {};
const {
  estimateTokens: estimateTokensFromUtils = (text) => Math.ceil(String(text || "").length / UI_CONSTANTS.CHARS_PER_TOKEN),
  updateAnswerVisibility: updateAnswerVisibilityFromUtils = () => {},
  showAnswerBox: showAnswerBoxFromUtils = () => {},
  setAnswerLoading: setAnswerLoadingFromUtils = () => {},
  renderSourcesSummary: renderSourcesSummaryFromUtils = () => {},
  exportAnswer: exportAnswerFromUtils = () => {},
  openImageInNewTab: openImageInNewTabFromUtils = () => {},
  downloadImage: downloadImageFromUtils = () => {},
  refreshContextVisualization: refreshContextVisualizationFromUtils = async () => {},
  autoResizeTextarea: autoResizeTextareaFromUtils = () => {},
  updateTokenEstimation: updateTokenEstimationFromUtils = () => {},
  showTypingIndicator: showTypingIndicatorFromUtils = () => {},
  hideTypingIndicator: hideTypingIndicatorFromUtils = () => {}
} = sidepanelUiHelpersUtils;
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
const sidepanelSetupDeps = {
  getLocalStorage,
  setupPanel,
  promptContainer,
  modelSection,
  modelStatusEl,
  setSidebarSetupRequired: (value) => { sidebarSetupRequired = Boolean(value); }
};
function updateSetupPanelVisibility(isReady) {
  if (sidepanelSetupControllerModule.updateSetupPanelVisibility) {
    return sidepanelSetupControllerModule.updateSetupPanelVisibility(isReady, sidepanelSetupDeps);
  }
  return null;
}
async function refreshSidebarSetupState() {
  if (sidepanelSetupControllerModule.refreshSidebarSetupState) {
    return sidepanelSetupControllerModule.refreshSidebarSetupState(sidepanelSetupDeps);
  }
  const localItems = await getLocalStorage(["or_api_key"]);
  const ready = Boolean(localItems?.or_api_key);
  updateSetupPanelVisibility(ready);
  return ready;
}
let modelDropdown = null;
let contextViz = null;
let activePort = null;
let streamStopRequested = false;
let streamStoppedByUser = false;
const sidepanelControllerState={get webSearchEnabled(){return webSearchEnabled;},set webSearchEnabled(v){webSearchEnabled=Boolean(v);},get reasoningEnabled(){return reasoningEnabled;},set reasoningEnabled(v){reasoningEnabled=Boolean(v);},get imageModeEnabled(){return imageModeEnabled;},set imageModeEnabled(v){imageModeEnabled=Boolean(v);},get currentProvider(){return currentProvider;},set currentProvider(v){currentProvider=normalizeProviderSafeFromProvider(v);},get combinedModels(){return combinedModels;},set combinedModels(v){combinedModels=Array.isArray(v)?v:[];},get modelMap(){return modelMap;},set modelMap(v){modelMap=v instanceof Map?v:new Map();},get favoriteModelsByProvider(){return favoriteModelsByProvider;},set favoriteModelsByProvider(v){favoriteModelsByProvider=v||favoriteModelsByProvider;},get recentModelsByProvider(){return recentModelsByProvider;},set recentModelsByProvider(v){recentModelsByProvider=v||recentModelsByProvider;},get selectedCombinedModelId(){return selectedCombinedModelId;},set selectedCombinedModelId(v){selectedCombinedModelId=v||null;},get sidebarSetupRequired(){return sidebarSetupRequired;},set sidebarSetupRequired(v){sidebarSetupRequired=Boolean(v);},get lastStreamContext(){return lastStreamContext;},set lastStreamContext(v){lastStreamContext=v||null;},get activePort(){return activePort;},set activePort(v){activePort=v||null;},get streamStopRequested(){return streamStopRequested;},set streamStopRequested(v){streamStopRequested=Boolean(v);},get streamStoppedByUser(){return streamStoppedByUser;},set streamStoppedByUser(v){streamStoppedByUser=Boolean(v);}};
const sidepanelModelSyncController=sidepanelModelSyncControllerModule.createModelSyncController({getLocalStorage,sendRuntimeMessage:(payload)=>chrome.runtime.sendMessage(payload),normalizeProviderSafe:normalizeProviderSafeFromProvider,buildCombinedModelIdSafe:buildCombinedModelIdSafeFromProvider,getSelectedCombinedModelId:()=>selectedCombinedModelId,setSelectedCombinedModelId:(value)=>{selectedCombinedModelId=value;},setCurrentProvider:(value)=>{currentProvider=value;},getModelMap:()=>modelMap,getModelDisplayName:getModelDisplayNameFromProvider,modelInput,modelStatusEl,applyImageModeForModel,storageOnChanged:chrome?.storage?.onChanged,windowRef:window,documentRef:document,logWarn:(...args)=>console.warn(...args)});
const syncSelectedModelFromConfig = sidepanelModelSyncController.syncSelectedModelFromConfig;
const registerStorageModelSyncListener = sidepanelModelSyncController.registerStorageModelSyncListener;
const registerVisibilityModelSync = sidepanelModelSyncController.registerVisibilityModelSync;
async function refreshContextVisualization(){return refreshContextVisualizationFromUtils(contextViz,(query)=>chrome.tabs.query(query),(payload)=>chrome.runtime.sendMessage(payload));}
function estimateTokens(text) { return estimateTokensFromUtils(text, UI_CONSTANTS.CHARS_PER_TOKEN); }
function updateAnswerVisibility(){return updateAnswerVisibilityFromUtils(answerEl,hasAnswerContentSafe,document.getElementById("clear-answer-btn"));}
function showAnswerBox(){return showAnswerBoxFromUtils(answerEl,document.getElementById("clear-answer-btn"));}
function setAnswerLoading(isLoading) { return setAnswerLoadingFromUtils(answerEl, isLoading); }
const sidepanelAnswerPersistenceController = sidepanelAnswerPersistenceControllerModule.createAnswerPersistenceController({
  answerEl,
  metaEl,
  chatStore,
  getSidepanelThreadId: getSidepanelThreadIdSafe,
  getAnswerStorage: getAnswerStorageSafe,
  getCurrentTabId: getCurrentTabIdSafe,
  buildAnswerCacheKey: buildAnswerCacheKeySafe,
  sidepanelProjectId: SIDEPANEL_PROJECT_ID,
  updateAnswerVisibility,
  logWarn: (...args) => console.warn(...args)
});
const setAnswerHtmlSafe = sidepanelAnswerPersistenceController.setAnswerHtmlSafe;
const clearAnswerHtml = sidepanelAnswerPersistenceController.clearAnswerHtml;
const scheduleAnswerPersist = sidepanelAnswerPersistenceController.scheduleAnswerPersist;
const restorePersistedAnswers = sidepanelAnswerPersistenceController.restorePersistedAnswers;
const registerAnswerObserver = sidepanelAnswerPersistenceController.registerAnswerObserver;
function renderSourcesSummary(answerItem, sources) {
  return renderSourcesSummaryFromUtils(answerItem, sources, {
    renderSourcesSummaryToElementSafe,
    getUniqueDomains,
    buildSourcesCountLabelSafe
  });
}
function exportAnswer(answerItem, format) {
  return exportAnswerFromUtils(answerItem, format, {
    getExportPayloadSafe,
    exportMarkdownFile: (typeof exportMarkdownFile === "function") ? exportMarkdownFile : null,
    exportDocx: (typeof exportDocx === "function") ? exportDocx : null,
    exportPdf: (typeof exportPdf === "function") ? exportPdf : null
  });
}
sidepanelEventsControllerModule.registerAnswerEventHandlers({
  answerEl,
  closeExportMenus: closeExportMenusSafe,
  exportAnswer,
  copyFeedbackDuration: UI_CONSTANTS.COPY_FEEDBACK_DURATION,
  showToast,
  openLinkInTab: (href) => chrome.tabs.create({ url: href })
});
function openImageInNewTab(dataUrl, imageId) {
  return openImageInNewTabFromUtils(dataUrl, imageId, {
    getImageViewerBaseUrl: getImageViewerBaseUrlFromUtils,
    buildImageOpenUrl,
    openTab: (...args) => chrome.tabs.create(...args),
    runtimeLastError: () => chrome.runtime && chrome.runtime.lastError,
    showToast
  });
}
function downloadImage(dataUrl, imageId, mimeType) {
  return downloadImageFromUtils(dataUrl, imageId, mimeType, getImageExtensionFromUtils);
}
async function refreshBalance() {
  if (sidepanelBalanceControllerModule.refreshBalance) {
    return sidepanelBalanceControllerModule.refreshBalance({
      balanceEl,
      sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
      logError: (...args) => console.error(...args)
    });
  }
  if (balanceEl) {
    balanceEl.textContent = "Error";
  }
}
if (balanceRefreshBtn) {
  balanceRefreshBtn.addEventListener("click", refreshBalance);
}
function buildSidepanelPromptDeps() {
  return {
    state: sidepanelControllerState, promptEl, askBtn, setPromptStreamingState, metaEl, showAnswerBox,
    answerEl, updateAnswerVisibility, answerSection,
    parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
    normalizeProviderSafe: normalizeProviderSafeFromProvider,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    buildImageCard: (typeof buildImageCard === "function") ? buildImageCard : null,
    putImageCacheEntry: (typeof putImageCacheEntry === "function") ? putImageCacheEntry : null,
    getImageCacheEntry: (typeof getImageCacheEntry === "function") ? getImageCacheEntry : null,
    openImageInNewTab, downloadImage, refreshBalance, sanitizePrompt: sanitizePromptSafe,
    clearPromptAfterSend: (typeof clearPromptAfterSend === "function") ? clearPromptAfterSend : null,
    generateImageImpl: (prompt) => generateImage(prompt),
    typingIndicator, showTypingIndicator, queryActiveTab: () => chrome.tabs.query({ active: true, currentWindow: true }),
    getProviderLabelSafe: getProviderLabelSafeFromProvider, hideTypingIndicator,
    buildStreamErrorHtml: buildStreamErrorHtmlSafe,
    getStreamingFallbackMessage: (typeof getStreamingFallbackMessage === "function") ? getStreamingFallbackMessage : null,
    extractReasoningFromStreamChunk: (typeof extractReasoningFromStreamChunk === "function") ? extractReasoningFromStreamChunk : null,
    extractSources, applyMarkdownStyles,
    safeHtmlSetter: (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function")
      ? window.safeHtml.setSanitizedHtml
      : null,
    modelMap, getModelDisplayName: getModelDisplayNameFromProvider, UI_CONSTANTS,
    removeReasoningBubbles: (typeof removeReasoningBubbles === "function") ? removeReasoningBubbles : null,
    makeSourceReferencesClickable, createSourcesIndicator, renderSourcesSummary, contextViz, escapeHtml, estimatedCostEl
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
  sidepanelStreamControllerModule.stopActiveStream?.({
    state: sidepanelControllerState,
    setPromptStreamingState,
    askBtn,
    metaEl,
    hideTypingIndicator,
    showToast
  });
});
const summarizeBtn = document.getElementById("summarizeBtn");
sidepanelSummarizeControllerModule.registerSummarizeHandler({
  summarizeBtn, askBtn, metaEl, answerEl, answerSection, showAnswerBox, showTypingIndicator, hideTypingIndicator,
  getProviderLabel: getProviderLabelSafeFromProvider,
  getCurrentProvider: () => currentProvider, getWebSearchEnabled: () => webSearchEnabled, getReasoningEnabled: () => reasoningEnabled,
  sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
  renderMarkdown: (element, text) => renderStreamingText(element, text),
  renderSourcesSummary, makeSourceReferencesClickable, createSourcesIndicator, extractSources,
  updateAnswerVisibility, refreshBalance, getContextViz: () => contextViz,
  getSelectedModel: () => (selectedCombinedModelId ? getModelDisplayNameFromProvider(modelMap.get(selectedCombinedModelId)) : null),
  getDefaultModel: (value) => value,
  estimateTokenBarPercentage: (tokens) => tokens ? Math.min((tokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) * 100, 100) : 0,
  escapeHtml, toast
});
function autoResizeTextarea() { return autoResizeTextareaFromUtils(promptEl, UI_CONSTANTS.TEXTAREA_MAX_HEIGHT); }
function updateTokenEstimation() { return updateTokenEstimationFromUtils(promptEl, estimatedCostEl, estimateTokens); }
const debouncedTokenEstimation = typeof debounce === 'function'
  ? debounce(updateTokenEstimation, UI_CONSTANTS.DEBOUNCE_DELAY)
  : updateTokenEstimation;
sidepanelEventsControllerModule.registerPromptEventHandlers({ promptEl, askQuestion, autoResizeTextarea, debouncedTokenEstimation });
sidepanelEventsControllerModule.registerGlobalShortcutHandlers({ promptEl, metaEl, findClearButton: () => document.getElementById("clear-answer-btn") });
async function loadModels() {
  return sidepanelModelControllerModule.loadModels({
    state: sidepanelControllerState, modelStatusEl,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload), getLocalStorage, loadFavoritesAndRecents,
    modelInput, modelDropdownRef: () => modelDropdown, ModelDropdownManager,
    parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
    normalizeProviderSafe: normalizeProviderSafeFromProvider, getModelDisplayName: getModelDisplayNameFromProvider,
    setLocalStorage, getProviderStorageKeySafe: getProviderStorageKeySafeFromProvider,
    buildCombinedRecentList, buildCombinedFavoritesList,
    setModelDropdown: (value) => { modelDropdown = value; }, applyImageModeForModel,
    buildCombinedModelIdSafe: buildCombinedModelIdSafeFromProvider
  });
}
async function loadToggleSettings() {
  return sidepanelModelControllerModule.loadToggleSettings({
    state: sidepanelControllerState, getLocalStorage, setLocalStorage,
    webSearchToggle, reasoningToggle, imageToggle, setImageToggleUi, setImageToggleTitle
  });
}
async function saveToggleSettings() {
  return sidepanelModelControllerModule.saveToggleSettings({ state: sidepanelControllerState, setLocalStorage });
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
function showTypingIndicator() { return showTypingIndicatorFromUtils(typingIndicator); }
function hideTypingIndicator() { return hideTypingIndicatorFromUtils(typingIndicator); }
document.addEventListener("DOMContentLoaded", async () => {
  registerStorageModelSyncListener();
  registerVisibilityModelSync();
  updateAnswerVisibility();
  await restorePersistedAnswers();
  registerAnswerObserver();
  if (typeof cleanupImageCache === "function") {
    cleanupImageCache().catch((e) => {
      console.warn("Failed to cleanup image cache:", e);
    });
  }
  loadToggleSettings();
  const providerReady = await refreshSidebarSetupState();
  await loadProviderSetting();
  if (providerReady) {
    refreshBalance();
    loadModels();
  } else if (balanceEl) {
    balanceEl.textContent = "–";
  }
  const contextVizContainer = document.getElementById('context-viz-section');
  if (contextVizContainer) {
    contextViz = new ContextVisualization(contextVizContainer);
    await refreshContextVisualization();
  }
});
sidepanelRuntimeEventsControllerModule.registerSidepanelRuntimeMessageHandlers?.({
  runtime: chrome.runtime,
  refreshSidebarSetupState,
  loadProviderSetting,
  loadModels,
  refreshBalance,
  refreshFavoritesOnly,
  balanceEl
});
})();
