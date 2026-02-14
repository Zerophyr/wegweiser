(() => {
// options.js

// Initialize theme on page load
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
// encrypted-storage

// In-memory copies
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

// Undo state for history deletion
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

// ---- Provider helpers ----
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
  getModelDisplayName = (model) => model?.displayName || model?.name || model?.id || "",
  buildCombinedFavoritesList: combineFavoritesByProvider = (favoritesByProvider) => {
    const combined = [];
    ["openrouter"].forEach((provider) => {
      const favorites = favoritesByProvider[provider] || new Set();
      favorites.forEach((modelId) => combined.push(buildCombinedModelIdSafe(provider, modelId)));
    });
    return combined;
  },
  buildCombinedRecentList: combineRecentsByProvider = (recentsByProvider) => {
    const combined = [];
    ["openrouter"].forEach((provider) => {
      const recents = recentsByProvider[provider] || [];
      recents.forEach((modelId) => {
        const combinedId = buildCombinedModelIdSafe(provider, modelId);
        if (!combined.includes(combinedId)) combined.push(combinedId);
      });
    });
    return combined;
  }
} = providerUiUtils;
const optionsModelControllerUtils = (typeof window !== "undefined" && window.optionsModelControllerUtils) || {};
const optionsHistoryDetailControllerUtils = (typeof window !== "undefined" && window.optionsHistoryDetailControllerUtils) || {};
const optionsHistoryControllerUtils = (typeof window !== "undefined" && window.optionsHistoryControllerUtils) || {};
const optionsRuntimeEventsControllerUtils = (typeof window !== "undefined" && window.optionsRuntimeEventsControllerUtils) || {};

function initModelDropdown() {
  if (modelDropdown) {
    modelDropdown.destroy();
    modelDropdown = null;
  }

  modelDropdown = new ModelDropdownManager({
    inputElement: modelInput,
    containerType: 'modal',
    preferProvidedRecents: true,
    onModelSelect: async (modelId) => {
      selectedCombinedModelId = modelId;
      const selectedModel = modelMap.get(modelId);
      const displayName = selectedModel ? getModelDisplayName(selectedModel) : modelId;

      // Update the input field
      if (modelInput) {
        modelInput.value = displayName;
      }

      // Update hidden select for form compatibility
      if (modelSelect) {
        modelSelect.value = modelId;
      }

      return true; // Return true to indicate success
    },
    onToggleFavorite: async (modelId, isFavorite) => {
      const parsed = parseCombinedModelIdSafe(modelId);
      const provider = normalizeProvider(parsed.provider);
      const rawId = parsed.modelId;

      if (!favoriteModelsByProvider[provider]) {
        favoriteModelsByProvider[provider] = new Set();
      }

      if (isFavorite) {
        favoriteModelsByProvider[provider].add(rawId);
      } else {
        favoriteModelsByProvider[provider].delete(rawId);
      }

      await chrome.storage.sync.set({
        [getProviderStorageKeySafe("or_favorites", provider)]: Array.from(favoriteModelsByProvider[provider])
      });

      try {
        await chrome.runtime.sendMessage({ type: "favorites_updated" });
      } catch (e) {
        console.warn("Failed to notify favorites update:", e);
      }
    },
    onAddRecent: async (modelId) => {
      const parsed = parseCombinedModelIdSafe(modelId);
      const provider = normalizeProvider(parsed.provider);
      const rawId = parsed.modelId;

      const current = recentModelsByProvider[provider] || [];
      const next = [rawId, ...current.filter(id => id !== rawId)].slice(0, 5);
      recentModelsByProvider[provider] = next;

      await setLocalStorage({
        [getProviderStorageKeySafe("or_recent_models", provider)]: next
      });

      modelDropdown.setRecentlyUsed(buildCombinedRecentList());
    }
  });
}

function buildCombinedFavoritesList() {
  return combineFavoritesByProvider(favoriteModelsByProvider);
}

function buildCombinedRecentList() {
  return combineRecentsByProvider(recentModelsByProvider);
}

function loadFavoritesAndRecents(localItems, syncItems) {
  favoriteModelsByProvider = {
    openrouter: new Set(syncItems.or_favorites || [])
  };

  recentModelsByProvider = {
    openrouter: localItems.or_recent_models || []
  };
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

async function notifyProviderSettingsUpdated(providerId) {
  try {
    await chrome.runtime.sendMessage({
      type: "provider_settings_updated",
      provider: providerId
    });
  } catch (e) {
    console.warn("Failed to notify provider update:", e);
  }
}

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

// ---- Load stored settings (API key, model, favorites, history limit) ----
// SECURITY FIX: API key now stored in chrome.storage.local (not synced across devices)
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

// ---- Load and render prompt history ----
async function loadPromptHistory() {
  try {
    const res = await getLocalStorage(["or_history"]);
    const history = res.or_history || [];
    currentHistory = history; // Store for detail view
    renderPromptHistory(history);
  } catch (e) {
    console.error("Error loading history:", e);
    promptHistoryEl.textContent = "Error loading history.";
  }
}

function renderPromptHistory(history) {
  if (!history.length) {
    promptHistoryEl.textContent = "No prompt history yet.";
    return;
  }

  promptHistoryEl.replaceChildren();

  for (const item of history) {
    const div = document.createElement("div");
    div.className = "history-item";
    div.style.cssText = "background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;";

    const ts = new Date(item.createdAt).toLocaleString();
    const historyViewUtils = (typeof window !== "undefined" && window.optionsHistoryViewUtils) || {};
    const buildPreview = historyViewUtils.buildHistoryPreviewHtml || ((entry, timestamp, escapeFn) => `
      <div class="history-preview">
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px;">${timestamp}</div>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 600;">Prompt:</div>
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; white-space: pre-wrap;">${escapeFn((entry.prompt || "").length > 80 ? `${entry.prompt.slice(0, 80)}...` : (entry.prompt || ""))}</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Click to view full context</div>
      </div>
    `);

    setHtmlSafely(div, buildPreview(item, ts, escapeHtml));

    div.dataset.itemId = item.id;

    promptHistoryEl.appendChild(div);
  }

  // Add click functionality to show detail on right side
  document.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", (e) => {
      // Don't toggle if clicking on buttons
      if (e.target.tagName === "BUTTON") return;

      const itemId = item.dataset.itemId;
      const historyItem = currentHistory.find(h => h.id === itemId);
      if (historyItem) {
        showHistoryDetail(historyItem);

        // Highlight selected item
        document.querySelectorAll(".history-item").forEach(i => {
          i.style.background = "var(--color-bg)";
          i.style.borderColor = "var(--color-border)";
        });
        item.style.background = "var(--color-bg-secondary)";
        item.style.borderColor = "var(--color-primary)";
      }
    });
  });

}

