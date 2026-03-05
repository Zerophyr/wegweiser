(() => {
if (typeof initTheme === 'function') {
  initTheme();
}
const openrouterApiKeyInput = document.getElementById("openrouterApiKey");
const enableOpenrouterToggle = document.getElementById("enable-openrouter");
const enableOpenrouterStatus = document.getElementById("enable-openrouter-status");
const modelSelect = document.getElementById("model");
const modelInput = document.getElementById("model-input");
const modelsStatusEl = document.getElementById("models-status");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const historyLimitInput = document.getElementById("history-limit");
const collapseOnProjectsToggle = document.getElementById("collapse-on-projects");
const promptHistoryEl = document.getElementById("prompt-history");
const debugStreamToggle = document.getElementById("debug-stream-toggle");
const downloadDebugLogBtn = document.getElementById("download-debug-log-btn");
const clearDebugLogBtn = document.getElementById("clear-debug-log-btn");
const clearImageCacheBtn = document.getElementById("clear-image-cache-btn");
const imageCacheLimitInput = document.getElementById("image-cache-limit");
const imageCacheLimitValue = document.getElementById("image-cache-limit-value");
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
let combinedModels = []; // [{ id, rawId, provider, displayName }]
let modelMap = new Map(); // combinedId -> model
let favoriteModelsByProvider = {
  openrouter: new Set()
};
let recentModelsByProvider = {
  openrouter: []
};
let selectedCombinedModelId = null;
let currentHistory = []; // Current history data for detail view
let modelDropdown = null; // ModelDropdownManager instance
let modelsLoadRequestId = 0;
let modelsLoadInFlight = false;
let lastSilentModelsLoadAt = 0;
let pendingDeleteItem = null; // { item, timeout }
let pendingClearAllHistory = null; // { items, timeout }
const DEBUG_STREAM_KEY = "or_debug_stream";
const IMAGE_CACHE_LIMIT_KEY = "or_image_cache_limit_mb";
const IMAGE_CACHE_LIMIT_DEFAULT = 512;
const IMAGE_CACHE_LIMIT_MIN = 128;
const IMAGE_CACHE_LIMIT_MAX = 2048;
const IMAGE_CACHE_LIMIT_STEP = 64;
const PROVIDER_KEY_STORAGE = {
  openrouter: "or_api_key"
};
const PROVIDER_LABELS = {
  openrouter: "OpenRouter"
};
function normalizeImageCacheLimitMb(value) {
  if (!Number.isFinite(value)) return IMAGE_CACHE_LIMIT_DEFAULT;
  const clamped = Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, value));
  const snapped = Math.round(clamped / IMAGE_CACHE_LIMIT_STEP) * IMAGE_CACHE_LIMIT_STEP;
  return Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, snapped));
}
function updateImageCacheLimitLabel(value) {
  if (!imageCacheLimitValue) return;
  imageCacheLimitValue.textContent = `${value} MB`;
}
function setHtmlSafely(element, html) {
  if (!element) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.textContent = typeof html === "string" ? html : "";
}
function setupKeyVisibilityToggles() {
  if (typeof bindVisibilityToggles !== "function") return;
  bindVisibilityToggles(document);
}
const providerUiUtils = (typeof window !== "undefined" && window.providerUiUtils) || {};
const {
  normalizeProviderSafe: normalizeProvider = () => "openrouter",
  getProviderLabelSafe = () => "OpenRouter",
  getProviderStorageKeySafe = (baseKey) => baseKey,
  buildCombinedModelIdSafe = (providerId, modelId) => `${normalizeProvider(providerId)}:${modelId}`,
  parseCombinedModelIdSafe = (combinedId) => {
    if (!combinedId || typeof combinedId !== "string") {
      return { provider: "openrouter", modelId: "" };
    }
    const splitIndex = combinedId.indexOf(":");
    if (splitIndex === -1) {
      return { provider: "openrouter", modelId: combinedId };
    }
    const provider = normalizeProvider(combinedId.slice(0, splitIndex));
    const modelId = combinedId.slice(splitIndex + 1);
    return { provider, modelId };
  },
  getModelDisplayName = (model) => model?.displayName || model?.name || model?.id || "",  buildCombinedFavoritesList: combineFavoritesByProvider = () => [],
  buildCombinedRecentList: combineRecentsByProvider = () => []
} = providerUiUtils;
const optionsModelControllerUtils = (typeof window !== "undefined" && window.optionsModelControllerUtils) || {};
const optionsModelDropdownControllerUtils = (typeof window !== "undefined" && window.optionsModelDropdownControllerUtils) || {};
const optionsHistoryFormatUtils = (typeof window !== "undefined" && window.optionsHistoryFormatUtils) || {};
const optionsHistoryDetailControllerUtils = (typeof window !== "undefined" && window.optionsHistoryDetailControllerUtils) || {};
const optionsHistoryRenderControllerUtils = (typeof window !== "undefined" && window.optionsHistoryRenderControllerUtils) || {};
const optionsHistoryControllerUtils = (typeof window !== "undefined" && window.optionsHistoryControllerUtils) || {};
const optionsRuntimeEventsControllerUtils = (typeof window !== "undefined" && window.optionsRuntimeEventsControllerUtils) || {};
const optionsNotifyUtils = (typeof window !== "undefined" && window.optionsNotifyUtils) || {};
const optionsPageActionsUtils = (typeof window !== "undefined" && window.optionsPageActionsUtils) || {};
const {
  exportHistoryJSON: exportHistoryJSONFromUtils = () => {},
  exportHistoryCSV: exportHistoryCSVFromUtils = () => {},
  wireProviderKeyInput: wireProviderKeyInputFromUtils = () => {},
  wireProviderEnableToggle: wireProviderEnableToggleFromUtils = () => {},
  registerDebugStreamHandlers: registerDebugStreamHandlersFromUtils = () => {},
  registerImageCacheHandlers: registerImageCacheHandlersFromUtils = () => {},
  registerThemeHandlers: registerThemeHandlersFromUtils = () => {}
} = optionsPageActionsUtils;
const notifyProviderSettingsUpdated = (providerId) => optionsNotifyUtils.notifyProviderSettingsUpdated
  ? optionsNotifyUtils.notifyProviderSettingsUpdated(chrome.runtime, providerId, console)
  : Promise.resolve();
