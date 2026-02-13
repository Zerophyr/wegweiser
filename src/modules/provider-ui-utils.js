// provider-ui-utils.js - Shared provider/model helper functions for UI pages

function normalizeProviderSafe(providerId) {
  if (typeof normalizeProviderId === "function") {
    return normalizeProviderId(providerId);
  }
  return providerId === "naga" ? "naga" : "openrouter";
}

function getProviderLabelSafe(providerId) {
  if (typeof getProviderLabel === "function") {
    return getProviderLabel(providerId);
  }
  return normalizeProviderSafe(providerId) === "naga" ? "NagaAI" : "OpenRouter";
}

function getProviderStorageKeySafe(baseKey, providerId) {
  if (typeof getProviderStorageKey === "function") {
    return getProviderStorageKey(baseKey, providerId);
  }
  return normalizeProviderSafe(providerId) === "naga" ? `${baseKey}_naga` : baseKey;
}

function buildCombinedModelIdSafe(providerId, modelId) {
  if (typeof buildCombinedModelId === "function") {
    return buildCombinedModelId(providerId, modelId);
  }
  return `${normalizeProviderSafe(providerId)}:${modelId}`;
}

function parseCombinedModelIdSafe(combinedId) {
  if (typeof parseCombinedModelId === "function") {
    return parseCombinedModelId(combinedId);
  }
  if (!combinedId || typeof combinedId !== "string") {
    return { provider: "openrouter", modelId: "" };
  }
  const splitIndex = combinedId.indexOf(":");
  if (splitIndex === -1) {
    return { provider: "openrouter", modelId: combinedId };
  }
  const provider = normalizeProviderSafe(combinedId.slice(0, splitIndex));
  const modelId = combinedId.slice(splitIndex + 1);
  return { provider, modelId };
}

function getModelDisplayName(model) {
  return model?.displayName || model?.name || model?.id || "";
}

function buildCombinedFavoritesList(favoriteModelsByProvider) {
  const combined = [];
  ["openrouter", "naga"].forEach((provider) => {
    const favorites = favoriteModelsByProvider[provider] || new Set();
    favorites.forEach((modelId) => {
      combined.push(buildCombinedModelIdSafe(provider, modelId));
    });
  });
  return combined;
}

function buildCombinedRecentList(recentModelsByProvider) {
  const combined = [];
  ["openrouter", "naga"].forEach((provider) => {
    const recents = recentModelsByProvider[provider] || [];
    recents.forEach((modelId) => {
      const combinedId = buildCombinedModelIdSafe(provider, modelId);
      if (!combined.includes(combinedId)) {
        combined.push(combinedId);
      }
    });
  });
  return combined;
}

const providerUiUtils = {
  normalizeProviderSafe,
  getProviderLabelSafe,
  getProviderStorageKeySafe,
  buildCombinedModelIdSafe,
  parseCombinedModelIdSafe,
  getModelDisplayName,
  buildCombinedFavoritesList,
  buildCombinedRecentList
};

if (typeof window !== "undefined") {
  window.providerUiUtils = providerUiUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = providerUiUtils;
}
