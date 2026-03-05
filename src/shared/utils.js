// Shared utility functions for OpenRouter extension

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Validates that a URL uses http or https protocol
 * @param {string} url - The URL to validate
 * @returns {boolean} True if URL is safe
 */
function validateUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Retries an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} The result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) or rate limits
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Debounces a function call
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Clears prompt input after sending.
 * @param {{value?: string, style?: {height?: string}}} inputEl
 */
function clearPromptAfterSend(inputEl) {
  if (!inputEl) return;
  inputEl.value = "";
  if (inputEl.style) {
    inputEl.style.height = "auto";
  }
}

/**
 * Builds a safe URL for opening generated images in a new tab.
 * Falls back to an extension viewer when data URLs are too long.
 * @param {string} dataUrl
 * @param {string} imageId
 * @param {string} viewerBaseUrl
 * @param {number} maxDataUrlLength
 * @returns {string}
 */
function buildImageOpenUrl(dataUrl, imageId, viewerBaseUrl, maxDataUrlLength = 2000) {
  if (!dataUrl) return "";
  const safeViewerBase = typeof viewerBaseUrl === "string" ? viewerBaseUrl : "";
  const safeImageId = typeof imageId === "string" ? imageId : "";
  if (!safeViewerBase || !safeImageId) {
    return dataUrl;
  }
  if (typeof dataUrl === "string" && dataUrl.length <= maxDataUrlLength) {
    return dataUrl;
  }
  return `${safeViewerBase}?imageId=${encodeURIComponent(safeImageId)}`;
}

/**
 * Extracts provider name from model ID
 * @param {string} modelId - The model ID (e.g., "openai/gpt-4")
 * @returns {string} Capitalized provider name
 */
function getProvider(modelId) {
  const match = modelId.match(/^([^/:]+)[/:]/);
  if (match) {
    const provider = match[1];
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  return "Other";
}

/**
 * Normalizes a provider id to a supported value.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Normalized provider id.
 */
function normalizeProviderId(_providerId) {
  return "openrouter";
}

/**
 * Returns a display label for a provider id.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Display label.
 */
function getProviderLabel(_providerId) {
  return "OpenRouter";
}

/**
 * Returns an API key placeholder for a provider.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Placeholder prefix.
 */
function getProviderApiKeyPlaceholder(_providerId) {
  return "sk-or-...";
}

/**
 * Builds a provider-scoped storage key.
 * @param {string} baseKey - Base storage key.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Provider-scoped key.
 */
function getProviderStorageKey(baseKey, _providerId) {
  return baseKey;
}

/**
 * Returns the base model name without provider prefixes.
 * @param {string} modelId - Raw model id.
 * @returns {string} Base model name.
 */
function getModelBaseName(modelId) {
  if (!modelId || typeof modelId !== "string") return "";
  const lastSlash = modelId.lastIndexOf("/");
  const lastColon = modelId.lastIndexOf(":");
  const cutIndex = Math.max(lastSlash, lastColon);
  return cutIndex >= 0 ? modelId.slice(cutIndex + 1) : modelId;
}

/**
 * Compatibility helper retained for old imports.
 * @param {string|null|undefined} ownedBy
 * @returns {string}
 */
function resolveVendorLabel(ownedBy) {
  const normalized = typeof ownedBy === "string" ? ownedBy.trim() : "";
  if (!normalized) return "Other";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}


/**
 * Builds a display name with provider prefix.
 * @param {string|null} providerId - Provider identifier.
 * @param {string} modelId - Raw model id.
 * @returns {string} Display name.
 */
function buildModelDisplayName(providerId, modelId) {
  return typeof modelId === "string" ? modelId : "";
}

/**
 * Builds a combined model id for UI selection.
 * @param {string|null} providerId - Provider identifier.
 * @param {string} modelId - Raw model id.
 * @returns {string} Combined model id.
 */
function buildCombinedModelId(providerId, modelId) {
  const provider = normalizeProviderId(providerId);
  return `${provider}:${modelId}`;
}

/**
 * Parses a combined model id into provider + raw model id.
 * @param {string} combinedId - Combined model id.
 * @returns {{provider: string, modelId: string}} Parsed data.
 */
function parseCombinedModelId(combinedId) {
  if (!combinedId || typeof combinedId !== "string") {
    return { provider: "openrouter", modelId: "" };
  }
  const splitIndex = combinedId.indexOf(":");
  if (splitIndex === -1) {
    return { provider: "openrouter", modelId: combinedId };
  }
  const provider = normalizeProviderId(combinedId.slice(0, splitIndex));
  const modelId = combinedId.slice(splitIndex + 1);
  return { provider, modelId };
}

/**
 * Parses models API response into a normalized list.
 * @param {any} payload - Models response payload.
 * @returns {Array<{id: string, name: string}>} Normalized models.
 */
function parseModelsResponse(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.data || []);
  return list.map((model) => ({
    id: model.id,
    name: model.name || model.id
  }));
}

