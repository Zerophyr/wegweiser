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
 * Computes token bar percentage and gradient
 * @param {number|null} tokens - Token count
 * @param {number} maxTokens - Maximum token count for the bar
 * @returns {{percent: number, gradient: string}} Style info for token bar
 */
function getTokenBarStyle(tokens, maxTokens = 4000) {
  if (!tokens || !maxTokens) {
    return { percent: 0, gradient: 'linear-gradient(90deg, #22c55e, #16a34a)' };
  }
  const percent = Math.round(Math.min((tokens / maxTokens) * 100, 100));
  let gradient = 'linear-gradient(90deg, #22c55e, #16a34a)';
  if (percent >= 80) {
    gradient = 'linear-gradient(90deg, #ef4444, #dc2626)';
  } else if (percent >= 50) {
    gradient = 'linear-gradient(90deg, #eab308, #ca8a04)';
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
    getProvider,
    groupModelsByProvider,
    formatRelativeTime,
    truncateText,
    deepClone,
    batchStorageOperations,
    renderStreamingText,
    getTokenBarStyle,
    getStreamingFallbackMessage,
    buildSummarizerMessages
  };
}
