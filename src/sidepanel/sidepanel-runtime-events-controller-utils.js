// sidepanel-runtime-events-controller-utils.js - runtime message wiring for Sidepanel

function registerSidepanelRuntimeMessageHandlers(deps) {
  if (!deps || !deps.runtime?.onMessage?.addListener) return () => {};

  const listener = (msg) => {
    if (msg?.type === "provider_settings_updated") {
      (async () => {
        const providerReady = await deps.refreshSidebarSetupState();
        await deps.loadProviderSetting();
        if (providerReady) {
          await deps.loadModels();
          await deps.refreshBalance();
        } else if (deps.balanceEl) {
          deps.balanceEl.textContent = "–";
        }
      })();
      return;
    }

    if (msg?.type === "models_updated") {
      deps.loadModels();
      return;
    }

    if (msg?.type === "favorites_updated") {
      deps.refreshFavoritesOnly();
    }
  };

  deps.runtime.onMessage.addListener(listener);
  return () => {
    if (deps.runtime?.onMessage?.removeListener) {
      deps.runtime.onMessage.removeListener(listener);
    }
  };
}

const sidepanelRuntimeEventsControllerUtils = {
  registerSidepanelRuntimeMessageHandlers
};

if (typeof window !== "undefined") {
  window.sidepanelRuntimeEventsControllerUtils = sidepanelRuntimeEventsControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelRuntimeEventsControllerUtils;
}