// Show history detail in right column
function showHistoryDetail(item) {
  return optionsHistoryDetailControllerUtils.showOptionsHistoryDetail
    ? optionsHistoryDetailControllerUtils.showOptionsHistoryDetail(item, {
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

// Close detail panel
document.addEventListener("DOMContentLoaded", async () => {
  const closeBtn = document.getElementById("history-close-detail");
  const previewColumn = document.getElementById("history-preview-column");

  if (closeBtn && previewColumn) {
    closeBtn.addEventListener("click", () => {
      previewColumn.classList.remove("active");

      // Remove highlight from all items
      document.querySelectorAll(".history-item").forEach(i => {
        i.style.background = "var(--color-bg)";
        i.style.borderColor = "var(--color-border)";
      });
    });
  }
});

async function commitDeleteHistoryItem(id) {
  try {
    const res = await getLocalStorage(["or_history"]);
    const history = res.or_history || [];
    const filtered = history.filter(item => item.id !== id);
    await setLocalStorage({ or_history: filtered });
    // Update in-memory copy
    currentHistory = filtered;
  } catch (e) {
    console.error("Error deleting history item:", e);
  }
}

// ---- Load models from OpenRouter API ----

// Auto-load models when page opens if API key exists
Promise.all([
  getLocalStorage([
    "or_api_key"
  ])
]).then(([localItems]) => {
  if (localItems.or_api_key) {
    // Small delay to ensure UI is ready
    setTimeout(() => loadModels(), 100);
  }
});

// ---- Save settings (key + model + history limit) ----
saveBtn.addEventListener("click", async () => {
  const combinedModelId = modelSelect.value.trim();
  const historyLimit = parseInt(historyLimitInput.value) || 20;
  const collapseOnProjects = collapseOnProjectsToggle ? Boolean(collapseOnProjectsToggle.checked) : true;
  const imageCacheLimitMb = imageCacheLimitInput
    ? normalizeImageCacheLimitMb(parseInt(imageCacheLimitInput.value, 10))
    : IMAGE_CACHE_LIMIT_DEFAULT;

  // Model is optional - if not set, will use default from constants
  const dataToSave = {
    or_history_limit: historyLimit,
    or_collapse_on_projects: collapseOnProjects,
    [IMAGE_CACHE_LIMIT_KEY]: imageCacheLimitMb
  };

  // Only save model if one is selected
  if (combinedModelId) {
    const parsed = parseCombinedModelIdSafe(combinedModelId);
    dataToSave.or_model = parsed.modelId;
    dataToSave.or_model_provider = normalizeProvider(parsed.provider);
    dataToSave.or_provider = normalizeProvider(parsed.provider);
    selectedCombinedModelId = combinedModelId;
  }

  // SECURITY FIX: Store API key in local storage (not synced)
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
  if (!inputEl) return;
  let debounceId = null;
  inputEl.addEventListener("input", () => {
    const value = inputEl.value.trim();
    if (debounceId) {
      clearTimeout(debounceId);
    }
    debounceId = setTimeout(async () => {
      await saveProviderKey(provider, value);
      await syncProviderToggleState(provider, value);
      if (value.length === 0) {
        updateEnableStatus(provider, false);
      }
      await updateProviderModelsAfterChange();
    }, 300);
  });
}

function wireProviderEnableToggle(provider, toggleEl, inputEl) {
  if (!toggleEl) return;
  toggleEl.addEventListener("change", async () => {
    const hasKey = Boolean(inputEl?.value?.trim().length);
    if (!hasKey) {
      toggleEl.checked = false;
      toggleEl.disabled = true;
      updateEnableStatus(provider, false);
      return;
    }
    updateEnableStatus(provider, toggleEl.checked);
    await updateProviderModelsAfterChange();
  });
}

wireProviderKeyInput("openrouter", openrouterApiKeyInput);
wireProviderEnableToggle("openrouter", enableOpenrouterToggle, openrouterApiKeyInput);

// ---- Export history functionality ----
function exportHistoryJSON() {
  if (currentHistory.length === 0) {
    toast.warning("No history to export");
    return;
  }

  const historyUtils = (typeof window !== "undefined" && window.optionsHistoryUtils) || {};
  const buildJson = historyUtils.buildHistoryJson || ((history) => JSON.stringify(history, null, 2));
  const dataStr = buildJson(currentHistory);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `openrouter-history-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success(`Exported ${currentHistory.length} history items as JSON`);
}

function exportHistoryCSV() {
  if (currentHistory.length === 0) {
    toast.warning("No history to export");
    return;
  }

  const historyUtils = (typeof window !== "undefined" && window.optionsHistoryUtils) || {};
  const buildCsv = historyUtils.buildHistoryCsv || ((history) => {
    let csv = "timestamp,prompt,answer\n";
    history.forEach((item) => {
      const timestamp = new Date(item.createdAt).toISOString();
      const prompt = `"${(item.prompt || "").replace(/"/g, '""')}"`;
      const answer = `"${(item.answer || "").replace(/"/g, '""')}"`;
      csv += `"${timestamp}",${prompt},${answer}\n`;
    });
    return csv;
  });
  const csv = buildCsv(currentHistory);

  const dataBlob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `openrouter-history-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success(`Exported ${currentHistory.length} history items as CSV`);
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

// Export history button handlers
document.getElementById("export-history-btn")?.addEventListener("click", exportHistoryJSON);
document.getElementById("export-history-csv-btn")?.addEventListener("click", exportHistoryCSV);
document.getElementById("clear-all-history-btn")?.addEventListener("click", clearAllHistory);

// ---- Streaming debug log ----
if (debugStreamToggle) {
  debugStreamToggle.addEventListener("change", async () => {
    const enabled = Boolean(debugStreamToggle.checked);
    await setLocalStorage({ [DEBUG_STREAM_KEY]: enabled });
    if (downloadDebugLogBtn) {
      downloadDebugLogBtn.disabled = !enabled;
    }
    if (clearDebugLogBtn) {
      clearDebugLogBtn.disabled = !enabled;
    }
    try {
      await chrome.runtime.sendMessage({ type: "debug_set_enabled", enabled });
    } catch (e) {
      console.warn("Failed to notify debug toggle:", e);
    }
  });
}

if (downloadDebugLogBtn) {
  downloadDebugLogBtn.addEventListener("click", async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: "debug_get_stream_log" });
      if (!res?.ok) {
        throw new Error(res?.error || "Failed to fetch debug log");
      }
      const payload = {
        meta: res.meta || {},
        entries: res.entries || []
      };
      const dataStr = JSON.stringify(payload, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      const filename = typeof buildDebugLogFilename === "function"
        ? buildDebugLogFilename()
        : `wegweiser-stream-debug-${Date.now()}.json`;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${payload.entries.length} debug entries`);
    } catch (e) {
      console.error("Failed to download debug log:", e);
      toast.error("Failed to download debug log");
    }
  });
}

