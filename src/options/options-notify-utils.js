// options-notify-utils.js - notification helpers for Options page runtime events

async function notifyProviderSettingsUpdated(runtime, providerId = "all", logger = console) {
  if (!runtime || typeof runtime.sendMessage !== "function") return;
  try {
    await runtime.sendMessage({
      type: "provider_settings_updated",
      provider: providerId
    });
  } catch (e) {
    if (logger && typeof logger.warn === "function") {
      logger.warn("Failed to notify provider update:", e);
    }
  }
}

async function notifyModelsUpdated(runtime, logger = console) {
  if (!runtime || typeof runtime.sendMessage !== "function") return;
  try {
    await runtime.sendMessage({ type: "models_updated" });
  } catch (e) {
    if (logger && typeof logger.warn === "function") {
      logger.warn("Failed to notify models update:", e);
    }
  }
}

const optionsNotifyUtils = {
  notifyProviderSettingsUpdated,
  notifyModelsUpdated
};

if (typeof window !== "undefined") {
  window.optionsNotifyUtils = optionsNotifyUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsNotifyUtils;
}
