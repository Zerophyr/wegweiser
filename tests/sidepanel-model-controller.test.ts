const { loadModels, saveToggleSettings } = require("../src/sidepanel/sidepanel-model-controller-utils.js");

describe("sidepanel-model-controller-utils", () => {
  test("loadModels does not flash loading status when a model is already active", async () => {
    const statusUpdates: string[] = [];
    let statusValue = "Using: Existing Model";
    const modelStatusEl = {
      get textContent() {
        return statusValue;
      },
      set textContent(value: string) {
        statusUpdates.push(value);
        statusValue = value;
      }
    };

    const state = {
      sidebarSetupRequired: false,
      combinedModels: [],
      modelMap: new Map(),
      favoriteModelsByProvider: { openrouter: new Set(), naga: new Set() },
      recentModelsByProvider: { openrouter: [], naga: [] },
      currentProvider: "openrouter",
      selectedCombinedModelId: "openrouter:model-a"
    };

    const dropdown = {
      bindInput: jest.fn(),
      setModels: jest.fn(),
      setFavorites: jest.fn(),
      setRecentlyUsed: jest.fn()
    };

    const sendRuntimeMessage = jest.fn(async (payload: { type: string }) => {
      if (payload.type === "get_models") {
        return {
          ok: true,
          models: [
            {
              id: "openrouter:model-a",
              name: "Model A",
              displayName: "Model A"
            }
          ]
        };
      }
      if (payload.type === "get_config") {
        return {
          ok: true,
          config: {
            provider: "openrouter",
            modelProvider: "openrouter",
            model: "model-a"
          }
        };
      }
      return { ok: true };
    });

    await loadModels({
      state,
      modelStatusEl,
      sendRuntimeMessage,
      getLocalStorage: jest.fn().mockResolvedValue({ or_recent_models: [], or_recent_models_naga: [] }),
      loadFavoritesAndRecents: jest.fn(),
      modelInput: { value: "" },
      modelDropdownRef: () => dropdown,
      ModelDropdownManager: function MockDropdownManager() {},
      parseCombinedModelIdSafe: (combinedId: string) => {
        const [provider, modelId] = combinedId.split(":");
        return { provider, modelId };
      },
      normalizeProviderSafe: (provider: string) => provider || "openrouter",
      getModelDisplayName: (model: { displayName?: string; name?: string; id?: string }) => model.displayName || model.name || model.id,
      setLocalStorage: jest.fn(),
      getProviderStorageKeySafe: (key: string, provider: string) => (provider === "naga" ? `${key}_naga` : key),
      buildCombinedRecentList: () => [],
      buildCombinedFavoritesList: () => [],
      setModelDropdown: jest.fn(),
      applyImageModeForModel: jest.fn(),
      buildCombinedModelIdSafe: (provider: string, model: string) => `${provider}:${model}`
    });

    expect(statusUpdates).not.toContain("Loading models...");
    expect(modelStatusEl.textContent).toBe("Using: Model A");
  });



  test("loadModels retries once when first model response is empty", async () => {
    const state = {
      sidebarSetupRequired: false,
      combinedModels: [],
      modelMap: new Map(),
      favoriteModelsByProvider: { openrouter: new Set(), naga: new Set() },
      recentModelsByProvider: { openrouter: [], naga: [] },
      currentProvider: "openrouter",
      selectedCombinedModelId: null
    };

    const dropdown = {
      bindInput: jest.fn(),
      setModels: jest.fn(),
      setFavorites: jest.fn(),
      setRecentlyUsed: jest.fn()
    };

    let modelsCalls = 0;
    const sendRuntimeMessage = jest.fn(async (payload: { type: string }) => {
      if (payload.type === "get_models") {
        modelsCalls += 1;
        if (modelsCalls === 1) {
          return { ok: true, models: [] };
        }
        return {
          ok: true,
          models: [{ id: "openrouter:model-b", name: "Model B", displayName: "Model B" }]
        };
      }
      if (payload.type === "get_config") {
        return { ok: true, config: {} };
      }
      return { ok: true };
    });

    const sleep = jest.fn().mockResolvedValue(undefined);
    const modelStatusEl = { textContent: "" };

    await loadModels({
      state,
      modelStatusEl,
      sendRuntimeMessage,
      getLocalStorage: jest.fn().mockResolvedValue({ or_recent_models: [], or_recent_models_naga: [] }),
      loadFavoritesAndRecents: jest.fn(),
      modelInput: { value: "" },
      modelDropdownRef: () => dropdown,
      ModelDropdownManager: function MockDropdownManager() {},
      parseCombinedModelIdSafe: (combinedId: string) => {
        const [provider, modelId] = combinedId.split(":");
        return { provider, modelId };
      },
      normalizeProviderSafe: (provider: string) => provider || "openrouter",
      getModelDisplayName: (model: { displayName?: string; name?: string; id?: string }) => model.displayName || model.name || model.id,
      setLocalStorage: jest.fn(),
      getProviderStorageKeySafe: (key: string, provider: string) => (provider === "naga" ? `${key}_naga` : key),
      buildCombinedRecentList: () => [],
      buildCombinedFavoritesList: () => [],
      setModelDropdown: jest.fn(),
      applyImageModeForModel: jest.fn(),
      buildCombinedModelIdSafe: (provider: string, model: string) => `${provider}:${model}`,
      sleep
    });

    expect(modelsCalls).toBe(2);
    expect(sleep).toHaveBeenCalled();
    expect(state.combinedModels).toHaveLength(1);
    expect(modelStatusEl.textContent).toBe("Ready");
  });

  test("saveToggleSettings persists current state", async () => {
    const state = {
      webSearchEnabled: true,
      reasoningEnabled: false,
      imageModeEnabled: true
    };
    const setLocalStorage = jest.fn().mockResolvedValue(undefined);
    await saveToggleSettings({ state, setLocalStorage });

    expect(setLocalStorage).toHaveBeenCalledWith({
      or_web_search: true,
      or_reasoning: false,
      imageModeEnabled: true
    });
  });
});
