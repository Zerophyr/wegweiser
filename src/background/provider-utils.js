// provider-utils.js - Background provider/cache/auth helper functions

import {
  STORAGE_KEYS,
  PROVIDERS
} from '/src/shared/constants.js';

export function normalizeProviderId(_providerId) {
  return "openrouter";
}

export function getProviderConfig(_providerId) {
  return PROVIDERS.openrouter;
}

export function getModelsCacheKeys(_providerId) {
  return {
    modelsKey: STORAGE_KEYS.MODELS_CACHE,
    timeKey: STORAGE_KEYS.MODELS_CACHE_TIME,
    versionKey: STORAGE_KEYS.MODELS_CACHE_VERSION
  };
}

export function buildAuthHeaders(apiKey, providerConfig) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(providerConfig.headers || {})
  };
}

export function buildBalanceHeaders(apiKey, providerConfig) {
  return buildAuthHeaders(apiKey, providerConfig);
}
