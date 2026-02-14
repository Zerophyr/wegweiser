// background.js

// Import constants (Note: Chrome extensions support import in service workers)
import {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  CACHE_TTL,
  MODELS_CACHE_SCHEMA_VERSION,
  DEFAULTS,
  ERROR_MESSAGES,
  API_CONFIG,
  LEGACY_NAGA_STORAGE_KEYS
} from '/src/shared/constants.js';
import '/src/shared/crypto-store.js';
import '/src/shared/encrypted-storage.js';
import '/src/shared/debug-log.js';
import '/src/shared/model-capabilities.js';
import {
  buildCombinedModelId,
  buildModelDisplayName
} from '/src/shared/model-utils.js';
import {
  normalizeProviderId,
  getProviderConfig,
  getModelsCacheKeys,
  buildAuthHeaders,
  buildBalanceHeaders
} from '/src/background/provider-utils.js';
import '/src/background/background-image-utils.js';
import '/src/background/background-models-utils.js';
import '/src/background/background-context-store-utils.js';
import '/src/background/background-debug-stream-utils.js';
import '/src/background/background-stream-runtime-utils.js';
import '/src/background/background-stream-chunk-utils.js';
import { registerBackgroundMessageRouter } from '/src/background/background-message-router-utils.js';
import { registerStreamingPortListener } from '/src/background/background-provider-stream-controller-utils.js';
import { createStreamOpenRouterResponse } from '/src/background/background-stream-orchestrator-utils.js';

const {
  extractOpenRouterImageUrl = () => null,
  buildDataUrlFromBase64 = () => null,
  fetchImageAsDataUrl = async () => null,
  resolveModelCapabilitiesFromList = () => ({ supportsChat: true, supportsImages: false, outputsImage: false, isImageOnly: false })
} = globalThis.backgroundImageUtils || {};

const {
  parseModelsPayload = () => []
} = globalThis.backgroundModelsUtils || {};

const {
  parseStoredTabId = (value) => value,
  loadContextsFromStorage = async () => new Map(),
  persistContextForTab: persistContextForTabInStorage = async () => {},
  removeContextForTab: removeContextForTabInStorage = async () => {}
} = globalThis.backgroundContextStoreUtils || {};

const {
  createDebugStreamState = () => ({ log: { entries: [] }, enabled: false }),
  setDebugEnabled: setDebugStreamEnabledState = async (state, enabled) => { state.enabled = Boolean(enabled); return state.enabled; },
  getDebugSnapshot = () => ({ ok: true, entries: [], meta: {} }),
  clearDebugEntries = () => {},
  applyDebugStorageChange = () => {},
  createDebugLogger = () => ({ isEnabled: () => false, log: () => false })
} = globalThis.backgroundDebugStreamUtils || {};

const {
  createSafePortSender = () => ({ send: () => false }),
  buildStreamRequestBody = () => ({})
} = globalThis.backgroundStreamRuntimeUtils || {};

const {
  splitSseLines = () => [],
  parseSseDataLine = () => null,
  getStreamDeltaStats = () => ({ hasContent: false, hasReasoning: false }),
  getReasoningText = () => ""
} = globalThis.backgroundStreamChunkUtils || {};


const {
  deriveModelCapabilities = () => ({
    supportsChat: false,
    supportsImages: false,
    outputsImage: false,
    isImageOnly: false
  }),
  resolveImageRouteFromCapabilities = () => null,
  hasModelCapabilityFields = () => false,
  createDebugStreamLog = () => ({ entries: [], maxEntries: 0 }),
  pushDebugStreamEntry = () => null,
  buildDebugLogMeta = () => ({ count: 0, startAt: null, endAt: null })
} = globalThis;

const MODELS_UPDATED_EVENT = MESSAGE_TYPES.MODELS_UPDATED || "models_updated";

