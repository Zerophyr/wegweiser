// model-utils.js - ESM helpers for background service worker

/**
 * Normalizes a provider id to a supported value.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Normalized provider id.
 */
export function normalizeProviderId(providerId) {
  if (providerId === "openrouter" || providerId === "naga") {
    return providerId;
  }
  return "openrouter";
}

/**
 * Returns the base model name without provider prefixes.
 * @param {string} modelId - Raw model id.
 * @returns {string} Base model name.
 */
export function getModelBaseName(modelId) {
  if (!modelId || typeof modelId !== "string") return "";
  const lastSlash = modelId.lastIndexOf("/");
  const lastColon = modelId.lastIndexOf(":");
  const cutIndex = Math.max(lastSlash, lastColon);
  return cutIndex >= 0 ? modelId.slice(cutIndex + 1) : modelId;
}

/**
 * Resolves a vendor label from Naga owned_by + startups map.
 * @param {string|null|undefined} ownedBy - owned_by value from Naga.
 * @param {Record<string, string>} startupsMap - id -> display_name.
 * @returns {string} Vendor label.
 */
export function resolveNagaVendorLabel(ownedBy, startupsMap = {}) {
  const normalized = typeof ownedBy === "string" ? ownedBy.trim() : "";
  if (!normalized) return "Other";
  const direct = startupsMap && typeof startupsMap === "object" ? startupsMap[normalized] : "";
  if (typeof direct === "string" && direct.trim().length) {
    return direct.trim();
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Builds a display name with provider prefix.
 * @param {string|null} providerId - Provider identifier.
 * @param {string} modelId - Raw model id.
 * @returns {string} Display name.
 */
export function buildModelDisplayName(providerId, modelId) {
  const provider = normalizeProviderId(providerId);
  const prefix = provider === "naga" ? "NG" : "OR";
  const raw = typeof modelId === "string" ? modelId : "";
  const baseName = getModelBaseName(raw);
  return `${prefix}-${baseName}`;
}

/**
 * Builds a combined model id for UI selection.
 * @param {string|null} providerId - Provider identifier.
 * @param {string} modelId - Raw model id.
 * @returns {string} Combined model id.
 */
export function buildCombinedModelId(providerId, modelId) {
  const provider = normalizeProviderId(providerId);
  return `${provider}:${modelId}`;
}