if (clearDebugLogBtn) {
  clearDebugLogBtn.addEventListener("click", async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: "debug_clear_stream_log" });
      if (!res?.ok) {
        throw new Error(res?.error || "Failed to clear debug log");
      }
      toast.success("Debug log cleared");
    } catch (e) {
      console.error("Failed to clear debug log:", e);
      toast.error("Failed to clear debug log");
    }
  });
}

// ---- Image storage cleanup ----
if (clearImageCacheBtn) {
  clearImageCacheBtn.addEventListener("click", async () => {
    try {
      if (typeof cleanupImageStore !== "function") {
        throw new Error("Image store unavailable");
      }
      await cleanupImageStore(Infinity);
      toast.success("Image cache cleared");
    } catch (e) {
      console.error("Failed to clear image cache:", e);
      toast.error("Failed to clear image cache");
    }
  });
}

if (imageCacheLimitInput) {
  imageCacheLimitInput.addEventListener("input", () => {
    const normalized = normalizeImageCacheLimitMb(parseInt(imageCacheLimitInput.value, 10));
    imageCacheLimitInput.value = normalized;
    updateImageCacheLimitLabel(normalized);
  });
}

// ---- Theme selector ----
const themeSelect = document.getElementById("theme-select");

// Load current theme
getLocalStorage(['or_theme']).then((result) => {
  if (result.or_theme && themeSelect) {
    themeSelect.value = result.or_theme;
  }
});

// Theme change handler
if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    const themeName = themeSelect.value;
    applyTheme(themeName);
    toast.success(`Theme changed to ${THEMES[themeName].name}`);
  });
}

// ---- Load history on page load ----
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