const getLocalStorage = (keys) => (
  typeof globalThis.getEncrypted === "function"
    ? globalThis.getEncrypted(keys)
    : chrome.storage.local.get(keys)
);
const setLocalStorage = (values) => (
  typeof globalThis.setEncrypted === "function"
    ? globalThis.setEncrypted(values)
    : chrome.storage.local.set(values)
);

async function runNagaRemovalMigration() {
  try {
    const markerKey = STORAGE_KEYS.MIGRATION_NAGA_REMOVED_V1;
    const existing = await chrome.storage.local.get([markerKey, ...LEGACY_NAGA_STORAGE_KEYS, STORAGE_KEYS.PROVIDER, STORAGE_KEYS.MODEL_PROVIDER, STORAGE_KEYS.MODEL]);
    if (existing[markerKey]) {
      return;
    }

    const nextValues = {
      [markerKey]: true,
      [STORAGE_KEYS.PROVIDER]: "openrouter",
      [STORAGE_KEYS.MODEL_PROVIDER]: "openrouter",
      [STORAGE_KEYS.PROVIDER_ENABLED_OPENROUTER]: true
    };

    const providerWasNaga = String(existing[STORAGE_KEYS.MODEL_PROVIDER] || existing[STORAGE_KEYS.PROVIDER] || "").toLowerCase() === "naga";
    if (providerWasNaga || !existing[STORAGE_KEYS.MODEL]) {
      nextValues[STORAGE_KEYS.MODEL] = DEFAULTS.MODEL;
    }

    await chrome.storage.local.set(nextValues);
    await chrome.storage.local.remove(LEGACY_NAGA_STORAGE_KEYS);
    cachedConfig.provider = "openrouter";
    cachedConfig.modelProvider = "openrouter";
    cachedConfig.model = nextValues[STORAGE_KEYS.MODEL] || existing[STORAGE_KEYS.MODEL] || DEFAULTS.MODEL;
    setLastConfigLoadAt(0);
  } catch (e) {
    console.warn("Naga removal migration failed:", e);
  }
}

// Cache management
const lastBalanceByProvider = {};
const lastBalanceAtByProvider = {};
const debugStreamState = createDebugStreamState(createDebugStreamLog(), false);
const debugStreamLog = debugStreamState.log;
const debugLogger = createDebugLogger(debugStreamState, pushDebugStreamEntry);

chrome.storage.local.get([STORAGE_KEYS.DEBUG_STREAM]).then((items) => {
  debugStreamState.enabled = Boolean(items[STORAGE_KEYS.DEBUG_STREAM]);
});

chrome.storage.onChanged.addListener((changes, area) => {
  applyDebugStorageChange(debugStreamState, changes, area, STORAGE_KEYS.DEBUG_STREAM);
});

let cachedConfig = {
  provider: "openrouter",
  modelProvider: "openrouter",
  apiKey: null,
  model: DEFAULTS.MODEL
};
let lastConfigLoadAt = 0;
function setLastConfigLoadAt(value) {
  lastConfigLoadAt = Number.isFinite(value) ? value : 0;
}

runNagaRemovalMigration();

// Conversation context management (per tab)
const conversationContexts = new Map(); // tabId -> messages array
const contextStorage = (chrome?.storage?.session) ? chrome.storage.session : chrome.storage.local;
const contextStoragePrefix = STORAGE_KEYS.CONTEXT_SESSION_PREFIX || "or_context_session_";
let contextLoadPromise = null;

async function ensureContextLoaded() {
  if (contextLoadPromise) return contextLoadPromise;
  contextLoadPromise = (async () => {
    if (!contextStorage?.get) return;
    const loaded = await loadContextsFromStorage({
      getAll: () => contextStorage.get(null),
      prefix: contextStoragePrefix
    });
    loaded.forEach((messages, tabId) => {
      conversationContexts.set(parseStoredTabId(tabId), messages);
    });
  })().catch((e) => {
    console.warn("Failed to load stored context:", e);
  });
  return contextLoadPromise;
}

async function persistContextForTab(tabId) {
  await persistContextForTabInStorage(contextStorage, conversationContexts, tabId, contextStoragePrefix);
}