/**
 * Groups models by their provider
 * @param {Array<{id: string}>} models - Array of model objects
 * @returns {Object} Models grouped by provider
 */
function groupModelsByProvider(models) {
  const grouped = {};
  models.forEach(model => {
    const provider = getProvider(model.id);
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(model);
  });

  // Sort models within each provider group
  Object.keys(grouped).forEach(provider => {
    grouped[provider].sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
  });

  return grouped;
}


const sharedUtilsStreamingModule = (typeof globalThis !== "undefined" && globalThis.sharedUtilsStreaming)
  || (typeof module !== "undefined" && module.exports ? require("./utils-streaming.js") : null)
  || {};

const {
  renderStreamingText: renderStreamingTextImpl = async (container, text) => {
    if (container) container.textContent = text;
  },
  extractReasoningFromStreamChunk: extractReasoningFromStreamChunkImpl = () => ({ content: "", reasoning: "" }),
  getTokenBarStyle: getTokenBarStyleImpl = () => ({ percent: 0, gradient: "linear-gradient(90deg, var(--color-success, #22c55e), #16a34a)" }),
  getStreamingFallbackMessage: getStreamingFallbackMessageImpl = () => null,
  removeReasoningBubbles: removeReasoningBubblesImpl = () => {},
  formatThreadModelLabel: formatThreadModelLabelImpl = () => "Model: Default",
  buildSummarizerMessages: buildSummarizerMessagesImpl = () => []
} = sharedUtilsStreamingModule;

/**
 * Formats a date as a relative time string (e.g., "2 hours ago")
 * @param {Date|number} date - Date object or timestamp
 * @returns {string} Formatted relative time
 */
function formatRelativeTime(date) {
  const now = Date.now();
  const timestamp = date instanceof Date ? date.getTime() : date;
  const diffSeconds = Math.floor((now - timestamp) / 1000);

  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Truncates text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Deep clones an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Batches multiple chrome.storage operations
 * @param {Array<Promise>} operations - Array of storage promises
 * @returns {Promise<Array>} Results of all operations
 */
async function batchStorageOperations(operations) {
  return Promise.all(operations);
}

if (typeof module !== "undefined") {
  module.exports = {
    escapeHtml,
    validateUrl,
    retryWithBackoff,
    debounce,
    clearPromptAfterSend,
    buildImageOpenUrl,
    getProvider,
    normalizeProviderId,
    getProviderLabel,
    getProviderApiKeyPlaceholder,
    getProviderStorageKey,
    getModelBaseName,
    resolveVendorLabel,
    buildModelDisplayName,
    buildCombinedModelId,
    parseCombinedModelId,
    parseModelsResponse,
    groupModelsByProvider,
    formatRelativeTime,
    truncateText,
    deepClone,
    batchStorageOperations,
    renderStreamingText: renderStreamingTextImpl,
    extractReasoningFromStreamChunk: extractReasoningFromStreamChunkImpl,
    getTokenBarStyle: getTokenBarStyleImpl,
    getStreamingFallbackMessage: getStreamingFallbackMessageImpl,
    removeReasoningBubbles: removeReasoningBubblesImpl,
    formatThreadModelLabel: formatThreadModelLabelImpl,
    buildSummarizerMessages: buildSummarizerMessagesImpl
  };
}
