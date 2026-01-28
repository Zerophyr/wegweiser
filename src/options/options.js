// options.js

// Initialize theme on page load
if (typeof initTheme === 'function') {
  initTheme();
}

const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const nagaProvisioningKeyInput = document.getElementById("nagaProvisioningKey");
const nagaProvisioningGroup = document.getElementById("naga-provisioning-group");
const providerSelect = document.getElementById("provider");
const modelSelect = document.getElementById("model");
const modelInput = document.getElementById("model-input");
const modelsStatusEl = document.getElementById("models-status");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const historyLimitInput = document.getElementById("history-limit");
const promptHistoryEl = document.getElementById("prompt-history");

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
let currentProvider = "openrouter";

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

function getProviderSettings(providerId) {
  const provider = normalizeProvider(providerId);
  const apiKeyPlaceholder = typeof getProviderApiKeyPlaceholder === "function"
    ? getProviderApiKeyPlaceholder(provider)
    : (provider === "naga" ? "ng-..." : "sk-or-...");
  return {
    id: provider,
    label: getProviderLabelSafe(provider),
    apiKeyKey: provider === "naga" ? "naga_api_key" : "or_api_key",
    provisioningKeyKey: provider === "naga" ? "naga_provisioning_key" : null,
    favoritesKey: getProviderStorageKeySafe("or_favorites", provider),
    recentModelsKey: getProviderStorageKeySafe("or_recent_models", provider),
    apiKeyPlaceholder
  };
}

