// background-model-cache-controller-utils.js - Model cache orchestration for background worker

function createBackgroundModelCacheController(rawDeps) {
  const deps = rawDeps || {};

  const normalizeProviderId = deps.normalizeProviderId || ((providerId) => providerId || "openrouter");
  const getProviderConfig = deps.getProviderConfig || (() => ({ baseUrl: "" }));
  const buildAuthHeaders = deps.buildAuthHeaders || (() => ({}));
  const parseModelsPayload = deps.parseModelsPayload || (() => []);
  const deriveModelCapabilities = deps.deriveModelCapabilities || (() => ({}));
  const getModelsCacheKeys = deps.getModelsCacheKeys || (() => ({ modelsKey: "or_models_cache", timeKey: "or_models_cache_time", versionKey: "or_models_cache_version" }));
  const modelsCacheSchemaVersion = Number.isFinite(deps.modelsCacheSchemaVersion) ? deps.modelsCacheSchemaVersion : 0;
  const storageLocal = deps.storageLocal || (typeof chrome !== "undefined" ? chrome.storage.local : null);
  const runtime = deps.runtime || (typeof chrome !== "undefined" ? chrome.runtime : null);
  const modelsUpdatedEvent = deps.modelsUpdatedEvent || "models_updated";
  const cacheTtlMs = Number.isFinite(deps.cacheTtlMs) ? deps.cacheTtlMs : 0;
  const hasModelCapabilityFields = deps.hasModelCapabilityFields || (() => false);
  const errorMessages = deps.errorMessages || { API_ERROR: "API error" };
  const fetchFn = deps.fetchFn || fetch;
  const logger = deps.logger || console;
  const now = deps.now || Date.now;

  function broadcastModelsUpdated(provider) {
    try {
      const maybePromise = runtime?.sendMessage?.({
        type: modelsUpdatedEvent,
        provider
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.catch((e) => {
          const msg = String(e?.message || e || "");
          if (msg.includes("Receiving end does not exist")) {
            return;
          }
          logger.warn("Failed to broadcast model update:", e);
        });
      }
    } catch (_e) {
      // ignore if no listeners
    }
  }

  async function refreshProviderModels(providerId, apiKey) {
    const provider = normalizeProviderId(providerId);
    if (!apiKey) return [];

    const providerConfig = getProviderConfig(provider);
    const res = await fetchFn(`${providerConfig.baseUrl}/models`, {
      headers: buildAuthHeaders(apiKey, providerConfig)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.message || errorMessages.API_ERROR);
    }

    const data = await res.json();
    const models = parseModelsPayload(data, deriveModelCapabilities);

    const { modelsKey, timeKey, versionKey } = getModelsCacheKeys(provider);
    await storageLocal?.set?.({
      [modelsKey]: models,
      [timeKey]: now(),
      [versionKey]: modelsCacheSchemaVersion
    });

    broadcastModelsUpdated(provider);
    return models;
  }

  async function getProviderModels(providerId, apiKey) {
    const provider = normalizeProviderId(providerId);
    if (!apiKey) return [];

    const { modelsKey, timeKey, versionKey } = getModelsCacheKeys(provider);
    const cacheData = await storageLocal?.get?.([modelsKey, timeKey, versionKey]) || {};

    const nowMs = now();
    const cachedModels = Array.isArray(cacheData[modelsKey]) ? cacheData[modelsKey] : [];
    const cacheTime = cacheData[timeKey] || 0;
    const cacheVersion = cacheData[versionKey] || 0;
    const cacheHasCapabilities = cachedModels.length
      ? cachedModels.every((model) => hasModelCapabilityFields(model))
      : false;
    const cacheFresh = cachedModels.length
      && cacheTime
      && cacheVersion === modelsCacheSchemaVersion
      && (nowMs - cacheTime) < cacheTtlMs
      && cacheHasCapabilities;

    if (cacheFresh) {
      return cachedModels;
    }

    if (cachedModels.length) {
      refreshProviderModels(provider, apiKey).catch((err) => {
        logger.warn(`Failed to refresh ${provider} models:`, err);
      });
      return cachedModels;
    }

    return refreshProviderModels(provider, apiKey);
  }

  return {
    broadcastModelsUpdated,
    refreshProviderModels,
    getProviderModels
  };
}

const backgroundModelCacheControllerUtils = {
  createBackgroundModelCacheController
};

if (typeof window !== "undefined") {
  window.backgroundModelCacheControllerUtils = backgroundModelCacheControllerUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundModelCacheControllerUtils = backgroundModelCacheControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundModelCacheControllerUtils;
}
