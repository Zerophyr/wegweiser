// sidepanel-model-sync-controller-utils.js - selected model sync orchestration for sidepanel

async function syncSelectedModelFromConfig(deps = {}) {
  try {
    const stored = await deps.getLocalStorage(["or_model", "or_model_provider", "or_provider"]);
    let modelId = stored?.or_model || "";
    let provider = deps.normalizeProviderSafe(stored?.or_model_provider || stored?.or_provider);

    if (!modelId) {
      const cfgRes = await deps.sendRuntimeMessage({ type: "get_config" });
      if (!cfgRes?.ok || !cfgRes.config?.model) return;
      modelId = cfgRes.config.model;
      provider = deps.normalizeProviderSafe(cfgRes.config.modelProvider || cfgRes.config.provider);
    }

    const combinedId = deps.buildCombinedModelIdSafe(provider, modelId);
    if (deps.getSelectedCombinedModelId() === combinedId) return;

    deps.setSelectedCombinedModelId(combinedId);
    deps.setCurrentProvider(provider);

    const selected = deps.getModelMap().get(combinedId);
    const displayName = selected ? deps.getModelDisplayName(selected) : modelId;

    if (deps.modelInput) deps.modelInput.value = displayName;
    if (deps.modelStatusEl) deps.modelStatusEl.textContent = `Using: ${displayName}`;
    await deps.applyImageModeForModel?.();
  } catch (e) {
    deps.logWarn?.("Failed to sync selected model from config:", e);
  }
}

function registerStorageModelSyncListener(deps = {}) {
  const storageChanged = deps.storageOnChanged;
  if (!storageChanged?.addListener) return () => {};

  const listener = (changes, areaName) => {
    if (areaName !== "local" || !changes) return;
    if (!changes.or_model && !changes.or_model_provider && !changes.or_provider) return;
    deps.syncSelectedModelFromConfig();
  };

  storageChanged.addListener(listener);
  return () => {
    if (storageChanged.removeListener) {
      storageChanged.removeListener(listener);
    }
  };
}

function registerVisibilityModelSync(deps = {}) {
  const windowRef = deps.windowRef || (typeof window !== "undefined" ? window : null);
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  if (!windowRef || !documentRef) return () => {};

  const onFocus = () => {
    deps.syncSelectedModelFromConfig();
  };

  const onVisibilityChange = () => {
    if (documentRef.visibilityState === "visible") {
      deps.syncSelectedModelFromConfig();
    }
  };

  windowRef.addEventListener("focus", onFocus);
  documentRef.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    windowRef.removeEventListener("focus", onFocus);
    documentRef.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

function createModelSyncController(deps = {}) {
  const sync = () => syncSelectedModelFromConfig({ ...deps });
  return {
    syncSelectedModelFromConfig: sync,
    registerStorageModelSyncListener: () => registerStorageModelSyncListener({
      storageOnChanged: deps.storageOnChanged,
      syncSelectedModelFromConfig: sync
    }),
    registerVisibilityModelSync: () => registerVisibilityModelSync({
      windowRef: deps.windowRef,
      documentRef: deps.documentRef,
      syncSelectedModelFromConfig: sync
    })
  };
}

const sidepanelModelSyncControllerUtils = {
  syncSelectedModelFromConfig,
  registerStorageModelSyncListener,
  registerVisibilityModelSync,
  createModelSyncController
};

if (typeof window !== "undefined") {
  window.sidepanelModelSyncControllerUtils = sidepanelModelSyncControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelModelSyncControllerUtils;
}