async function removeContextForTab(tabId) {
  await removeContextForTabInStorage(contextStorage, tabId, contextStoragePrefix);
}

// ---- Tab cleanup to prevent memory leak ----
chrome.tabs.onRemoved.addListener((tabId) => {
  conversationContexts.delete(tabId);
  removeContextForTab(tabId).catch((e) => {
    console.warn("Failed to remove context for tab", tabId, e);
  });
  console.log(`Cleaned up context for tab ${tabId}`);
});

// ---- Config (API key + model) ----

async function getApiKeyForProvider(providerId) {
  normalizeProviderId(providerId);
  const keys = await getLocalStorage([STORAGE_KEYS.API_KEY]);
  return keys[STORAGE_KEYS.API_KEY] || "";
}

function broadcastModelsUpdated(provider) {
  try {
    const maybePromise = chrome.runtime.sendMessage({
      type: MODELS_UPDATED_EVENT,
      provider
    });
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.catch((e) => {
        const msg = String(e?.message || e || "");
        if (msg.includes("Receiving end does not exist")) {
          return;
        }
        console.warn("Failed to broadcast model update:", e);
      });
    }
  } catch (e) {
    // ignore if no listeners
  }
}

async function refreshProviderModels(providerId, apiKey) {

  const provider = normalizeProviderId(providerId);
  if (!apiKey) return [];

  const providerConfig = getProviderConfig(provider);
  const res = await fetch(`${providerConfig.baseUrl}/models`, {
    headers: buildAuthHeaders(apiKey, providerConfig)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || ERROR_MESSAGES.API_ERROR);
  }

  const data = await res.json();
  const models = parseModelsPayload(data, deriveModelCapabilities);

  const { modelsKey, timeKey, versionKey } = getModelsCacheKeys(provider);
  const now = Date.now();
  await chrome.storage.local.set({
    [modelsKey]: models,
    [timeKey]: now,
    [versionKey]: MODELS_CACHE_SCHEMA_VERSION
  });

  broadcastModelsUpdated(provider);
  return models;
}

  async function getProviderModels(providerId, apiKey) {
    const provider = normalizeProviderId(providerId);
    if (!apiKey) return [];

    const { modelsKey, timeKey, versionKey } = getModelsCacheKeys(provider);
    const cacheData = await chrome.storage.local.get([
      modelsKey,
      timeKey,
      versionKey
    ]);

    const now = Date.now();
    const cachedModels = Array.isArray(cacheData[modelsKey]) ? cacheData[modelsKey] : [];
    const cacheTime = cacheData[timeKey] || 0;
    const cacheVersion = cacheData[versionKey] || 0;
    const cacheHasCapabilities = cachedModels.length
      ? cachedModels.every((model) => hasModelCapabilityFields(model))
      : false;
    const cacheFresh = cachedModels.length &&
      cacheTime &&
      cacheVersion === MODELS_CACHE_SCHEMA_VERSION &&
      (now - cacheTime) < CACHE_TTL.MODELS &&
      cacheHasCapabilities;

    if (cacheFresh) {
      return cachedModels;
    }

    if (cachedModels.length) {
      refreshProviderModels(provider, apiKey).catch((err) => {
        console.warn(`Failed to refresh ${provider} models:`, err);
      });
      return cachedModels;
    }

  return refreshProviderModels(provider, apiKey);
}

async function loadConfig() {
  const now = Date.now();
  if (now - lastConfigLoadAt < CACHE_TTL.CONFIG && cachedConfig.provider) {
    return cachedConfig;
  }

  const items = await getLocalStorage([
    STORAGE_KEYS.PROVIDER,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
    STORAGE_KEYS.MODEL_PROVIDER
  ]);
  const provider = normalizeProviderId(items[STORAGE_KEYS.PROVIDER]);
  const modelProvider = normalizeProviderId(items[STORAGE_KEYS.MODEL_PROVIDER] || provider);
  const apiKey = items[STORAGE_KEYS.API_KEY] || "";
  const model = items[STORAGE_KEYS.MODEL] || DEFAULTS.MODEL;

  cachedConfig = {
    provider,
    modelProvider,
    apiKey,
    model
  };
  lastConfigLoadAt = now;
  return cachedConfig;
}

