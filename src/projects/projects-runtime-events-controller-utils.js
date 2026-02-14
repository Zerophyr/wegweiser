// projects-runtime-events-controller-utils.js - runtime message wiring for Projects page

function registerProjectsRuntimeMessageHandlers(deps) {
  if (!deps || !deps.runtime?.onMessage?.addListener) return () => {};

  const listener = (msg) => {
    if (msg?.type === "provider_settings_updated") {
      (async () => {
        await deps.loadProviderSetting();
        await deps.loadModels();
        if (typeof deps.showToast === "function") {
          const providerLabel = deps.getProviderLabelSafe(msg.provider);
          deps.showToast(`Provider updated. Update Project models to use ${providerLabel}.`, "info");
        }
      })();
      return;
    }

    if (msg?.type === "models_updated") {
      deps.loadModels();
    }
  };

  deps.runtime.onMessage.addListener(listener);
  return () => {
    if (deps.runtime?.onMessage?.removeListener) {
      deps.runtime.onMessage.removeListener(listener);
    }
  };
}

const projectsRuntimeEventsControllerUtils = {
  registerProjectsRuntimeMessageHandlers
};

if (typeof window !== "undefined") {
  window.projectsRuntimeEventsControllerUtils = projectsRuntimeEventsControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsRuntimeEventsControllerUtils;
}