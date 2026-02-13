// provider-utils.js - Background provider/cache/auth helper functions

import {
  STORAGE_KEYS,
  PROVIDERS
} from '/src/shared/constants.js';

export function normalizeProviderId(providerId) {
  if (providerId === "openrouter" || providerId === "naga") {
    return providerId;
  }
  return "openrouter";
}

export function getProviderConfig(providerId) {
  const provider = normalizeProviderId(providerId);
  return PROVIDERS[provider] || PROVIDERS.openrouter;
}

export function getModelsCacheKeys(providerId) {
  const provider = normalizeProviderId(providerId);
  if (provider === "naga") {
    return {
      modelsKey: STORAGE_KEYS.MODELS_CACHE_NAGA,
      timeKey: STORAGE_KEYS.MODELS_CACHE_TIME_NAGA,
      versionKey: STORAGE_KEYS.MODELS_CACHE_VERSION_NAGA
    };
  }
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

export function buildBalanceHeaders(apiKey, providerConfig, provisioningKey) {
  if (providerConfig.id !== "naga") {
    return buildAuthHeaders(apiKey, providerConfig);
  }
  return {
    "Authorization": `Bearer ${provisioningKey}`,
    "Content-Type": "application/json",
    ...(providerConfig.headers || {})
  };
}