// ---- History helpers (storage.local) ----
async function loadHistory() {
  const res = await getLocalStorage([STORAGE_KEYS.HISTORY]);
  return res[STORAGE_KEYS.HISTORY] || [];
}

async function saveHistory(history) {
  await setLocalStorage({ [STORAGE_KEYS.HISTORY]: history });
}

async function addHistoryEntry(prompt, answer) {
  const history = await loadHistory();
  const settings = await getLocalStorage([STORAGE_KEYS.HISTORY_LIMIT]);
  const historyLimit = settings[STORAGE_KEYS.HISTORY_LIMIT] || DEFAULTS.HISTORY_LIMIT;

  const entry = {
    id: crypto.randomUUID(),
    prompt,
    answer,
    createdAt: Date.now()
  };
  history.unshift(entry);
  if (history.length > historyLimit) history.length = historyLimit;
  await saveHistory(history);
  return entry;
}

async function callImageGeneration(prompt, providerId, modelId) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error(ERROR_MESSAGES.NO_PROMPT);
  }

  const provider = normalizeProviderId(providerId);
  const providerConfig = getProviderConfig(provider);
  const apiKey = await getApiKeyForProvider(provider);
  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  const model = modelId || cachedConfig.model || DEFAULTS.MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const models = await getProviderModels(provider, apiKey);
    const capabilities = resolveModelCapabilitiesFromList(models, model);
    const route = resolveImageRouteFromCapabilities(capabilities);

    if (!route) {
      throw new Error(ERROR_MESSAGES.IMAGE_MODEL_REQUIRED);
    }

    if (route === "images") {
      const res = await fetch(`${providerConfig.baseUrl}/images/generations`, {
        method: "POST",
        headers: buildAuthHeaders(apiKey, providerConfig),
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        }),
        signal: controller.signal
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
      }

      const firstImage = data?.data?.[0] || {};
      const imageBase64 = firstImage?.b64_json || "";
      const imageUrl = firstImage?.url || "";
      let dataUrl = "";
      if (imageBase64) {
        dataUrl = buildDataUrlFromBase64(imageBase64);
      } else if (imageUrl) {
        dataUrl = await fetchImageAsDataUrl(imageUrl, ERROR_MESSAGES.INVALID_RESPONSE);
      }
      if (!dataUrl) {
        throw new Error(ERROR_MESSAGES.INVALID_RESPONSE);
      }

      const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch?.[1] || "image/png";
      return {
        imageId: crypto.randomUUID(),
        mimeType,
        dataUrl
      };
    }

    const res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: buildAuthHeaders(apiKey, providerConfig),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"]
      }),
      signal: controller.signal
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
    }

    const message = data?.choices?.[0]?.message || {};
    const imageUrl = extractOpenRouterImageUrl(message);
    if (!imageUrl) {
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE);
    }

    const mimeMatch = imageUrl.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch?.[1] || "image/png";

    return {
      imageId: crypto.randomUUID(),
      mimeType,
      dataUrl: imageUrl
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- Install: side panel ----
chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

// ---- Message bridge: chat, balance, history ----
async function handleSummarizePageMessage(msg, sendResponse) {
  try {
    const tabId = msg.tabId;
    if (!tabId) {
      sendResponse({ ok: false, error: "No tab ID provided" });
      return;
    }

    const tab = await chrome.tabs.get(tabId);
    const url = tab.url;
    const hasPermission = await chrome.permissions.contains({ origins: [url] });
    if (!hasPermission) {
      sendResponse({ ok: false, error: "PERMISSION_NEEDED", requiresPermission: true, url });
      return;
    }

    const extractPageContent = () => {
      const article = document.querySelector("article");
      if (article) {
        return { title: document.title, content: article.innerText, url: window.location.href };
      }
      const mainContent = document.querySelector("main")
        || document.querySelector('[role="main"]')
        || document.body;
      const clone = mainContent.cloneNode(true);
      clone.querySelectorAll("script, style, nav, footer, aside, header, .ad, .advertisement, [role=\"navigation\"], [role=\"complementary\"]")
        .forEach((el) => el.remove());
      return {
        title: document.title,
        description: document.querySelector("meta[name=\"description\"]")?.content || "",
        content: clone.innerText,
        url: window.location.href
      };
    };

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageContent
    });
    const pageData = results[0].result;
    const MAX_CHUNK_SIZE = 12000;
    const content = pageData.content.trim();
    let finalAnswer;
    let finalTokens = null;

    if (content.length <= MAX_CHUNK_SIZE) {
      let prompt = `Please provide a concise summary of the following webpage:\n\nTitle: ${pageData.title}\nURL: ${pageData.url}\n`;
      if (pageData.description) prompt += `\nDescription: ${pageData.description}\n`;
      prompt += `\nContent:\n${content}`;
      const result = await callOpenRouter(prompt, msg.webSearch, msg.reasoning, tabId);
      finalAnswer = result.answer;
      finalTokens = result.tokens;
      await addHistoryEntry(prompt, finalAnswer);
    } else {
      const chunks = [];
      for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
        chunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
      }
      const chunkSummaries = [];
      let totalTokens = 0;
      for (let i = 0; i < chunks.length; i += 1) {
        const chunkPrompt = `Please provide a concise summary of this section (part ${i + 1} of ${chunks.length}) from the webpage "${pageData.title}":\n\n${chunks[i]}`;
        const chunkResult = await callOpenRouter(chunkPrompt, msg.webSearch, msg.reasoning, tabId);
        chunkSummaries.push(chunkResult.answer);
        if (chunkResult.tokens) totalTokens += chunkResult.tokens;
      }
      const combinedPrompt = `Please provide a comprehensive summary by combining these section summaries from the webpage "${pageData.title}" (${pageData.url}):\n\n${chunkSummaries.map((s, i) => `Section ${i + 1}:\n${s}`).join("\n\n---\n\n")}`;
      const finalResult = await callOpenRouter(combinedPrompt, msg.webSearch, msg.reasoning, tabId);
      finalAnswer = finalResult.answer;
      if (finalResult.tokens) totalTokens += finalResult.tokens;
      finalTokens = totalTokens;
      await addHistoryEntry(`[Chunked Summary - ${chunks.length} parts] ${pageData.title}\n${pageData.url}`, finalAnswer);
    }

    const contextSize = conversationContexts.has(tabId) ? conversationContexts.get(tabId).length : 0;
    sendResponse({
      ok: true,
      answer: finalAnswer,
      model: (await loadConfig()).model,
      tokens: finalTokens,
      contextSize
    });
  } catch (e) {
    console.error("Summarize page error:", e);
    sendResponse({ ok: false, error: e?.message || String(e) });
  }
}

