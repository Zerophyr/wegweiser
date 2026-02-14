// projects-model-controller-utils.js - model dropdown/select loading for Projects modal

async function loadProjectModels(deps) {
  try {
    const response = await deps.sendRuntimeMessage({ type: "get_models" });
    if (!(response?.ok && response.models)) {
      return;
    }

    deps.setProjectModelMap(new Map(response.models.map((model) => [model.id, model])));

    const [localItems, syncItems] = await Promise.all([
      deps.getLocalStorage(["or_recent_models"]),
      deps.getSyncStorage(["or_favorites"])
    ]);

    deps.setFavoritesByProvider({
      openrouter: new Set(syncItems.or_favorites || [])
    });
    deps.setRecentsByProvider({
      openrouter: localItems.or_recent_models || []
    });

    const resolvedModelInput = deps.getProjectModelInput();
    if (!deps.getProjectModelDropdown() && resolvedModelInput) {
      deps.setProjectModelDropdown(new deps.ModelDropdownManager({
        inputElement: resolvedModelInput,
        containerType: "modal",
        preferProvidedRecents: true,
        onModelSelect: async (modelId) => {
          const selectedModel = deps.getProjectModelMap().get(modelId);
          const displayName = selectedModel ? deps.getModelDisplayName(selectedModel) : modelId;
          deps.updateSelectedModelInput(displayName, modelId);
          return true;
        },
        onToggleFavorite: async (modelId, isFavorite) => {
          const parsed = deps.parseCombinedModelIdSafe(modelId);
          const provider = deps.normalizeProviderSafe(parsed.provider);
          const rawId = parsed.modelId;

          const currentFavorites = deps.getFavoritesByProvider();
          if (!currentFavorites[provider]) {
            currentFavorites[provider] = new Set();
          }

          if (isFavorite) {
            currentFavorites[provider].add(rawId);
          } else {
            currentFavorites[provider].delete(rawId);
          }

          await deps.setSyncStorage({
            [deps.getProviderStorageKeySafe("or_favorites", provider)]: Array.from(currentFavorites[provider])
          });
        },
        onAddRecent: async (modelId) => {
          const parsed = deps.parseCombinedModelIdSafe(modelId);
          const provider = deps.normalizeProviderSafe(parsed.provider);
          const rawId = parsed.modelId;

          const recentsByProvider = deps.getRecentsByProvider();
          const current = recentsByProvider[provider] || [];
          const next = [rawId, ...current.filter((id) => id !== rawId)].slice(0, 5);
          recentsByProvider[provider] = next;

          await deps.setLocalStorage({
            [deps.getProviderStorageKeySafe("or_recent_models", provider)]: next
          });

          const dropdown = deps.getProjectModelDropdown();
          if (dropdown) {
            dropdown.setRecentlyUsed(deps.buildCombinedRecentList(recentsByProvider));
          }
        }
      }));
    } else if (deps.getProjectModelDropdown() && resolvedModelInput) {
      deps.getProjectModelDropdown().bindInput(resolvedModelInput);
    }

    const dropdown = deps.getProjectModelDropdown();
    if (dropdown) {
      dropdown.setModels(response.models);
      dropdown.setFavorites(deps.buildCombinedFavoritesList(deps.getFavoritesByProvider()));
      dropdown.setRecentlyUsed(deps.buildCombinedRecentList(deps.getRecentsByProvider()));
    }

    deps.renderModelSelectOptions(response.models);
    deps.syncSelectedModelInputWithSelect();

    if (deps.getCurrentProjectData()) {
      deps.applyProjectImageMode(deps.getCurrentProjectData());
    }
  } catch (err) {
    deps.logError("Error loading models:", err);
  }
}

const projectsModelControllerUtils = {
  loadProjectModels
};

if (typeof window !== "undefined") {
  window.projectsModelControllerUtils = projectsModelControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsModelControllerUtils;
}
