// options-runtime-events-controller-utils.js - runtime message wiring for Options page

function registerOptionsRuntimeMessageHandlers(deps) {
  if (!deps || !deps.runtime?.onMessage?.addListener) return () => {};

  const listener = (msg) => {
    if (msg?.type !== "models_updated") return;

    const now = Date.now();
    if (deps.getModelsLoadInFlight() || (now - deps.getLastSilentModelsLoadAt()) < deps.minReloadIntervalMs) {
      return;
    }

    deps.setLastSilentModelsLoadAt(now);
    deps.loadModels({ silent: true });
  };

  deps.runtime.onMessage.addListener(listener);
  return () => {
    if (deps.runtime?.onMessage?.removeListener) {
      deps.runtime.onMessage.removeListener(listener);
    }
  };
}

const optionsRuntimeEventsControllerUtils = {
  registerOptionsRuntimeMessageHandlers
};

if (typeof window !== "undefined") {
  window.optionsRuntimeEventsControllerUtils = optionsRuntimeEventsControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsRuntimeEventsControllerUtils;
}