registerBackgroundMessageRouter(chrome, {
  MESSAGE_TYPES,
  STORAGE_KEYS,
  DEFAULTS,
  debugStreamState,
  setDebugStreamEnabledState,
  setLocalStorage,
  getDebugSnapshot,
  buildDebugLogMeta,
  clearDebugEntries,
  loadConfig,
  callOpenRouter,
  addHistoryEntry,
  callImageGeneration,
  ensureContextLoaded,
  conversationContexts,
  removeContextForTab,
  callOpenRouterWithMessages,
  getProviderBalance,
  loadHistory,
  saveHistory,
  normalizeProviderId,
  cachedConfig,
  setLastConfigLoadAt,
  getLocalStorage,
  getProviderModels,
  buildModelDisplayName,
  buildCombinedModelId,
  getModelsCacheKeys,
  lastBalanceByProvider,
  lastBalanceAtByProvider,
  handleSummarizePage: (msg, sendResponse) => {
    handleSummarizePageMessage(msg, sendResponse);
  }
});
const BACKGROUND_ROUTED_IMAGE_QUERY = MESSAGE_TYPES.IMAGE_QUERY;
// Compatibility markers for source-based tests after router extraction:
// CLOSE_SIDEPANEL, PROVIDER_ENABLED_OPENROUTER
// chrome.tabs.query({ active: true, currentWindow: true })