const notifyModelsUpdated = () => optionsNotifyUtils.notifyModelsUpdated
  ? optionsNotifyUtils.notifyModelsUpdated(chrome.runtime, console)
  : Promise.resolve();
async function persistSelectedModelSelection(combinedModelId) {
  const parsed = parseCombinedModelIdSafe(combinedModelId);
  const provider = normalizeProvider(parsed.provider);
  const rawModelId = parsed.modelId;
  if (!rawModelId) return false;
  await setLocalStorage({
    or_model: rawModelId,
    or_model_provider: provider,
    or_provider: provider
  });
  try {
    await chrome.runtime.sendMessage({
      type: "set_model",
      model: rawModelId,
      provider
    });
  } catch (e) {
    console.warn("Failed to push selected model to background:", e);
  }
  await notifyModelsUpdated();
  return true;
}
function initModelDropdown() {
  modelDropdown = optionsModelDropdownControllerUtils.initModelDropdown
    ? optionsModelDropdownControllerUtils.initModelDropdown({
        existingDropdown: modelDropdown,
        destroyDropdown: () => { if (modelDropdown) { modelDropdown.destroy(); modelDropdown = null; } },
        modelInput,
        modelSelect,
        modelMap,
        selectedCombinedModelId,
        setSelectedCombinedModelId: (value) => { selectedCombinedModelId = value; },
        parseCombinedModelIdSafe,
        normalizeProvider,
        persistSelectedModelSelection,
        statusEl,
        getModelDisplayName,
        favoriteModelsByProvider,
        recentModelsByProvider,
        setFavoriteModelsByProvider: (value) => { favoriteModelsByProvider = value; },
        setRecentModelsByProvider: (value) => { recentModelsByProvider = value; },
        chromeStorageSync: chrome.storage.sync,
        getProviderStorageKeySafe,
        setLocalStorage,
        buildCombinedFavoritesListFn: optionsModelDropdownControllerUtils.buildCombinedFavoritesList,
        buildCombinedRecentListFn: optionsModelDropdownControllerUtils.buildCombinedRecentList,
        notifyFavoritesUpdated: async () => {
          try {
            await chrome.runtime.sendMessage({ type: "favorites_updated" });
          } catch (e) {
            console.warn("Failed to notify favorites update:", e);
          }
        },
        onRecentModelsUpdated: (nextRecents) => {
          recentModelsByProvider = nextRecents;
          if (modelDropdown) {
            modelDropdown.setRecentlyUsed(buildCombinedRecentList());
          }
        },
        ModelDropdownManager
      })
    : modelDropdown;
}
function buildCombinedFavoritesList() {
  return optionsModelDropdownControllerUtils.buildCombinedFavoritesList(favoriteModelsByProvider, buildCombinedModelIdSafe);
}
function buildCombinedRecentList() {
  return optionsModelDropdownControllerUtils.buildCombinedRecentList(recentModelsByProvider, buildCombinedModelIdSafe);
}
function loadFavoritesAndRecents(localItems, syncItems) {
  const result = optionsModelDropdownControllerUtils.loadFavoritesAndRecents(localItems, syncItems);
  favoriteModelsByProvider = result.favoriteModelsByProvider;
  recentModelsByProvider = result.recentModelsByProvider;
}
const optionsModelController = optionsModelControllerUtils.createOptionsModelController
  ? optionsModelControllerUtils.createOptionsModelController({
      getLocalStorage,
      buildCombinedModelIdSafe,
      getModelDisplayName,
      normalizeProvider,
      setSelectedCombinedModelId: (value) => { selectedCombinedModelId = value; },
      nextRequestId: () => { modelsLoadRequestId += 1; return modelsLoadRequestId; },
      getRequestId: () => modelsLoadRequestId,
      isModelInputFocused: () => document.activeElement === modelInput,
      getModelsStatusText: () => modelsStatusEl?.textContent || "",
      setModelsStatus: (textValue, colorValue) => {
        if (modelsStatusEl) {
          modelsStatusEl.textContent = textValue;
          modelsStatusEl.style.color = colorValue || "";
        }
      },
      setModelsLoadInFlight: (value) => { modelsLoadInFlight = Boolean(value); },
      getModelsLoadInFlight: () => modelsLoadInFlight,
      sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
      getModelDropdown: () => modelDropdown,
      initModelDropdown,
      buildCombinedFavoritesList,
      buildCombinedRecentList,
      getSelectedCombinedModelId: () => selectedCombinedModelId,
      getModelMap: () => modelMap,
      setModelMap: (value) => { modelMap = value instanceof Map ? value : new Map(); },
      setCombinedModels: (value) => { combinedModels = Array.isArray(value) ? value : []; },
      getCombinedModels: () => combinedModels,
      setModelInputValue: (value) => { if (modelInput) modelInput.value = value || ""; },
      setModelSelectValue: (value) => { if (modelSelect) modelSelect.value = value || ""; },
      logError: (...args) => console.error(...args),
      notifyProviderSettingsUpdated
    })
  : null;
