// options-model-controller-utils.js - model loading/cache orchestration for options page

function toCombinedModels(cache, buildCombinedModelIdSafe, getModelDisplayName) {
  const toCombined = (models, provider) => (Array.isArray(models) ? models : []).map((model) => {
    const rawId = model.rawId || model.id;
    return {
      id: buildCombinedModelIdSafe(provider, rawId),
      rawId,
      provider,
      displayName: getModelDisplayName(model),
      name: model.name || model.displayName || rawId
    };
  });
  return [
    ...toCombined(cache.or_models_cache, "openrouter")
  ];
}

function createOptionsModelController(deps) {
  async function loadCachedModelsFromStorage() {
    const cache = await deps.getLocalStorage(["or_models_cache"]);
    return toCombinedModels(cache, deps.buildCombinedModelIdSafe, deps.getModelDisplayName);
  }

  function loadSelectedModel(localItems) {
    const modelProvider = deps.normalizeProvider(localItems.or_model_provider || localItems.or_provider);
    const rawModelId = localItems.or_model || "";
    deps.setSelectedCombinedModelId(rawModelId ? deps.buildCombinedModelIdSafe(modelProvider, rawModelId) : null);
  }

  async function loadModels(options = {}) {
    const { silent = false } = options;
    const requestId = deps.nextRequestId();
    const focusedBeforeLoad = deps.isModelInputFocused();
    const hasActiveModelStatus = (deps.getModelsStatusText() || "").startsWith("Using:");

    if (!silent && !hasActiveModelStatus) {
      deps.setModelsStatus("Loading models...", "var(--color-text-muted)");
    }

    deps.setModelsLoadInFlight(true);

    try {
      const res = await deps.sendRuntimeMessage({ type: "get_models" });

      if (requestId !== deps.getRequestId()) {
        return;
      }

      if (!res?.ok) {
        throw new Error(res?.error || "Failed to load models");
      }

      const nextModels = (res.models || []).map((model) => ({
        id: model.id,
        rawId: model.rawId || model.id,
        provider: model.provider,
        displayName: deps.getModelDisplayName(model),
        name: model.name || model.displayName || model.id
      }));

      deps.setCombinedModels(nextModels);
      deps.setModelMap(new Map(nextModels.map((model) => [model.id, model])));

      if (!deps.getModelDropdown()) {
        deps.initModelDropdown();
      }
      deps.getModelDropdown()?.setModels(nextModels);
      deps.getModelDropdown()?.setFavorites(deps.buildCombinedFavoritesList());
      deps.getModelDropdown()?.setRecentlyUsed(deps.buildCombinedRecentList());

      const selectedCombinedModelId = deps.getSelectedCombinedModelId();
      if (selectedCombinedModelId && !focusedBeforeLoad) {
        const selected = deps.getModelMap().get(selectedCombinedModelId);
        deps.setModelInputValue(selected ? deps.getModelDisplayName(selected) : selectedCombinedModelId);
        deps.setModelSelectValue(selectedCombinedModelId);
      }

      if (!nextModels.length) {
        deps.setModelsStatus(
          res.reason === "no_enabled_providers"
            ? "Set your OpenRouter API key to load models."
            : "No models available.",
          "var(--color-text-muted)"
        );
      } else {
        deps.setModelsStatus(`Loaded ${nextModels.length} models.`, "var(--color-success)");
      }
    } catch (e) {
      if (requestId !== deps.getRequestId()) {
        return;
      }

      deps.logError("Failed to load models:", e);
      const combinedModels = deps.getCombinedModels();
      const hasCachedModels = Array.isArray(combinedModels) && combinedModels.length > 0;

      if (hasCachedModels && deps.getModelDropdown()) {
        deps.getModelDropdown().setModels(combinedModels);
        deps.getModelDropdown().setFavorites(deps.buildCombinedFavoritesList());
        deps.getModelDropdown().setRecentlyUsed(deps.buildCombinedRecentList());
        if (!silent) {
          deps.setModelsStatus("Using cached models (refresh failed).", "var(--color-warning)");
        }
        return;
      }

      const message = String(e?.message || "").toLowerCase();
      if (message.includes("failed to fetch")) {
        try {
          const cachedCombinedModels = await loadCachedModelsFromStorage();
          if (cachedCombinedModels.length) {
            deps.setCombinedModels(cachedCombinedModels);
            deps.setModelMap(new Map(cachedCombinedModels.map((model) => [model.id, model])));
            if (!deps.getModelDropdown()) {
              deps.initModelDropdown();
            }
            deps.getModelDropdown().setModels(cachedCombinedModels);
            deps.getModelDropdown().setFavorites(deps.buildCombinedFavoritesList());
            deps.getModelDropdown().setRecentlyUsed(deps.buildCombinedRecentList());
            if (!silent) {
              deps.setModelsStatus("Using cached models (OpenRouter unavailable).", "var(--color-warning)");
            }
            return;
          }
        } catch (_) {
          // ignore cache fallback errors
        }
      }

      if (!silent) {
        if (message.includes("no api key")) {
          deps.setModelsStatus("Set your API key to load models.", "var(--color-error)");
        } else if (message.includes("failed to fetch")) {
          deps.setModelsStatus("Could not reach OpenRouter. Check network status.", "var(--color-error)");
        } else {
          deps.setModelsStatus(`Error: ${e.message}`, "var(--color-error)");
        }
      }
    } finally {
      if (requestId === deps.getRequestId()) {
        deps.setModelsLoadInFlight(false);
      }
    }
  }

  async function updateProviderModelsAfterChange() {
    if (!deps.getModelsLoadInFlight()) {
      deps.setModelsStatus("Refreshing models...", "var(--color-text-muted)");
    }
    await loadModels();
    await deps.notifyProviderSettingsUpdated("all");
  }

  return {
    loadCachedModelsFromStorage,
    loadSelectedModel,
    loadModels,
    updateProviderModelsAfterChange
  };
}

const optionsModelControllerUtils = {
  createOptionsModelController
};

if (typeof window !== "undefined") {
  window.optionsModelControllerUtils = optionsModelControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsModelControllerUtils;
}
