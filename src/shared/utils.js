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
function normalizeProviderId(providerId) {
  if (providerId === "openrouter" || providerId === "naga") {
    return providerId;
  }
  return "openrouter";
}

/**
 * Returns a display label for a provider id.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Display label.
 */
function getProviderLabel(providerId) {
  return normalizeProviderId(providerId) === "naga" ? "NagaAI" : "OpenRouter";
}

/**
 * Returns an API key placeholder for a provider.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Placeholder prefix.
 */
function getProviderApiKeyPlaceholder(providerId) {
  return normalizeProviderId(providerId) === "naga" ? "ng-..." : "sk-or-...";
}

/**
 * Builds a provider-scoped storage key.
 * @param {string} baseKey - Base storage key.
 * @param {string|null} providerId - Provider identifier.
 * @returns {string} Provider-scoped key.
 */
function getProviderStorageKey(baseKey, providerId) {
  const provider = normalizeProviderId(providerId);
  if (provider === "openrouter") {
    return baseKey;
  }
  return `${baseKey}_${provider}`;
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
 * Resolves a vendor label from Naga owned_by + startups map.
 * @param {string|null|undefined} ownedBy - owned_by value from Naga.
 * @param {Record<string, string>} startupsMap - id -> display_name.
 * @returns {string} Vendor label.
 */
function resolveNagaVendorLabel(ownedBy, startupsMap = {}) {
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

/**
 * Renders text with streaming effect - optimized to apply markdown only once at the end
 * @param {HTMLElement} container - Container element to render into
 * @param {string} text - Text to render
 * @param {number} chunkSize - Number of words per chunk (default: 10)
 * @param {number} delay - Delay between chunks in ms (default: 30)
 * @returns {Promise<void>}
 */
async function renderStreamingText(container, text, chunkSize = 10, delay = 30) {
  const words = text.split(' ');
  let currentText = '';

  // Create a temporary text node for streaming
  const textNode = document.createTextNode('');
  container.appendChild(textNode);

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, Math.min(i + chunkSize, words.length));
    currentText += (i > 0 ? ' ' : '') + chunk.join(' ');

    // Update text node (no HTML parsing - super fast)
    textNode.textContent = currentText;

    // Small delay for streaming effect
    if (i + chunkSize < words.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Remove text node
  textNode.remove();

  // Apply markdown rendering once at the end (single parse)
  if (typeof applyMarkdownStyles === 'function') {
    applyMarkdownStyles(container, text);
  } else {
    container.textContent = text;
  }
}

/**
 * Extracts reasoning wrapped in <think> tags from a streaming chunk.
 * Keeps tag fragments between chunks via state.carry.
 * @param {{inReasoning?: boolean, carry?: string}} state - Streaming parser state (mutated).
 * @param {string} chunk - Incoming chunk text.
 * @returns {{content: string, reasoning: string}} Parsed deltas.
 */
function extractReasoningFromStreamChunk(state, chunk) {
  const target = (state && typeof state === "object") ? state : {};
  if (typeof target.inReasoning !== "boolean") {
    target.inReasoning = false;
  }
  if (typeof target.carry !== "string") {
    target.carry = "";
  }

  const startTag = "<think>";
  const endTag = "</think>";
  let input = target.carry + (typeof chunk === "string" ? chunk : "");
  target.carry = "";

  let contentOut = "";
  let reasoningOut = "";

  while (input.length > 0) {
    if (target.inReasoning) {
      const endIdx = input.indexOf(endTag);
      if (endIdx === -1) {
        const partialIdx = input.lastIndexOf("</");
        if (partialIdx !== -1 && partialIdx > input.length - endTag.length) {
          reasoningOut += input.slice(0, partialIdx);
          target.carry = input.slice(partialIdx);
        } else {
          reasoningOut += input;
        }
        input = "";
      } else {
        reasoningOut += input.slice(0, endIdx);
        input = input.slice(endIdx + endTag.length);
        target.inReasoning = false;
      }
    } else {
      const startIdx = input.indexOf(startTag);
      if (startIdx === -1) {
        const partialIdx = input.lastIndexOf("<");
        if (partialIdx !== -1 && partialIdx > input.length - startTag.length) {
          contentOut += input.slice(0, partialIdx);
          target.carry = input.slice(partialIdx);
        } else {
          contentOut += input;
        }
        input = "";
      } else {
        contentOut += input.slice(0, startIdx);
        input = input.slice(startIdx + startTag.length);
        target.inReasoning = true;
      }
    }
  }

  return { content: contentOut, reasoning: reasoningOut };
}

/**
 * Computes token bar percentage and gradient
 * @param {number|null} tokens - Token count
 * @param {number} maxTokens - Maximum token count for the bar
 * @returns {{percent: number, gradient: string}} Style info for token bar
 */
function getTokenBarStyle(tokens, maxTokens = 4000) {
  if (!tokens || !maxTokens) {
    return { percent: 0, gradient: 'linear-gradient(90deg, var(--color-success, #22c55e), #16a34a)' };
  }
  const percent = Math.round(Math.min((tokens / maxTokens) * 100, 100));
  let gradient = 'linear-gradient(90deg, var(--color-success, #22c55e), #16a34a)';
  if (percent >= 80) {
    gradient = 'linear-gradient(90deg, var(--color-error, #ef4444), #dc2626)';
  } else if (percent >= 50) {
    gradient = 'linear-gradient(90deg, var(--color-warning, #eab308), #ca8a04)';
  }
  return { percent, gradient };
}

/**
 * Builds a fallback error message when a stream ends without an answer.
 * @param {string} answerText - The accumulated answer text
 * @param {boolean} hasReasoning - Whether reasoning was streamed
 * @returns {string|null} Error message to display, or null if answer exists
 */
function getStreamingFallbackMessage(answerText, hasReasoning = false) {
  const trimmed = typeof answerText === "string" ? answerText.trim() : "";
  if (trimmed.length > 0) {
    return null;
  }
  if (hasReasoning) {
    return "Stream ended after reasoning but no final answer was returned. Please try again.";
  }
  return "Stream ended with no answer received. Please try again.";
}

/**
 * Removes reasoning bubble elements from a container.
 * @param {HTMLElement|Document} container - Container to clean.
 */
function removeReasoningBubbles(container) {
  if (!container || typeof container.querySelectorAll !== "function") return;
  container.querySelectorAll('.reasoning-content, .chat-reasoning-bubble').forEach((el) => {
    el.remove();
  });
}

/**
 * Determines if a model explicitly supports reasoning.
 * Defaults to true when metadata is absent.
 * @param {any} model
 * @returns {boolean}
 */
function modelSupportsReasoning(model) {
  if (!model || typeof model !== "object") return true;
  const supportedParameters = Array.isArray(model.supportedParameters)
    ? model.supportedParameters
    : (Array.isArray(model.supported_parameters) ? model.supported_parameters : null);
  const providerId = typeof model.provider === "string"
    ? model.provider
    : (typeof model.id === "string" && model.id.includes(":")
      ? model.id.split(":")[0]
      : null);
  if (supportedParameters) {
    if (providerId === "naga") {
      return true;
    }
    const normalized = supportedParameters
      .map((value) => {
        if (typeof value === "string") return value.toLowerCase();
        if (value && typeof value === "object") {
          if (typeof value.name === "string") return value.name.toLowerCase();
          if (typeof value.id === "string") return value.id.toLowerCase();
        }
        return "";
      })
      .filter(Boolean);
    return normalized.includes("reasoning") || normalized.includes("reasoning_effort");
  }
  const checks = [
    model.supportsReasoning,
    model.supports_reasoning,
    model.reasoning,
    model.capabilities?.reasoning,
    model.capabilities?.supports_reasoning,
    model.capabilities?.reasoning_support,
    model.architecture?.supports_reasoning,
    model.architecture?.reasoning,
    model.metadata?.reasoning,
    model.metadata?.supports_reasoning
  ];
  for (const value of checks) {
    if (typeof value === "boolean") return value;
  }
  return true;
}

/**
 * Formats the active model label for a thread/project.
 * @param {{model?: string, modelDisplayName?: string}} project
 * @returns {string}
 */
function formatThreadModelLabel(project = {}) {
  if (project && typeof project.modelDisplayName === "string" && project.modelDisplayName.trim()) {
    return `Model: ${project.modelDisplayName.trim()}`;
  }
  if (project && typeof project.model === "string" && project.model.trim()) {
    return `Model: ${project.model.trim()}`;
  }
  return "Model: Default";
}

/**
 * Builds a summarization prompt for older thread history.
 * @param {string|null} previousSummary - Existing summary if any
 * @param {Array<{role: string, content: string}>} historyToSummarize - Messages to summarize
 * @returns {Array<{role: string, content: string}>}
 */
function buildSummarizerMessages(previousSummary, historyToSummarize) {
  const systemPrompt = [
    "You are a concise summarizer.",
    "Capture user goals, decisions, constraints, key facts, and open questions.",
    "Avoid long quotes and verbosity; keep only durable context."
  ].join(" ");

  const messages = [{ role: "system", content: systemPrompt }];
  if (previousSummary) {
    messages.push({ role: "system", content: `Summary so far:\n${previousSummary}` });
  }
  if (Array.isArray(historyToSummarize)) {
    messages.push(...historyToSummarize);
  }
  return messages;
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
    resolveNagaVendorLabel,
    buildModelDisplayName,
    buildCombinedModelId,
    parseCombinedModelId,
    parseModelsResponse,
    groupModelsByProvider,
    formatRelativeTime,
    truncateText,
    deepClone,
    batchStorageOperations,
    renderStreamingText,
    extractReasoningFromStreamChunk,
    getTokenBarStyle,
    getStreamingFallbackMessage,
    removeReasoningBubbles,
    modelSupportsReasoning,
    formatThreadModelLabel,
    buildSummarizerMessages
  };
}
