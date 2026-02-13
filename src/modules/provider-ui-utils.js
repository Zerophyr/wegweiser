// provider-ui-utils.js - Shared provider/model helper functions for UI pages

function normalizeProviderSafe() {
  return "openrouter";
}

function getProviderLabelSafe() {
  return "OpenRouter";
}

function getProviderStorageKeySafe(baseKey) {
  return baseKey;
}

function buildCombinedModelIdSafe(providerId, modelId) {
  if (typeof buildCombinedModelId === "function") {
    return buildCombinedModelId(providerId, modelId);
  }
  return `openrouter:${modelId}`;
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
  return { provider: "openrouter", modelId: combinedId.slice(splitIndex + 1) };
}

function getModelDisplayName(model) {
  return model?.displayName || model?.name || model?.id || "";
}

function buildCombinedFavoritesList(favoriteModelsByProvider) {
  const combined = [];
  const favorites = favoriteModelsByProvider?.openrouter || new Set();
  favorites.forEach((modelId) => {
    combined.push(buildCombinedModelIdSafe("openrouter", modelId));
  });
  return combined;
}

function buildCombinedRecentList(recentModelsByProvider) {
  const combined = [];
  const recents = recentModelsByProvider?.openrouter || [];
  recents.forEach((modelId) => {
    const combinedId = buildCombinedModelIdSafe("openrouter", modelId);
    if (!combined.includes(combinedId)) {
      combined.push(combinedId);
    }
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