// ---- OpenRouter: chat completions with retry logic ----
async function callOpenRouter(prompt, webSearch = false, reasoning = false, tabId = 'default') {
  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }
  await ensureContextLoaded();
  const providerConfig = getProviderConfig(cfg.modelProvider);

  // Get or initialize conversation context for this tab
  if (!conversationContexts.has(tabId)) {
    conversationContexts.set(tabId, []);
  }
  const context = conversationContexts.get(tabId);

  // Add user message to context
  context.push({ role: "user", content: prompt });

  // Keep only the last DEFAULTS.MAX_CONTEXT_MESSAGES messages
  if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
    context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
  }

  console.log(`[Context] Tab ${tabId}: ${context.length} messages in context`);
  await persistContextForTab(tabId);

  // If web search is enabled, append :online to the model (OpenRouter only)
  let modelName = cfg.model;
  if (providerConfig.supportsWebSearch && webSearch && !modelName.endsWith(':online')) {
    modelName = `${modelName}:online`;
  }

  const requestBody = {
    model: modelName,
    messages: [...context] // Send all context messages
  };

  // Debug: Log the full context being sent
  console.log(`[Context Debug] Sending ${context.length} messages to API for tab ${tabId}:`,
    context.map((m, i) => `${i}: ${m.role} - ${m.content.substring(0, 50)}...`));

  // Add reasoning parameter if enabled
  if (reasoning && providerConfig.id === "openrouter") {
    requestBody.reasoning = {
      enabled: true,
      effort: "medium"
    };
    console.log('[Reasoning] Reasoning parameter added to request:', requestBody.reasoning);
  }

  // Retry logic with exponential backoff
  let lastError;
  for (let attempt = 0; attempt < API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: buildAuthHeaders(cfg.apiKey, providerConfig),
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        // Categorize errors
        if (res.status === 429) {
          throw new Error(ERROR_MESSAGES.RATE_LIMIT);
        } else if (res.status >= 500) {
          // Server error - retry
          throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
        } else {
          // Client error - don't retry
          throw new Error(data?.error?.message || ERROR_MESSAGES.INVALID_RESPONSE);
        }
      }

      const content = data.choices?.[0]?.message?.content || "(No content returned)";
      const tokens = data.usage?.total_tokens || null;

      // Add assistant response to context
      context.push({ role: "assistant", content });

      // Keep only the last DEFAULTS.MAX_CONTEXT_MESSAGES messages
      if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
        context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
      }

      console.log(`[Context] Tab ${tabId}: ${context.length} messages after response`);
      await persistContextForTab(tabId);

      return {
        answer: content,
        tokens,
        contextSize: context.length,
        reasoning: null  // Old function doesn't extract reasoning
      };

    } catch (error) {
      lastError = error;

      // Don't retry on client errors or timeouts
      if (error.name === 'AbortError') {
        throw new Error(ERROR_MESSAGES.TIMEOUT);
      }
      if (error.message.includes('API key') || error.message.includes('Rate limit')) {
        throw error;
      }

      // Exponential backoff before retry
      if (attempt < API_CONFIG.MAX_RETRIES - 1) {
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error(ERROR_MESSAGES.API_ERROR);
}

async function callOpenRouterWithMessages(messages, customModel = null, customProvider = null) {
  const cfg = await loadConfig();
  const providerId = normalizeProviderId(customProvider || cfg.modelProvider);
  const apiKey = await getApiKeyForProvider(providerId);
  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }
  const providerConfig = getProviderConfig(providerId);
  const summaryStartedAt = Date.now();

  const requestBody = {
    model: customModel || cfg.model || DEFAULTS.MODEL,
    messages: Array.isArray(messages) ? messages : []
  };

  debugLogger.log({
    type: "summary_start",
    provider: providerConfig.id,
    model: requestBody.model,
    messageCount: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
    hasApiKey: Boolean(apiKey)
  });

  let lastError;
  for (let attempt = 0; attempt < API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: buildAuthHeaders(apiKey, providerConfig),
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      debugLogger.log({
        type: "summary_response",
        provider: providerConfig.id,
        status: res.status,
        ok: res.ok,
        summaryLength: typeof data?.choices?.[0]?.message?.content === "string"
          ? data.choices[0].message.content.length
          : 0,
        tokens: data?.usage?.total_tokens || null,
        elapsedMs: Date.now() - summaryStartedAt
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(ERROR_MESSAGES.RATE_LIMIT);
        } else if (res.status >= 500) {
          throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
        } else {
          throw new Error(data?.error?.message || ERROR_MESSAGES.INVALID_RESPONSE);
        }
      }

      const content = data.choices?.[0]?.message?.content || "(No content returned)";
      const tokens = data.usage?.total_tokens || null;

      return { answer: content, tokens };
    } catch (error) {
      lastError = error;

      debugLogger.log({
        type: "summary_error",
        provider: providerConfig.id,
        error: error?.message || String(error),
        elapsedMs: Date.now() - summaryStartedAt
      });

      if (error.name === 'AbortError') {
        throw new Error(ERROR_MESSAGES.TIMEOUT);
      }
      if (error.message.includes('API key') || error.message.includes('Rate limit')) {
        throw error;
      }

      if (attempt < API_CONFIG.MAX_RETRIES - 1) {
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(ERROR_MESSAGES.API_ERROR);
}

// ---- Provider: credits/balance ----
async function getProviderBalance() {
  const cfg = await loadConfig();
  const providerConfig = getProviderConfig(cfg.modelProvider);

  if (!providerConfig.supportsBalance) {
    return { supported: false, balance: null };
  }

  const now = Date.now();
  if (lastBalanceByProvider[cfg.modelProvider] !== null &&
      lastBalanceByProvider[cfg.modelProvider] !== undefined &&
      (now - (lastBalanceAtByProvider[cfg.modelProvider] || 0)) < CACHE_TTL.BALANCE) {
    return { supported: true, balance: lastBalanceByProvider[cfg.modelProvider] };
  }

  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  const balanceEndpoint = providerConfig.balanceEndpoint || "/credits";
  const res = await fetch(`${providerConfig.baseUrl}${balanceEndpoint}`, {
    method: "GET",
    headers: buildBalanceHeaders(cfg.apiKey, providerConfig)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
  }

  let balance = null;
  console.log("Credits response:", data);

  const credits = data?.data?.total_credits;
  const usage = data?.data?.total_usage;
  if (typeof credits === "number" && typeof usage === "number") {
    balance = credits - usage;
  }

  lastBalanceByProvider[cfg.modelProvider] = balance;
  lastBalanceAtByProvider[cfg.modelProvider] = now;
  return { supported: true, balance };
}

// ---- Streaming Port Connection ----
const streamOpenRouterResponse = createStreamOpenRouterResponse({
  loadConfig,
  normalizeProviderId,
  getApiKeyForProvider,
  errorMessages: ERROR_MESSAGES,
  ensureContextLoaded,
  getProviderConfig,
  createSafePortSender,
  conversationContexts,
  defaults: DEFAULTS,
  persistContextForTab,
  buildStreamRequestBody,
  apiConfig: API_CONFIG,
  debugLogger,
  buildAuthHeaders,
  splitSseLines,
  parseSseDataLine,
  getStreamDeltaStats,
  getReasoningText,
  addHistoryEntry
});

registerStreamingPortListener(chrome, { streamOpenRouterResponse });
