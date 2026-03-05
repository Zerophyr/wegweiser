// options-model-dropdown-controller-utils.js - model dropdown setup helpers

function buildCombinedFavoritesList(favoriteModelsByProvider, buildCombinedModelIdSafe) {
  const combined = [];
  ["openrouter"].forEach((provider) => {
    const favorites = favoriteModelsByProvider[provider] || new Set();
    favorites.forEach((modelId) => combined.push(buildCombinedModelIdSafe(provider, modelId)));
  });
  return combined;
}

function buildCombinedRecentList(recentModelsByProvider, buildCombinedModelIdSafe) {
  const combined = [];
  ["openrouter"].forEach((provider) => {
    const recents = recentModelsByProvider[provider] || [];
    recents.forEach((modelId) => {
      const combinedId = buildCombinedModelIdSafe(provider, modelId);
      if (!combined.includes(combinedId)) combined.push(combinedId);
    });
  });
  return combined;
}

function loadFavoritesAndRecents(localItems, syncItems) {
  return {
    favoriteModelsByProvider: {
      openrouter: new Set(syncItems.or_favorites || [])
    },
    recentModelsByProvider: {
      openrouter: localItems.or_recent_models || []
    }
  };
}

function initModelDropdown({
  existingDropdown,
  destroyDropdown,
  modelInput,
  modelSelect,
  modelMap,
  selectedCombinedModelId,
  setSelectedCombinedModelId,
  parseCombinedModelIdSafe,
  normalizeProvider,
  persistSelectedModelSelection,
  statusEl,
  getModelDisplayName,
  favoriteModelsByProvider,
  recentModelsByProvider,
  setFavoriteModelsByProvider,
  setRecentModelsByProvider,
  chromeStorageSync,
  getProviderStorageKeySafe,
  setLocalStorage,
  buildCombinedFavoritesListFn,
  buildCombinedRecentListFn,
  notifyFavoritesUpdated,
  onRecentModelsUpdated,
  ModelDropdownManager
}) {
  if (existingDropdown) {
    destroyDropdown();
  }

  return new ModelDropdownManager({
    inputElement: modelInput,
    containerType: "modal",
    preferProvidedRecents: true,
    onModelSelect: async (modelId) => {
      setSelectedCombinedModelId(modelId);
      const selectedModel = modelMap.get(modelId);
      const displayName = selectedModel ? getModelDisplayName(selectedModel) : modelId;

      if (modelInput) {
        modelInput.value = displayName;
      }
      if (modelSelect) {
        modelSelect.value = modelId;
      }

      try {
        const applied = await persistSelectedModelSelection(modelId);
        if (!applied) return false;
        if (statusEl) {
          statusEl.textContent = "Model updated.";
          statusEl.style.color = "var(--color-success)";
          setTimeout(() => {
            if (statusEl.textContent === "Model updated.") {
              statusEl.textContent = "";
              statusEl.style.color = "";
            }
          }, 1500);
        }
        return true;
      } catch (e) {
        console.error("Failed to persist selected model:", e);
        if (statusEl) {
          statusEl.textContent = "Failed to update model.";
          statusEl.style.color = "var(--color-error)";
        }
        return false;
      }
    },
    onToggleFavorite: async (modelId, isFavorite) => {
      const parsed = parseCombinedModelIdSafe(modelId);
      const provider = normalizeProvider(parsed.provider);
      const rawId = parsed.modelId;
      const nextFavorites = {
        ...favoriteModelsByProvider,
        [provider]: new Set(favoriteModelsByProvider[provider] || [])
      };

      if (isFavorite) {
        nextFavorites[provider].add(rawId);
      } else {
        nextFavorites[provider].delete(rawId);
      }

      setFavoriteModelsByProvider(nextFavorites);

      await chromeStorageSync.set({
        [getProviderStorageKeySafe("or_favorites", provider)]: Array.from(nextFavorites[provider])
      });

      await notifyFavoritesUpdated();
    },
    onAddRecent: async (modelId) => {
      const parsed = parseCombinedModelIdSafe(modelId);
      const provider = normalizeProvider(parsed.provider);
      const rawId = parsed.modelId;

      const current = recentModelsByProvider[provider] || [];
      const next = [rawId, ...current.filter((id) => id !== rawId)].slice(0, 5);
      const nextRecents = {
        ...recentModelsByProvider,
        [provider]: next
      };

      setRecentModelsByProvider(nextRecents);

      await setLocalStorage({
        [getProviderStorageKeySafe("or_recent_models", provider)]: next
      });

      if (typeof onRecentModelsUpdated === "function") {
        onRecentModelsUpdated(nextRecents);
      }
    }
  });
}

const optionsModelDropdownControllerUtils = {
  buildCombinedFavoritesList,
  buildCombinedRecentList,
  loadFavoritesAndRecents,
  initModelDropdown
};

if (typeof window !== "undefined") {
  window.optionsModelDropdownControllerUtils = optionsModelDropdownControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsModelDropdownControllerUtils;
}