function applyProviderSettings(providerId, localItems) {
  const settings = getProviderSettings(providerId);
  currentProvider = settings.id;

  if (providerSelect) {
    providerSelect.value = settings.id;
  }

  if (apiKeyLabel) {
    apiKeyLabel.textContent = `${settings.label} API key`;
  }
  if (apiKeyInput) {
    apiKeyInput.value = localItems[settings.apiKeyKey] || "";
    apiKeyInput.placeholder = settings.apiKeyPlaceholder;
  }
  if (nagaProvisioningGroup && nagaProvisioningKeyInput) {
    if (settings.id === "naga") {
      nagaProvisioningGroup.style.display = "block";
      nagaProvisioningKeyInput.value = localItems[settings.provisioningKeyKey] || "";
    } else {
      nagaProvisioningGroup.style.display = "none";
      nagaProvisioningKeyInput.value = "";
    }
  }

  if (localItems.or_history_limit) {
    historyLimitInput.value = localItems.or_history_limit;
  }
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

      await chrome.storage.local.set({
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

async function loadProviderState(providerId) {
  const settings = getProviderSettings(providerId);
  const localItems = await chrome.storage.local.get([
    "or_provider",
    "or_api_key",
    "naga_api_key",
    "naga_provisioning_key",
    "or_model",
    "or_model_provider",
    "or_recent_models",
    "or_recent_models_naga",
    "or_history_limit"
  ]);
  const syncItems = await chrome.storage.sync.get([
    "or_favorites",
    "or_favorites_naga"
  ]);

  applyProviderSettings(settings.id, localItems);
  loadFavoritesAndRecents(localItems, syncItems);
  loadSelectedModel(localItems);
  initModelDropdown();
}

// ---- Load stored settings (API key, model, favorites, history limit) ----
// SECURITY FIX: API key now stored in chrome.storage.local (not synced across devices)
Promise.all([
  chrome.storage.local.get([
    "or_provider",
    "or_api_key",
    "naga_api_key",
    "naga_provisioning_key",
    "or_model",
    "or_model_provider",
    "or_recent_models",
    "or_recent_models_naga",
    "or_history_limit"
  ]),
  chrome.storage.sync.get([
    "or_favorites",
    "or_favorites_naga"
  ])
]).then(([localItems, syncItems]) => {
  const provider = normalizeProvider(localItems.or_provider);
  applyProviderSettings(provider, localItems);
  loadFavoritesAndRecents(localItems, syncItems);
  loadSelectedModel(localItems);
  initModelDropdown();
});

// ---- Load and render prompt history ----
async function loadPromptHistory() {
  try {
    const res = await chrome.storage.local.get(["or_history"]);
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
    div.style.cssText = "background: #0f0f0f; border: 1px solid #27272a; border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;";

    const ts = new Date(item.createdAt).toLocaleString();
    const promptPreview = item.prompt.length > 80 ? item.prompt.slice(0, 80) + "…" : item.prompt;

    div.innerHTML = `
      <div class="history-preview">
        <div style="font-size: 11px; color: #71717a; margin-bottom: 4px;">${ts}</div>
        <div style="font-size: 13px; color: #d4d4d8; margin-bottom: 4px; font-weight: 600;">Prompt:</div>
        <div style="font-size: 12px; color: #d4d4d8; margin-bottom: 8px; white-space: pre-wrap;">${escapeHtml(promptPreview)}</div>
        <div style="font-size: 11px; color: #71717a; margin-bottom: 2px;">Click to view full context</div>
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
          i.style.background = "#0f0f0f";
          i.style.borderColor = "#27272a";
        });
        item.style.background = "#18181b";
        item.style.borderColor = "#3b82f6";
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
      <div style="font-size: 11px; color: #71717a; margin-bottom: 12px;">${ts}</div>

      <div style="font-size: 14px; color: #d4d4d8; margin-bottom: 8px; font-weight: 600;">Prompt</div>
      <div style="font-size: 13px; color: #e4e4e7; margin-bottom: 16px; white-space: pre-wrap; background: #0f0f0f; padding: 16px; border-radius: 8px; line-height: 1.6;">${escapeHtml(item.prompt)}</div>

      <div style="font-size: 14px; color: #d4d4d8; margin-bottom: 8px; font-weight: 600;">Answer</div>
      <div style="font-size: 13px; color: #e4e4e7; margin-bottom: 20px; white-space: pre-wrap; background: #0f0f0f; padding: 16px; border-radius: 8px; line-height: 1.6; max-height: 400px; overflow-y: auto;">${escapeHtml(item.answer || "No answer available")}</div>

      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="detail-copy-prompt-btn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Prompt</button>
        <button class="detail-copy-answer-btn" style="padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Answer</button>
        <button class="detail-delete-btn" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Delete</button>
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
        i.style.background = "#0f0f0f";
        i.style.borderColor = "#27272a";
      });
    });
  }
});

async function commitDeleteHistoryItem(id) {
  try {
    const res = await chrome.storage.local.get(["or_history"]);
    const history = res.or_history || [];
    const filtered = history.filter(item => item.id !== id);
    await chrome.storage.local.set({ or_history: filtered });
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

    modelsStatusEl.textContent = `✓ Loaded ${combinedModels.length} models.`;
    modelsStatusEl.style.color = "#10b981";
  } catch (e) {
    console.error("Failed to load models:", e);
    if (typeof e?.message === "string" && e.message.toLowerCase().includes("no api key")) {
      modelsStatusEl.textContent = "Set at least one API key to load models.";
    } else {
      modelsStatusEl.textContent = `Error: ${e.message}`;
    }
    modelsStatusEl.style.color = "#ef4444";
  }
}

// Auto-load models when page opens if API key exists
Promise.all([
  chrome.storage.local.get(["or_provider", "or_api_key", "naga_api_key", "naga_provisioning_key"])
]).then(([localItems]) => {
  if (localItems.or_api_key || localItems.naga_api_key) {
    // Small delay to ensure UI is ready
    setTimeout(() => loadModels(), 100);
  }
});

// ---- Save settings (key + model + history limit) ----
saveBtn.addEventListener("click", async () => {
  const settings = getProviderSettings(currentProvider);
  const apiKey = apiKeyInput.value.trim();
  const nagaProvisioningKey = nagaProvisioningKeyInput ? nagaProvisioningKeyInput.value.trim() : "";
  const combinedModelId = modelSelect.value.trim();
  const historyLimit = parseInt(historyLimitInput.value) || 20;

  // Model is optional - if not set, will use default from constants
  const dataToSave = {
    [settings.apiKeyKey]: apiKey,
    or_history_limit: historyLimit,
    or_provider: settings.id
  };
  if (settings.id === "naga") {
    dataToSave[settings.provisioningKeyKey] = nagaProvisioningKey;
  }

  // Only save model if one is selected
  if (combinedModelId) {
    const parsed = parseCombinedModelIdSafe(combinedModelId);
    dataToSave.or_model = parsed.modelId;
    dataToSave.or_model_provider = normalizeProvider(parsed.provider);
    selectedCombinedModelId = combinedModelId;
  }

  // SECURITY FIX: Store API key in local storage (not synced)
  await Promise.all([
    chrome.storage.local.set(dataToSave),
    chrome.storage.sync.set({
      [settings.favoritesKey]: Array.from(favoriteModelsByProvider[settings.id] || [])
    })
  ]);

  statusEl.textContent = combinedModelId ? "Saved." : "Saved. (Using default model)";
  statusEl.style.color = "#10b981";
  await loadModels();
  await notifyProviderSettingsUpdated(settings.id);
  setTimeout(() => {
    statusEl.textContent = "";
    statusEl.style.color = "";
  }, 2500);
});

// Reset models when API key changes.
apiKeyInput.addEventListener("change", () => {
  combinedModels = [];
  modelMap = new Map();
  modelSelect.innerHTML = "";
  modelsStatusEl.textContent = "";
});

// ---- Provider change ----
if (providerSelect) {
  providerSelect.addEventListener("change", async () => {
    const provider = normalizeProvider(providerSelect.value);
    currentProvider = provider;

    await chrome.storage.local.set({ or_provider: provider });
    try {
      await chrome.runtime.sendMessage({ type: "set_provider", provider });
    } catch (e) {
      console.warn("Failed to notify background of provider change:", e);
    }
    await notifyProviderSettingsUpdated(provider);

    const localItems = await chrome.storage.local.get([
      "or_provider",
      "or_api_key",
      "naga_api_key",
      "naga_provisioning_key",
      "or_history_limit"
    ]);
    applyProviderSettings(provider, localItems);
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
        await chrome.storage.local.set({ or_history: [] });
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

// ---- Theme selector ----
const themeSelect = document.getElementById("theme-select");

// Load current theme
chrome.storage.local.get(['or_theme']).then((result) => {
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
});
