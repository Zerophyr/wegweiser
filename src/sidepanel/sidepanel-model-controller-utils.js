// sidepanel-model-controller-utils.js - model dropdown and toggle persistence orchestration

async function loadModels(deps) {
  const {
    state,
    modelStatusEl,
    sendRuntimeMessage,
    getLocalStorage,
    loadFavoritesAndRecents,
    modelInput,
    modelDropdownRef,
    ModelDropdownManager,
    parseCombinedModelIdSafe,
    normalizeProviderSafe,
    getModelDisplayName,
    setLocalStorage,
    getProviderStorageKeySafe,
    buildCombinedRecentList,
    buildCombinedFavoritesList,
    setModelDropdown,
    applyImageModeForModel
  } = deps;

  try {
    if (state.sidebarSetupRequired) {
      modelStatusEl.textContent = "Enable a provider to load models.";
      return;
    }
    modelStatusEl.textContent = "Loading models...";
    const res = await sendRuntimeMessage({ type: "get_models" });
    if (!res?.ok) {
      modelStatusEl.textContent = res?.error || "Failed to load models";
      return;
    }

    state.combinedModels = res.models || [];
    state.modelMap = new Map(state.combinedModels.map((model) => [model.id, model]));

    const [localItems, syncItems] = await Promise.all([
      getLocalStorage(["or_recent_models", "or_recent_models_naga"]),
      chrome.storage.sync.get(["or_favorites", "or_favorites_naga"])
    ]);
    loadFavoritesAndRecents(localItems, syncItems);

    const resolvedModelInput = modelInput || document.getElementById("model-input");
    if (!resolvedModelInput) {
      modelStatusEl.textContent = "Model input unavailable.";
      return;
    }

    let dropdown = modelDropdownRef();
    if (!dropdown) {
      dropdown = new ModelDropdownManager({
        inputElement: resolvedModelInput,
        containerType: "sidebar",
        preferProvidedRecents: true,
        onModelSelect: async (modelId) => {
          const selectedModel = state.modelMap.get(modelId);
          const displayName = selectedModel ? getModelDisplayName(selectedModel) : modelId;
          const parsed = parseCombinedModelIdSafe(modelId);
          const provider = normalizeProviderSafe(parsed.provider);
          if (modelInput) modelInput.value = displayName;
          const setRes = await sendRuntimeMessage({
            type: "set_model",
            model: parsed.modelId,
            provider
          });
          if (setRes?.ok) {
            state.selectedCombinedModelId = modelId;
            state.currentProvider = provider;
            modelStatusEl.textContent = `Using: ${displayName}`;
            await applyImageModeForModel();
            return true;
          }
          modelStatusEl.textContent = "Failed to set model";
          return false;
        },
        onToggleFavorite: async (modelId, isFavorite) => {
          const parsed = parseCombinedModelIdSafe(modelId);
          const provider = normalizeProviderSafe(parsed.provider);
          const rawId = parsed.modelId;
          if (!state.favoriteModelsByProvider[provider]) state.favoriteModelsByProvider[provider] = new Set();
          if (isFavorite) state.favoriteModelsByProvider[provider].add(rawId);
          else state.favoriteModelsByProvider[provider].delete(rawId);
          await chrome.storage.sync.set({
            [getProviderStorageKeySafe("or_favorites", provider)]: Array.from(state.favoriteModelsByProvider[provider])
          });
        },
        onAddRecent: async (modelId) => {
          const parsed = parseCombinedModelIdSafe(modelId);
          const provider = normalizeProviderSafe(parsed.provider);
          const rawId = parsed.modelId;
          const current = state.recentModelsByProvider[provider] || [];
          const next = [rawId, ...current.filter((id) => id !== rawId)].slice(0, 5);
          state.recentModelsByProvider[provider] = next;
          await setLocalStorage({
            [getProviderStorageKeySafe("or_recent_models", provider)]: next
          });
          dropdown.setRecentlyUsed(buildCombinedRecentList());
        }
      });
      setModelDropdown(dropdown);
    } else {
      dropdown.bindInput(resolvedModelInput);
    }

    dropdown.setModels(state.combinedModels);
    dropdown.setFavorites(buildCombinedFavoritesList());
    dropdown.setRecentlyUsed(buildCombinedRecentList());

    const cfgRes = await sendRuntimeMessage({ type: "get_config" });
    if (cfgRes?.ok && cfgRes.config?.model) {
      const provider = normalizeProviderSafe(cfgRes.config.modelProvider || cfgRes.config.provider);
      const combinedId = deps.buildCombinedModelIdSafe(provider, cfgRes.config.model);
      const selected = state.modelMap.get(combinedId);
      const displayName = selected ? getModelDisplayName(selected) : combinedId;
      state.currentProvider = provider;
      state.selectedCombinedModelId = combinedId;
      if (modelInput) modelInput.value = displayName;
      modelStatusEl.textContent = `Using: ${displayName}`;
      await applyImageModeForModel();
    } else {
      modelStatusEl.textContent = "Ready";
      await applyImageModeForModel();
    }
  } catch (e) {
    console.error("Error loading models:", e);
    modelStatusEl.textContent = "Error loading models";
    await deps.applyImageModeForModel();
  }
}

async function loadToggleSettings(deps) {
  const {
    state,
    getLocalStorage,
    setLocalStorage,
    webSearchToggle,
    reasoningToggle,
    imageToggle,
    setImageToggleUi,
    setImageToggleTitle
  } = deps;

  try {
    const settings = await getLocalStorage([
      "or_web_search",
      "or_reasoning",
      "imageModeEnabled",
      "webSearchEnabled",
      "reasoningEnabled"
    ]);
    const legacyWebSearch = settings.webSearchEnabled;
    const legacyReasoning = settings.reasoningEnabled;
    state.webSearchEnabled = Boolean(settings.or_web_search !== undefined ? settings.or_web_search : legacyWebSearch);
    state.reasoningEnabled = Boolean(settings.or_reasoning !== undefined ? settings.or_reasoning : legacyReasoning);
    state.imageModeEnabled = settings.imageModeEnabled || false;

    if (
      (settings.or_web_search === undefined && legacyWebSearch !== undefined) ||
      (settings.or_reasoning === undefined && legacyReasoning !== undefined)
    ) {
      await setLocalStorage({
        or_web_search: state.webSearchEnabled,
        or_reasoning: state.reasoningEnabled
      });
    }

    if (state.webSearchEnabled) webSearchToggle.classList.add("active");
    webSearchToggle.setAttribute("aria-pressed", state.webSearchEnabled.toString());
    if (state.reasoningEnabled) reasoningToggle.classList.add("active");
    reasoningToggle.setAttribute("aria-pressed", state.reasoningEnabled.toString());
    if (imageToggle) {
      setImageToggleUi(state.imageModeEnabled, false);
      setImageToggleTitle("Enable Image Mode");
    }
  } catch (e) {
    console.error("Error loading toggle settings:", e);
  }
}

async function saveToggleSettings(deps) {
  const { state, setLocalStorage } = deps;
  try {
    await setLocalStorage({
      or_web_search: state.webSearchEnabled,
      or_reasoning: state.reasoningEnabled,
      imageModeEnabled: state.imageModeEnabled
    });
  } catch (e) {
    console.error("Error saving toggle settings:", e);
  }
}

const sidepanelModelControllerUtils = {
  loadModels,
  loadToggleSettings,
  saveToggleSettings
};

if (typeof window !== "undefined") {
  window.sidepanelModelControllerUtils = sidepanelModelControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelModelControllerUtils;
}
