// options.js

// Initialize theme on page load
if (typeof initTheme === 'function') {
  initTheme();
}

const openrouterApiKeyInput = document.getElementById("openrouterApiKey");
const nagaApiKeyInput = document.getElementById("nagaApiKey");
const nagaProvisioningKeyInput = document.getElementById("nagaProvisioningKey");
const enableOpenrouterToggle = document.getElementById("enable-openrouter");
const enableNagaToggle = document.getElementById("enable-naga");
const enableOpenrouterStatus = document.getElementById("enable-openrouter-status");
const enableNagaStatus = document.getElementById("enable-naga-status");
const modelSelect = document.getElementById("model");
const modelInput = document.getElementById("model-input");
const modelsStatusEl = document.getElementById("models-status");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const historyLimitInput = document.getElementById("history-limit");
const collapseOnSpacesToggle = document.getElementById("collapse-on-spaces");
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
  openrouter: new Set(),
  naga: new Set()
};
let recentModelsByProvider = {
  openrouter: [],
  naga: []
};
let selectedCombinedModelId = null;
let currentHistory = []; // Current history data for detail view
let modelDropdown = null; // ModelDropdownManager instance

// Undo state for history deletion
let pendingDeleteItem = null; // { item, timeout }
let pendingClearAllHistory = null; // { items, timeout }
const DEBUG_STREAM_KEY = "or_debug_stream";
const IMAGE_CACHE_LIMIT_KEY = "or_image_cache_limit_mb";
const IMAGE_CACHE_LIMIT_DEFAULT = 512;
const IMAGE_CACHE_LIMIT_MIN = 128;
const IMAGE_CACHE_LIMIT_MAX = 2048;
const IMAGE_CACHE_LIMIT_STEP = 64;
const PROVIDER_ENABLE_KEYS = {
  openrouter: "or_provider_enabled_openrouter",
  naga: "or_provider_enabled_naga"
};
const PROVIDER_ENABLE_DEFAULTS = {
  openrouter: true,
  naga: false
};
const PROVIDER_KEY_STORAGE = {
  openrouter: "or_api_key",
  naga: "naga_api_key"
};
const PROVIDER_LABELS = {
  openrouter: "OpenRouter",
  naga: "NagaAI"
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

function setupKeyVisibilityToggles() {
  if (typeof bindVisibilityToggles !== "function") return;
  bindVisibilityToggles(document);
}

// ---- Provider helpers ----
function normalizeProvider(providerId) {
  if (typeof normalizeProviderId === "function") {
    return normalizeProviderId(providerId);
  }
  return providerId === "naga" ? "naga" : "openrouter";
}

function getProviderLabelSafe(providerId) {
  if (typeof getProviderLabel === "function") {
    return getProviderLabel(providerId);
  }
  return normalizeProvider(providerId) === "naga" ? "NagaAI" : "OpenRouter";
}

function getProviderStorageKeySafe(baseKey, providerId) {
  if (typeof getProviderStorageKey === "function") {
    return getProviderStorageKey(baseKey, providerId);
  }
  return normalizeProvider(providerId) === "naga" ? `${baseKey}_naga` : baseKey;
}

function buildCombinedModelIdSafe(providerId, modelId) {
  if (typeof buildCombinedModelId === "function") {
    return buildCombinedModelId(providerId, modelId);
  }
  return `${normalizeProvider(providerId)}:${modelId}`;
}

function parseCombinedModelIdSafe(combinedId) {
  if (typeof parseCombinedModelId === "function") {
    return parseCombinedModelId(combinedId);
  }
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
}

function getModelDisplayName(model) {
  return model?.displayName || model?.name || model?.id || "";
}

function initModelDropdown() {
  if (modelDropdown) {
    modelDropdown.destroy();
    modelDropdown = null;
  }

  modelDropdown = new ModelDropdownManager({
    inputElement: modelInput,
    containerType: 'modal',
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
  const combined = [];
  ["openrouter", "naga"].forEach((provider) => {
    const favorites = favoriteModelsByProvider[provider] || new Set();
    favorites.forEach((modelId) => {
      combined.push(buildCombinedModelIdSafe(provider, modelId));
    });
  });
  return combined;
}

function buildCombinedRecentList() {
  const combined = [];
  ["openrouter", "naga"].forEach((provider) => {
    const recents = recentModelsByProvider[provider] || [];
    recents.forEach((modelId) => {
      const combinedId = buildCombinedModelIdSafe(provider, modelId);
      if (!combined.includes(combinedId)) {
        combined.push(combinedId);
      }
    });
  });
  return combined;
}

function loadFavoritesAndRecents(localItems, syncItems) {
  favoriteModelsByProvider = {
    openrouter: new Set(syncItems.or_favorites || []),
    naga: new Set(syncItems.or_favorites_naga || [])
  };

  recentModelsByProvider = {
    openrouter: localItems.or_recent_models || [],
    naga: localItems.or_recent_models_naga || []
  };
}

function loadSelectedModel(localItems) {
  const modelProvider = normalizeProvider(localItems.or_model_provider || localItems.or_provider);
  const rawModelId = localItems.or_model || "";
  selectedCombinedModelId = rawModelId
    ? buildCombinedModelIdSafe(modelProvider, rawModelId)
    : null;
}

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

function getStoredProviderEnabled(localItems, provider) {
  const key = PROVIDER_ENABLE_KEYS[provider];
  const stored = localItems[key];
  if (typeof stored === "boolean") {
    return stored;
  }
  return PROVIDER_ENABLE_DEFAULTS[provider];
}

function updateEnableStatus(provider, enabled) {
  const statusEl = provider === "openrouter" ? enableOpenrouterStatus : enableNagaStatus;
  if (!statusEl) return;
  statusEl.style.display = enabled ? "inline" : "none";
}

async function syncProviderToggleState(provider, apiKeyValue, localItems) {
  const hasKey = Boolean(apiKeyValue && apiKeyValue.trim().length);
  const toggle = provider === "openrouter" ? enableOpenrouterToggle : enableNagaToggle;
  if (!toggle) return;

  const storedEnabled = getStoredProviderEnabled(localItems, provider);
  const enabled = hasKey ? storedEnabled : false;

  toggle.disabled = !hasKey;
  toggle.checked = enabled;
  updateEnableStatus(provider, enabled);

  if (!hasKey && storedEnabled) {
    await setLocalStorage({ [PROVIDER_ENABLE_KEYS[provider]]: false });
  }
}

async function loadProviderCards(localItems) {
  if (openrouterApiKeyInput) {
    openrouterApiKeyInput.value = localItems.or_api_key || "";
  }
  if (nagaApiKeyInput) {
    nagaApiKeyInput.value = localItems.naga_api_key || "";
  }
  if (nagaProvisioningKeyInput) {
    nagaProvisioningKeyInput.value = localItems.naga_provisioning_key || "";
  }

  await syncProviderToggleState("openrouter", openrouterApiKeyInput?.value || "", localItems);
  await syncProviderToggleState("naga", nagaApiKeyInput?.value || "", localItems);
}

// ---- Load stored settings (API key, model, favorites, history limit) ----
// SECURITY FIX: API key now stored in chrome.storage.local (not synced across devices)
Promise.all([
  getLocalStorage([
    "or_api_key",
    "naga_api_key",
    "naga_provisioning_key",
    "or_model",
    "or_model_provider",
    "or_recent_models",
    "or_recent_models_naga",
    "or_history_limit",
    "or_debug_stream",
    "or_image_cache_limit_mb",
    "or_collapse_on_spaces",
    "or_provider_enabled_openrouter",
    "or_provider_enabled_naga"
  ]),
  chrome.storage.sync.get([
    "or_favorites",
    "or_favorites_naga"
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
  if (collapseOnSpacesToggle) {
    collapseOnSpacesToggle.checked = localItems.or_collapse_on_spaces !== false;
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

  promptHistoryEl.innerHTML = "";

  for (const item of history) {
    const div = document.createElement("div");
    div.className = "history-item";
    div.style.cssText = "background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;";

    const ts = new Date(item.createdAt).toLocaleString();
    const promptPreview = item.prompt.length > 80 ? item.prompt.slice(0, 80) + "…" : item.prompt;

    div.innerHTML = `
      <div class="history-preview">
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px;">${ts}</div>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 600;">Prompt:</div>
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; white-space: pre-wrap;">${escapeHtml(promptPreview)}</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Click to view full context</div>
      </div>
    `;

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
  const previewColumn = document.getElementById("history-preview-column");
  const detailContent = document.getElementById("history-detail-content");

  if (!previewColumn || !detailContent) return;

  const ts = new Date(item.createdAt).toLocaleString();

  detailContent.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 12px;">${ts}</div>

      <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 600;">Prompt</div>
      <div style="font-size: 13px; color: var(--color-text); margin-bottom: 16px; white-space: pre-wrap; background: var(--color-bg); padding: 16px; border-radius: 8px; line-height: 1.6;">${escapeHtml(item.prompt)}</div>

      <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 600;">Answer</div>
      <div style="font-size: 13px; color: var(--color-text); margin-bottom: 20px; white-space: pre-wrap; background: var(--color-bg); padding: 16px; border-radius: 8px; line-height: 1.6; max-height: 400px; overflow-y: auto;">${escapeHtml(item.answer || "No answer available")}</div>

      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="detail-copy-prompt-btn" style="padding: 8px 16px; background: var(--color-primary); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Prompt</button>
        <button class="detail-copy-answer-btn" style="padding: 8px 16px; background: var(--color-accent); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Answer</button>
        <button class="detail-delete-btn" style="padding: 8px 16px; background: var(--color-error); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Delete</button>
      </div>
    </div>
  `;

  // Show the preview column
  previewColumn.classList.add("active");

  // Add event listeners for buttons
  const copyPromptBtn = detailContent.querySelector(".detail-copy-prompt-btn");
  const copyAnswerBtn = detailContent.querySelector(".detail-copy-answer-btn");
  const deleteBtn = detailContent.querySelector(".detail-delete-btn");

  if (copyPromptBtn) {
    copyPromptBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.prompt);
        copyPromptBtn.textContent = "Copied!";
        setTimeout(() => {
          copyPromptBtn.textContent = "Copy Prompt";
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  }

  if (copyAnswerBtn) {
    copyAnswerBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.answer || "");
        copyAnswerBtn.textContent = "Copied!";
        setTimeout(() => {
          copyAnswerBtn.textContent = "Copy Answer";
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      // Commit any previous pending delete first
      if (pendingDeleteItem) {
        clearTimeout(pendingDeleteItem.timeout);
        await commitDeleteHistoryItem(pendingDeleteItem.item.id);
        pendingDeleteItem = null;
      }

      // Store item for potential undo
      const itemToDelete = item;

      // Remove from UI immediately
      const itemEl = document.querySelector(`.history-item[data-item-id="${item.id}"]`);
      if (itemEl) {
        itemEl.remove();
      }

      // Close detail panel
      previewColumn.classList.remove("active");

      // Show undo toast
      showToast('Prompt deleted', 'info', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            // Cancel the pending delete
            if (pendingDeleteItem) {
              clearTimeout(pendingDeleteItem.timeout);
              pendingDeleteItem = null;
            }
            // Reload history to restore item in UI
            await loadPromptHistory();
            toast.success('Prompt restored');
          }
        }
      });

      // Schedule actual deletion after 5 seconds
      pendingDeleteItem = {
        item: itemToDelete,
        timeout: setTimeout(async () => {
          await commitDeleteHistoryItem(itemToDelete.id);
          pendingDeleteItem = null;
        }, 5000)
      };
    });
  }
}

// Close detail panel
document.addEventListener("DOMContentLoaded", () => {
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
async function loadModels() {
  modelsStatusEl.textContent = "Loading models…";

  try {
    const res = await chrome.runtime.sendMessage({ type: "get_models" });

    if (!res?.ok) {
      throw new Error(res?.error || "Failed to load models");
    }

    combinedModels = (res.models || []).map((model) => ({
      id: model.id,
      rawId: model.rawId || model.id,
      provider: model.provider,
      displayName: getModelDisplayName(model),
      name: model.name || model.displayName || model.id
    }));
    modelMap = new Map(combinedModels.map((model) => [model.id, model]));

    // Update dropdown with models and favorites
    if (!modelDropdown) {
      initModelDropdown();
    }
    modelDropdown.setModels(combinedModels);
    modelDropdown.setFavorites(buildCombinedFavoritesList());
    modelDropdown.setRecentlyUsed(buildCombinedRecentList());

    // Set initial model value in input if we have a saved model
    if (selectedCombinedModelId && modelInput) {
      const selected = modelMap.get(selectedCombinedModelId);
      modelInput.value = selected ? getModelDisplayName(selected) : selectedCombinedModelId;
      modelSelect.value = selectedCombinedModelId;
    }

    if (!combinedModels.length) {
      modelsStatusEl.textContent = res.reason === "no_enabled_providers"
        ? "Enable at least one provider to load models."
        : "No models available.";
      modelsStatusEl.style.color = "var(--color-text-muted)";
    } else {
      modelsStatusEl.textContent = `✓ Loaded ${combinedModels.length} models.`;
      modelsStatusEl.style.color = "var(--color-success)";
    }
  } catch (e) {
    console.error("Failed to load models:", e);
    if (typeof e?.message === "string" && e.message.toLowerCase().includes("no api key")) {
      modelsStatusEl.textContent = "Set at least one API key to load models.";
    } else {
      modelsStatusEl.textContent = `Error: ${e.message}`;
    }
    modelsStatusEl.style.color = "var(--color-error)";
  }
}

// Auto-load models when page opens if API key exists
Promise.all([
  getLocalStorage([
    "or_api_key",
    "naga_api_key",
    "naga_provisioning_key",
    "or_provider_enabled_openrouter",
    "or_provider_enabled_naga"
  ])
]).then(([localItems]) => {
  const openrouterEnabled = localItems.or_provider_enabled_openrouter !== false;
  const nagaEnabled = Boolean(localItems.or_provider_enabled_naga);
  if ((openrouterEnabled && localItems.or_api_key) || (nagaEnabled && localItems.naga_api_key)) {
    // Small delay to ensure UI is ready
    setTimeout(() => loadModels(), 100);
  }
});

// ---- Save settings (key + model + history limit) ----
saveBtn.addEventListener("click", async () => {
  const combinedModelId = modelSelect.value.trim();
  const historyLimit = parseInt(historyLimitInput.value) || 20;
  const collapseOnSpaces = collapseOnSpacesToggle ? Boolean(collapseOnSpacesToggle.checked) : true;
  const imageCacheLimitMb = imageCacheLimitInput
    ? normalizeImageCacheLimitMb(parseInt(imageCacheLimitInput.value, 10))
    : IMAGE_CACHE_LIMIT_DEFAULT;

  // Model is optional - if not set, will use default from constants
  const dataToSave = {
    or_history_limit: historyLimit,
    or_collapse_on_spaces: collapseOnSpaces,
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
      or_favorites: Array.from(favoriteModelsByProvider.openrouter || []),
      or_favorites_naga: Array.from(favoriteModelsByProvider.naga || [])
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

async function updateProviderModelsAfterChange() {
  combinedModels = [];
  modelMap = new Map();
  modelSelect.innerHTML = "";
  modelsStatusEl.textContent = "";
  await loadModels();
  await notifyProviderSettingsUpdated("all");
}

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
      const localItems = await getLocalStorage([
        PROVIDER_ENABLE_KEYS[provider]
      ]);
      await syncProviderToggleState(provider, value, localItems);
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
    await setLocalStorage({ [PROVIDER_ENABLE_KEYS[provider]]: toggleEl.checked });
    updateEnableStatus(provider, toggleEl.checked);
    await updateProviderModelsAfterChange();
  });
}

wireProviderKeyInput("openrouter", openrouterApiKeyInput);
wireProviderKeyInput("naga", nagaApiKeyInput);
wireProviderEnableToggle("openrouter", enableOpenrouterToggle, openrouterApiKeyInput);
wireProviderEnableToggle("naga", enableNagaToggle, nagaApiKeyInput);

if (nagaProvisioningKeyInput) {
  let provisioningDebounce = null;
  nagaProvisioningKeyInput.addEventListener("input", () => {
    const value = nagaProvisioningKeyInput.value.trim();
    if (provisioningDebounce) {
      clearTimeout(provisioningDebounce);
    }
    provisioningDebounce = setTimeout(async () => {
      await setLocalStorage({ naga_provisioning_key: value });
      await notifyProviderSettingsUpdated("naga");
    }, 300);
  });
}

// ---- Export history functionality ----
function exportHistoryJSON() {
  if (currentHistory.length === 0) {
    toast.warning("No history to export");
    return;
  }

  const dataStr = JSON.stringify(currentHistory, null, 2);
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

  // CSV headers
  let csv = 'Timestamp,Prompt,Answer\n';

  // Add each history item
  currentHistory.forEach(item => {
    const timestamp = new Date(item.createdAt).toLocaleString();
    const prompt = `"${(item.prompt || '').replace(/"/g, '""')}"`;
    const answer = `"${(item.answer || '').replace(/"/g, '""')}"`;
    csv += `${timestamp},${prompt},${answer}\n`;
  });

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
  if (currentHistory.length === 0) {
    toast.info("History is already empty");
    return;
  }

  // Commit any pending single delete first
  if (pendingDeleteItem) {
    clearTimeout(pendingDeleteItem.timeout);
    await commitDeleteHistoryItem(pendingDeleteItem.item.id);
    pendingDeleteItem = null;
  }

  // Cancel any previous pending clear all
  if (pendingClearAllHistory) {
    clearTimeout(pendingClearAllHistory.timeout);
  }

  // Store current history for potential undo
  const itemsToDelete = [...currentHistory];
  const itemCount = itemsToDelete.length;

  // Clear UI immediately
  promptHistoryEl.innerHTML = "";

  // Close detail panel if open
  const previewColumn = document.getElementById("history-preview-column");
  if (previewColumn) {
    previewColumn.classList.remove("active");
  }

  // Show undo toast
  showToast(`${itemCount} items deleted`, 'info', {
    duration: 5000,
    action: {
      label: 'Undo',
      onClick: async () => {
        // Cancel the pending clear
        if (pendingClearAllHistory) {
          clearTimeout(pendingClearAllHistory.timeout);
          pendingClearAllHistory = null;
        }
        // Restore history in UI
        await loadPromptHistory();
        toast.success('History restored');
      }
    }
  });

  // Schedule actual deletion after 5 seconds
  pendingClearAllHistory = {
    items: itemsToDelete,
    timeout: setTimeout(async () => {
      try {
        await setLocalStorage({ or_history: [] });
        currentHistory = [];
      } catch (e) {
        console.error("Error clearing history:", e);
      }
      pendingClearAllHistory = null;
    }, 5000)
  };
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
document.addEventListener("DOMContentLoaded", () => {
  loadPromptHistory();
  setupKeyVisibilityToggles();
});