let loadCachedModelsFromStorage = optionsModelController?.loadCachedModelsFromStorage || (async () => []);
let loadSelectedModel = optionsModelController?.loadSelectedModel || (() => {});
let loadModels = optionsModelController?.loadModels || (async () => {});
function updateEnableStatus(provider, enabled) {
  const statusEl = enableOpenrouterStatus;
  if (!statusEl) return;
  statusEl.style.display = enabled ? "inline" : "none";
}
async function syncProviderToggleState(provider, apiKeyValue) {
  const hasKey = Boolean(apiKeyValue && apiKeyValue.trim().length);
  const toggle = enableOpenrouterToggle;
  if (!toggle) return;
  toggle.disabled = true;
  toggle.checked = hasKey;
  updateEnableStatus(provider, hasKey);
}
async function loadProviderCards(localItems) {
  if (openrouterApiKeyInput) {
    openrouterApiKeyInput.value = localItems.or_api_key || "";
  }
  await syncProviderToggleState("openrouter", openrouterApiKeyInput?.value || "");
}
Promise.all([
  getLocalStorage([
    "or_api_key",
    "or_model",
    "or_model_provider",
    "or_recent_models",
    "or_history_limit",
    "or_debug_stream",
    "or_image_cache_limit_mb",
    "or_collapse_on_projects"
  ]),
  chrome.storage.sync.get([
    "or_favorites"
  ])
]).then(([localItems, syncItems]) => {
  loadProviderCards(localItems);
  loadFavoritesAndRecents(localItems, syncItems);
  loadSelectedModel(localItems);
  initModelDropdown();
  const debugEnabled = Boolean(localItems.or_debug_stream);
  if (debugStreamToggle) {
    debugStreamToggle.checked = debugEnabled;
  }
  if (downloadDebugLogBtn) {
    downloadDebugLogBtn.disabled = !debugEnabled;
  }
  if (clearDebugLogBtn) {
    clearDebugLogBtn.disabled = !debugEnabled;
  }
  if (collapseOnProjectsToggle) {
    collapseOnProjectsToggle.checked = localItems.or_collapse_on_projects !== false;
  }
});
async function loadPromptHistory() {
  return optionsHistoryRenderControllerUtils.loadPromptHistory
    ? optionsHistoryRenderControllerUtils.loadPromptHistory({
        getLocalStorage,
        setCurrentHistory: (value) => { currentHistory = Array.isArray(value) ? value : []; },
        renderPromptHistory,
        promptHistoryEl,
        logError: (...args) => console.error(...args)
      })
    : null;
}
function renderPromptHistory(history) {
  return optionsHistoryRenderControllerUtils.renderPromptHistory
    ? optionsHistoryRenderControllerUtils.renderPromptHistory({
        history,
        promptHistoryEl,
        getCurrentHistory: () => currentHistory,
        onSelectHistoryItem: showHistoryDetail,
        setHtmlSafely,
        escapeHtml,
        optionsHistoryFormatUtils,
        historyViewUtils: (typeof window !== "undefined" && window.optionsHistoryViewUtils) || {}
      })
    : null;
}
function showHistoryDetail(item) {
  return optionsHistoryRenderControllerUtils.showHistoryDetail
    ? optionsHistoryRenderControllerUtils.showHistoryDetail(item, {
        optionsHistoryDetailControllerUtils,
        setHtmlSafely,
        escapeHtml,
        getCurrentHistory: () => currentHistory,
        setCurrentHistory: (value) => { currentHistory = value; },
        getPendingDeleteItem: () => pendingDeleteItem,
        setPendingDeleteItem: (value) => { pendingDeleteItem = value; },
        getLocalStorage,
        setLocalStorage,
        loadPromptHistory,
        showToast,
        toastApi: toast
      })
    : null;
}
document.addEventListener("DOMContentLoaded", async () => {
  const closeBtn = document.getElementById("history-close-detail");
  const previewColumn = document.getElementById("history-preview-column");
  if (closeBtn && previewColumn) {
    closeBtn.addEventListener("click", () => {
      previewColumn.classList.remove("active");
      document.querySelectorAll(".history-item").forEach(i => {
        i.style.background = "var(--color-bg)";
        i.style.borderColor = "var(--color-border)";
      });
    });
  }
});
async function commitDeleteHistoryItem(id) {
  return optionsHistoryRenderControllerUtils.commitDeleteHistoryItem
    ? optionsHistoryRenderControllerUtils.commitDeleteHistoryItem({
        id,
        getLocalStorage,
        setLocalStorage,
        setCurrentHistory: (value) => { currentHistory = Array.isArray(value) ? value : []; },
        logError: (...args) => console.error(...args)
      })
    : null;
}
Promise.all([
  getLocalStorage([
    "or_api_key"
  ])
]).then(([localItems]) => {
  if (localItems.or_api_key) {
    setTimeout(() => loadModels(), 100);
  }
});
saveBtn.addEventListener("click", async () => {
  const combinedModelId = modelSelect.value.trim();
  const historyLimit = parseInt(historyLimitInput.value) || 20;
  const collapseOnProjects = collapseOnProjectsToggle ? Boolean(collapseOnProjectsToggle.checked) : true;
  const imageCacheLimitMb = imageCacheLimitInput
    ? normalizeImageCacheLimitMb(parseInt(imageCacheLimitInput.value, 10))
    : IMAGE_CACHE_LIMIT_DEFAULT;
  const dataToSave = {
    or_history_limit: historyLimit,
    or_collapse_on_projects: collapseOnProjects,
    [IMAGE_CACHE_LIMIT_KEY]: imageCacheLimitMb
  };
  if (combinedModelId) {
    const parsed = parseCombinedModelIdSafe(combinedModelId);
    dataToSave.or_model = parsed.modelId;
    dataToSave.or_model_provider = normalizeProvider(parsed.provider);
    dataToSave.or_provider = normalizeProvider(parsed.provider);
    selectedCombinedModelId = combinedModelId;
  }
  await Promise.all([
    setLocalStorage(dataToSave),
    chrome.storage.sync.set({
      or_favorites: Array.from(favoriteModelsByProvider.openrouter || [])
    })
  ]);
  statusEl.textContent = combinedModelId ? "Saved." : "Saved. (Using default model)";
  statusEl.style.color = "var(--color-success)";
  await loadModels();
  await notifyProviderSettingsUpdated("all");
  setTimeout(() => {
    statusEl.textContent = "";
    statusEl.style.color = "";
  }, 2500);
});
async function saveProviderKey(provider, value) {
  const key = PROVIDER_KEY_STORAGE[provider];
  await setLocalStorage({ [key]: value });
}
let updateProviderModelsAfterChange = optionsModelController?.updateProviderModelsAfterChange || (async () => {});
function wireProviderKeyInput(provider, inputEl) {
  return wireProviderKeyInputFromUtils({
    provider,
    inputEl,
    saveProviderKey,
    syncProviderToggleState,
    updateEnableStatus,
    updateProviderModelsAfterChange
  });
}
function wireProviderEnableToggle(provider, toggleEl, inputEl) {
  return wireProviderEnableToggleFromUtils({
    provider,
    toggleEl,
    inputEl,
    updateEnableStatus,
    updateProviderModelsAfterChange
  });
}
wireProviderKeyInput("openrouter", openrouterApiKeyInput);
wireProviderEnableToggle("openrouter", enableOpenrouterToggle, openrouterApiKeyInput);
function exportHistoryJSON() {
  const historyUtils = (typeof window !== "undefined" && window.optionsHistoryUtils) || {};
  return exportHistoryJSONFromUtils({ currentHistory, toast, historyUtils });
}
function exportHistoryCSV() {
  const historyUtils = (typeof window !== "undefined" && window.optionsHistoryUtils) || {};
  return exportHistoryCSVFromUtils({ currentHistory, toast, historyUtils });
}
async function clearAllHistory() {
  if (typeof optionsHistoryControllerUtils.clearAllHistory !== "function") return;
  await optionsHistoryControllerUtils.clearAllHistory({
    getCurrentHistory: () => currentHistory,
    setCurrentHistory: (value) => { currentHistory = Array.isArray(value) ? value : []; },
    getPendingDeleteItem: () => pendingDeleteItem,
    setPendingDeleteItem: (value) => { pendingDeleteItem = value; },
    getPendingClearAllHistory: () => pendingClearAllHistory,
    setPendingClearAllHistory: (value) => { pendingClearAllHistory = value; },
    commitDeleteHistoryItem,
    promptHistoryEl,
    getPreviewColumn: () => document.getElementById("history-preview-column"),
    loadPromptHistory,
    setLocalStorage,
    showToast,
    toast,
    logError: (...args) => console.error(...args)
  });
}
document.getElementById("export-history-btn")?.addEventListener("click", exportHistoryJSON);
document.getElementById("export-history-csv-btn")?.addEventListener("click", exportHistoryCSV);
document.getElementById("clear-all-history-btn")?.addEventListener("click", clearAllHistory);
registerDebugStreamHandlersFromUtils({
  debugStreamToggle,
  downloadDebugLogBtn,
  clearDebugLogBtn,
  setLocalStorage,
  debugStreamKey: DEBUG_STREAM_KEY,
  runtime: chrome.runtime,
  toast,
  buildDebugLogFilename: (typeof buildDebugLogFilename === "function") ? buildDebugLogFilename : null
});
registerImageCacheHandlersFromUtils({
  clearImageCacheBtn,
  imageCacheLimitInput,
  normalizeImageCacheLimitMb,
  updateImageCacheLimitLabel,
  cleanupImageStore: (typeof cleanupImageStore === "function") ? cleanupImageStore : null,
  toast
});
const themeSelect = document.getElementById("theme-select");
registerThemeHandlersFromUtils({
  themeSelect,
  getLocalStorage,
  applyTheme,
  THEMES,
  toast
});
document.addEventListener("DOMContentLoaded", async () => {
  loadPromptHistory();
  setupKeyVisibilityToggles();
});
optionsRuntimeEventsControllerUtils.registerOptionsRuntimeMessageHandlers?.({
  runtime: chrome.runtime,
  getModelsLoadInFlight: () => modelsLoadInFlight,
  getLastSilentModelsLoadAt: () => lastSilentModelsLoadAt,
  setLastSilentModelsLoadAt: (value) => { lastSilentModelsLoadAt = Number(value) || 0; },
  minReloadIntervalMs: 1500,
  loadModels
});
})();
