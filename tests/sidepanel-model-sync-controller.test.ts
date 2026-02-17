export {};

const {
  createModelSyncController,
  registerStorageModelSyncListener,
  registerVisibilityModelSync,
  syncSelectedModelFromConfig
} = require("../src/sidepanel/sidepanel-model-sync-controller-utils.js");

describe("sidepanel-model-sync-controller-utils", () => {
  test("syncSelectedModelFromConfig updates selected model and status", async () => {
    let selectedCombinedModelId: string | null = null;
    let currentProvider = "openrouter";
    const modelInput = { value: "" };
    const modelStatusEl = { textContent: "" };

    await syncSelectedModelFromConfig({
      getLocalStorage: jest.fn().mockResolvedValue({
        or_model: "model-a",
        or_model_provider: "openrouter"
      }),
      sendRuntimeMessage: jest.fn().mockResolvedValue({ ok: true, config: {} }),
      normalizeProviderSafe: (provider: string) => provider || "openrouter",
      buildCombinedModelIdSafe: (provider: string, modelId: string) => `${provider}:${modelId}`,
      getSelectedCombinedModelId: () => selectedCombinedModelId,
      setSelectedCombinedModelId: (value: string) => { selectedCombinedModelId = value; },
      setCurrentProvider: (value: string) => { currentProvider = value; },
      getModelMap: () => new Map([["openrouter:model-a", { displayName: "Model A" }]]),
      getModelDisplayName: (model: { displayName?: string }) => model.displayName,
      modelInput,
      modelStatusEl,
      applyImageModeForModel: jest.fn().mockResolvedValue(undefined),
      logWarn: jest.fn()
    });

    expect(selectedCombinedModelId).toBe("openrouter:model-a");
    expect(currentProvider).toBe("openrouter");
    expect(modelInput.value).toBe("Model A");
    expect(modelStatusEl.textContent).toBe("Using: Model A");
  });

  test("registerStorageModelSyncListener reacts only to model-related local changes", () => {
    const listeners: Array<(changes: any, areaName: string) => void> = [];
    const removeListener = jest.fn();
    const syncSelected = jest.fn();

    const unsubscribe = registerStorageModelSyncListener({
      storageOnChanged: {
        addListener: (fn: (changes: any, areaName: string) => void) => listeners.push(fn),
        removeListener
      },
      syncSelectedModelFromConfig: syncSelected
    });

    listeners[0]({ some_other_key: { newValue: 1 } }, "local");
    listeners[0]({ or_model: { newValue: "x" } }, "sync");
    expect(syncSelected).not.toHaveBeenCalled();

    listeners[0]({ or_model: { newValue: "x" } }, "local");
    expect(syncSelected).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(removeListener).toHaveBeenCalled();
  });

  test("registerVisibilityModelSync refreshes on focus and visible state", () => {
    const syncSelected = jest.fn();
    const events: Record<string, Function> = {};
    const docEvents: Record<string, Function> = {};
    const documentRef = {
      visibilityState: "hidden",
      addEventListener: (event: string, fn: Function) => { docEvents[event] = fn; },
      removeEventListener: jest.fn()
    } as any;

    const unsubscribe = registerVisibilityModelSync({
      syncSelectedModelFromConfig: syncSelected,
      windowRef: {
        addEventListener: (event: string, fn: Function) => { events[event] = fn; },
        removeEventListener: jest.fn()
      } as any,
      documentRef
    });

    events.focus();
    expect(syncSelected).toHaveBeenCalledTimes(1);

    docEvents.visibilitychange();
    expect(syncSelected).toHaveBeenCalledTimes(1);

    documentRef.visibilityState = "visible";
    docEvents.visibilitychange();
    expect(syncSelected).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  test("createModelSyncController wires all handlers", async () => {
    const listeners: Array<(changes: any, areaName: string) => void> = [];
    const windowEvents: Record<string, Function> = {};
    const documentEvents: Record<string, Function> = {};
    let selectedCombinedModelId: string | null = null;

    const controller = createModelSyncController({
      getLocalStorage: jest.fn().mockResolvedValue({ or_model: "model-b", or_model_provider: "openrouter" }),
      sendRuntimeMessage: jest.fn().mockResolvedValue({ ok: true, config: {} }),
      normalizeProviderSafe: (provider: string) => provider || "openrouter",
      buildCombinedModelIdSafe: (provider: string, modelId: string) => `${provider}:${modelId}`,
      getSelectedCombinedModelId: () => selectedCombinedModelId,
      setSelectedCombinedModelId: (value: string) => { selectedCombinedModelId = value; },
      setCurrentProvider: jest.fn(),
      getModelMap: () => new Map(),
      getModelDisplayName: () => "model-b",
      modelInput: { value: "" },
      modelStatusEl: { textContent: "" },
      applyImageModeForModel: jest.fn(),
      storageOnChanged: { addListener: (fn: any) => listeners.push(fn), removeListener: jest.fn() },
      windowRef: { addEventListener: (event: string, fn: Function) => { windowEvents[event] = fn; }, removeEventListener: jest.fn() },
      documentRef: { visibilityState: "visible", addEventListener: (event: string, fn: Function) => { documentEvents[event] = fn; }, removeEventListener: jest.fn() },
      logWarn: jest.fn()
    });

    await controller.syncSelectedModelFromConfig();
    expect(selectedCombinedModelId).toBe("openrouter:model-b");

    controller.registerStorageModelSyncListener();
    listeners[0]({ or_model: { newValue: "x" } }, "local");
    expect(selectedCombinedModelId).toBe("openrouter:model-b");

    controller.registerVisibilityModelSync();
    windowEvents.focus();
    documentEvents.visibilitychange();
  });
});
