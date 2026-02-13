// background.js

// Import constants (Note: Chrome extensions support import in service workers)
import {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  CACHE_TTL,
  MODELS_CACHE_SCHEMA_VERSION,
  DEFAULTS,
  ERROR_MESSAGES,
  API_CONFIG
} from '/src/shared/constants.js';
import '/src/shared/crypto-store.js';
import '/src/shared/encrypted-storage.js';
import '/src/shared/debug-log.js';
import '/src/shared/model-capabilities.js';
import {
  buildCombinedModelId,
  buildModelDisplayName,
  resolveNagaVendorLabel
} from '/src/shared/model-utils.js';
import {
  normalizeProviderId,
  getProviderConfig,
  getModelsCacheKeys,
  buildAuthHeaders,
  buildBalanceHeaders
} from '/src/background/provider-utils.js';

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

// Cache management
const lastBalanceByProvider = {};
const lastBalanceAtByProvider = {};
const debugStreamLog = createDebugStreamLog();
let debugStreamEnabled = false;

chrome.storage.local.get([STORAGE_KEYS.DEBUG_STREAM]).then((items) => {
  debugStreamEnabled = Boolean(items[STORAGE_KEYS.DEBUG_STREAM]);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEYS.DEBUG_STREAM]) {
    debugStreamEnabled = Boolean(changes[STORAGE_KEYS.DEBUG_STREAM].newValue);
  }
});

let cachedConfig = {
  provider: "openrouter",
  modelProvider: "openrouter",
  apiKey: null,
  model: DEFAULTS.MODEL
};
let lastConfigLoadAt = 0;

// Conversation context management (per tab)
const conversationContexts = new Map(); // tabId -> messages array
const contextStorage = (chrome?.storage?.session) ? chrome.storage.session : chrome.storage.local;
const contextStoragePrefix = STORAGE_KEYS.CONTEXT_SESSION_PREFIX || "or_context_session_";
let contextLoadPromise = null;

function getContextStorageKey(tabId) {
  const keyId = tabId === undefined || tabId === null ? "default" : String(tabId);
  return `${contextStoragePrefix}${keyId}`;
}

function parseStoredTabId(tabId) {
  if (tabId === "default") return "default";
  const asNumber = Number(tabId);
  return Number.isNaN(asNumber) ? tabId : asNumber;
}

async function ensureContextLoaded() {
  if (contextLoadPromise) return contextLoadPromise;
  contextLoadPromise = (async () => {
    if (!contextStorage?.get) return;
    const all = await contextStorage.get(null);
    if (!all) return;
    Object.keys(all).forEach((key) => {
      if (!key.startsWith(contextStoragePrefix)) return;
      const tabKey = key.slice(contextStoragePrefix.length);
      const messages = all[key];
      if (Array.isArray(messages)) {
        conversationContexts.set(parseStoredTabId(tabKey), messages);
      }
    });
  })().catch((e) => {
    console.warn("Failed to load stored context:", e);
  });
  return contextLoadPromise;
}

async function persistContextForTab(tabId) {
  if (!contextStorage?.set) return;
  const key = getContextStorageKey(tabId);
  const messages = conversationContexts.get(tabId) || [];
  await contextStorage.set({ [key]: messages });
}

async function removeContextForTab(tabId) {
  if (!contextStorage?.remove) return;
  const key = getContextStorageKey(tabId);
  await contextStorage.remove([key]);
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
  const provider = normalizeProviderId(providerId);
  const keys = await getLocalStorage([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.API_KEY_NAGA
  ]);
  return provider === "naga"
    ? (keys[STORAGE_KEYS.API_KEY_NAGA] || "")
    : (keys[STORAGE_KEYS.API_KEY] || "");
}

function parseModelsPayload(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.data || []);
  return list.map((model) => {
    const supportedEndpoints = Array.isArray(model?.supported_endpoints)
      ? model.supported_endpoints
      : (Array.isArray(model?.supportedEndpoints) ? model.supportedEndpoints : []);
    const supportedParametersRaw = Array.isArray(model?.supported_parameters)
      ? model.supported_parameters
      : (Array.isArray(model?.supportedParameters) ? model.supportedParameters : null);
    const supportedParameters = supportedParametersRaw
      ? supportedParametersRaw.map((value) => String(value).toLowerCase())
      : null;
    const architecture = model?.architecture || model?.arch || null;
    const derived = deriveModelCapabilities({
      supported_endpoints: supportedEndpoints,
      architecture,
      output_modalities: model?.output_modalities,
      output_modality: model?.output_modality,
      input_modalities: model?.input_modalities,
      modality: model?.modality,
      modalities: model?.modalities
    });

    return {
      id: model.id,
      name: model.name || model.id,
      ownedBy: model.owned_by || model.ownedBy || model.owner || "",
      supportedEndpoints,
      supportedParameters,
      supportsReasoning: typeof model.supports_reasoning === "boolean"
        ? model.supports_reasoning
        : (typeof model.supportsReasoning === "boolean" ? model.supportsReasoning : undefined),
      supportsChat: Boolean(derived?.supportsChat),
      supportsImages: Boolean(derived?.supportsImages),
      outputsImage: Boolean(derived?.outputsImage),
      isImageOnly: Boolean(derived?.isImageOnly)
    };
  });
}

function getNagaStartupsCacheKeys() {
  return {
    startupsKey: STORAGE_KEYS.NAGA_STARTUPS_CACHE,
    timeKey: STORAGE_KEYS.NAGA_STARTUPS_CACHE_TIME
  };
}

function broadcastModelsUpdated(provider) {
  try {
    chrome.runtime.sendMessage({
      type: MODELS_UPDATED_EVENT,
      provider
    });
  } catch (e) {
    // ignore if no listeners
  }
}

async function getNagaStartupsMap() {
  const { startupsKey, timeKey } = getNagaStartupsCacheKeys();
  const cacheData = await chrome.storage.local.get([
    startupsKey,
    timeKey
  ]);

  const now = Date.now();
  if (cacheData[startupsKey] &&
      cacheData[timeKey] &&
      (now - cacheData[timeKey]) < CACHE_TTL.MODELS) {
    return cacheData[startupsKey];
  }

  const providerConfig = getProviderConfig("naga");
  const res = await fetch(`${providerConfig.baseUrl}/startups`);
  if (!res.ok) {
    return {};
  }

  const data = await res.json().catch(() => null);
  const list = Array.isArray(data) ? data : (data?.data || []);
  const map = {};
  list.forEach((startup) => {
    const id = startup?.id || startup?.slug || startup?.name;
    const label = startup?.display_name || startup?.displayName || startup?.name;
    if (id && label) {
      map[id] = label;
    }
  });

  await chrome.storage.local.set({
    [startupsKey]: map,
    [timeKey]: now
  });

  return map;
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
  const models = parseModelsPayload(data);
  if (provider === "naga") {
    const startupsMap = await getNagaStartupsMap().catch(() => ({}));
    models.forEach((model) => {
      model.vendorLabel = resolveNagaVendorLabel(model.ownedBy, startupsMap);
    });
  }

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

  // SECURITY FIX: Use chrome.storage.local instead of sync for API key
  const items = await getLocalStorage([
    STORAGE_KEYS.PROVIDER,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.API_KEY_NAGA,
    STORAGE_KEYS.API_KEY_NAGA_PROVISIONAL,
    STORAGE_KEYS.MODEL,
    STORAGE_KEYS.MODEL_NAGA,
    STORAGE_KEYS.MODEL_PROVIDER
  ]);
  const provider = normalizeProviderId(items[STORAGE_KEYS.PROVIDER]);
  const modelProvider = normalizeProviderId(items[STORAGE_KEYS.MODEL_PROVIDER] || provider);
  const apiKey = modelProvider === "naga" ? items[STORAGE_KEYS.API_KEY_NAGA] : items[STORAGE_KEYS.API_KEY];
  let model = items[STORAGE_KEYS.MODEL];
  if (!model && modelProvider === "naga") {
    model = items[STORAGE_KEYS.MODEL_NAGA];
  }
  model = model || DEFAULTS.MODEL;

  cachedConfig = {
    provider,
    modelProvider,
    apiKey: apiKey || "",
    provisioningKey: items[STORAGE_KEYS.API_KEY_NAGA_PROVISIONAL] || "",
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

// ---- Image generation ----
function extractOpenRouterImageUrl(message) {
  const images = Array.isArray(message?.images) ? message.images : [];
  if (!images.length) return "";
  const first = images[0] || {};
  const imageUrl = first.image_url || first.imageUrl || {};
  return imageUrl.url || first.url || "";
}

function buildDataUrlFromBase64(base64, mimeType = "image/png") {
  if (!base64 || typeof base64 !== "string") return "";
  if (base64.startsWith("data:")) return base64;
  return `data:${mimeType};base64,${base64}`;
}

function isNagaChatImageModel(modelId) {
  if (!modelId || typeof modelId !== "string") return false;
  const normalized = modelId.toLowerCase();
  if (!normalized.startsWith("gemini-")) return false;
  return normalized.includes("image");
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(imageUrl) {
  if (!imageUrl) return "";
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(ERROR_MESSAGES.INVALID_RESPONSE);
  }
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const mimeType = blob.type || res.headers.get("content-type") || "image/png";
  return buildDataUrlFromBase64(base64, mimeType);
}

function resolveModelCapabilitiesFromList(models, modelId) {
  if (!Array.isArray(models) || !modelId) {
    return {
      supportsChat: false,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false
    };
  }
  const match = models.find((model) => model?.id === modelId);
  if (!match) {
    return {
      supportsChat: false,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false
    };
  }
  return {
    supportsChat: Boolean(match.supportsChat),
    supportsImages: Boolean(match.supportsImages),
    outputsImage: Boolean(match.outputsImage),
    isImageOnly: Boolean(match.isImageOnly)
  };
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
    let route = resolveImageRouteFromCapabilities(capabilities);

    if (providerConfig.id === "naga" && isNagaChatImageModel(model)) {
      route = "chat";
    }

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
        dataUrl = await fetchImageAsDataUrl(imageUrl);
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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === MESSAGE_TYPES.DEBUG_SET_ENABLED) {
    (async () => {
      try {
        debugStreamEnabled = Boolean(msg.enabled);
        await setLocalStorage({
          [STORAGE_KEYS.DEBUG_STREAM]: debugStreamEnabled
        });
        sendResponse({ ok: true, enabled: debugStreamEnabled });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.DEBUG_GET_STREAM_LOG) {
    sendResponse({
      ok: true,
      enabled: debugStreamEnabled,
      meta: buildDebugLogMeta(debugStreamLog),
      entries: debugStreamLog.entries
    });
    return false;
  }

  if (msg?.type === MESSAGE_TYPES.DEBUG_CLEAR_STREAM_LOG) {
    debugStreamLog.entries.length = 0;
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === MESSAGE_TYPES.CLOSE_SIDEPANEL) {
    (async () => {
      try {
        let tabId = sender?.tab?.id || msg?.tabId || null;
        if (!tabId && chrome.tabs && typeof chrome.tabs.query === "function") {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = tabs?.[0]?.id || null;
        }
        if (!tabId || !chrome.sidePanel || typeof chrome.sidePanel.close !== "function") {
          sendResponse({ ok: false, error: "Side panel close not available" });
          return;
        }
        await chrome.sidePanel.close({ tabId });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.OPENROUTER_QUERY) {
    (async () => {
      try {
        const cfg = await loadConfig();
        const tabId = msg.tabId || 'default';
        const result = await callOpenRouter(msg.prompt, msg.webSearch, msg.reasoning, tabId);
        await addHistoryEntry(msg.prompt, result.answer);
        sendResponse({
          ok: true,
          answer: result.answer,
          model: cfg.model,
          tokens: result.tokens,
          contextSize: result.contextSize,
          reasoning: result.reasoning  // Include reasoning in response
        });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.IMAGE_QUERY) {
    (async () => {
      try {
        const result = await callImageGeneration(
          msg.prompt,
          msg.provider || null,
          msg.model || null
        );
        sendResponse({ ok: true, image: result });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.CLEAR_CONTEXT) {
    (async () => {
      try {
        await ensureContextLoaded();
        const tabId = msg.tabId || 'default';
        conversationContexts.delete(tabId);
        await removeContextForTab(tabId);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.SUMMARIZE_THREAD) {
    (async () => {
      try {
        const result = await callOpenRouterWithMessages(
          msg.messages || [],
          msg.model || null,
          msg.provider || null
        );
        sendResponse({ ok: true, summary: result.answer, tokens: result.tokens });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_context_size") {
    (async () => {
      try {
        await ensureContextLoaded();
        const tabId = msg.tabId || 'default';
        const contextSize = conversationContexts.has(tabId) ? conversationContexts.get(tabId).length : 0;
        sendResponse({ ok: true, contextSize });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.GET_BALANCE) {
    (async () => {
      try {
        const result = await getProviderBalance();
        sendResponse({ ok: true, balance: result.balance, supported: result.supported });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_history") {
    (async () => {
      try {
        const history = await loadHistory();
        sendResponse({ ok: true, history });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "delete_history_item" && msg.id) {
    (async () => {
      try {
        const history = await loadHistory();
        const filtered = history.filter((h) => h.id !== msg.id);
        await saveHistory(filtered);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_config") {
    (async () => {
      try {
        const cfg = await loadConfig();
        sendResponse({ ok: true, config: cfg });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "set_model" && msg.model) {
    (async () => {
      try {
        const provider = normalizeProviderId(msg.provider || cachedConfig.modelProvider || cachedConfig.provider);
        const keyItems = await getLocalStorage([
          STORAGE_KEYS.API_KEY,
          STORAGE_KEYS.API_KEY_NAGA
        ]);

        // Save to local storage to match loadConfig()
        await setLocalStorage({
          [STORAGE_KEYS.MODEL]: msg.model,
          [STORAGE_KEYS.MODEL_PROVIDER]: provider
        });

        cachedConfig.model = msg.model;
        cachedConfig.modelProvider = provider;
        cachedConfig.apiKey = provider === "naga"
          ? (keyItems[STORAGE_KEYS.API_KEY_NAGA] || "")
          : (keyItems[STORAGE_KEYS.API_KEY] || "");
        lastConfigLoadAt = Date.now();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_context" && msg.tabId) {
    (async () => {
      try {
        await ensureContextLoaded();
        const context = conversationContexts.get(msg.tabId) || [];
        sendResponse({ ok: true, context: context });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.GET_MODELS || msg?.type === "get_models") {
    (async () => {
      try {
        const keys = await getLocalStorage([
          STORAGE_KEYS.API_KEY,
          STORAGE_KEYS.API_KEY_NAGA,
          STORAGE_KEYS.PROVIDER_ENABLED_OPENROUTER,
          STORAGE_KEYS.PROVIDER_ENABLED_NAGA
        ]);

        const isOpenRouterEnabled = keys[STORAGE_KEYS.PROVIDER_ENABLED_OPENROUTER] !== false;
        const isNagaEnabled = Boolean(keys[STORAGE_KEYS.PROVIDER_ENABLED_NAGA]);

        const providersToLoad = [
          {
            id: "openrouter",
            enabled: isOpenRouterEnabled,
            apiKey: keys[STORAGE_KEYS.API_KEY]
          },
          {
            id: "naga",
            enabled: isNagaEnabled,
            apiKey: keys[STORAGE_KEYS.API_KEY_NAGA]
          }
        ].filter(entry => entry.enabled && entry.apiKey);

        if (providersToLoad.length === 0) {
          sendResponse({ ok: true, models: [], reason: "no_enabled_providers" });
          return;
        }

        const combinedModels = [];
        let lastError = null;

        for (const entry of providersToLoad) {
          try {
            const models = await getProviderModels(entry.id, entry.apiKey);
            models.forEach((model) => {
              const displayName = buildModelDisplayName(entry.id, model.id);
              combinedModels.push({
                id: buildCombinedModelId(entry.id, model.id),
                rawId: model.id,
                provider: entry.id,
                displayName,
                name: displayName,
                vendorLabel: model.vendorLabel,
                supportsChat: Boolean(model.supportsChat),
                supportsImages: Boolean(model.supportsImages),
                outputsImage: Boolean(model.outputsImage),
                isImageOnly: Boolean(model.isImageOnly),
                supportedParameters: model.supportedParameters || null
              });
            });
          } catch (e) {
            console.warn(`Failed to load ${entry.id} models:`, e);
            lastError = e;
          }
        }

        if (!combinedModels.length && lastError) {
          throw lastError;
        }

        sendResponse({ ok: true, models: combinedModels });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.SET_PROVIDER) {
    (async () => {
      try {
        const provider = normalizeProviderId(msg.provider);
        await setLocalStorage({ [STORAGE_KEYS.PROVIDER]: provider });
        const { modelsKey, timeKey } = getModelsCacheKeys(provider);
        await chrome.storage.local.remove([modelsKey, timeKey]);
        cachedConfig = {
          provider,
          modelProvider: provider,
          apiKey: null,
          model: DEFAULTS.MODEL
        };
        lastConfigLoadAt = 0;
        delete lastBalanceByProvider[provider];
        delete lastBalanceAtByProvider[provider];
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.REQUEST_PERMISSION) {
    (async () => {
      try {
        const url = msg.url;
        if (!url) {
          sendResponse({ ok: false, error: "No URL provided" });
          return;
        }

        // Request permission for this origin
        // Extract origin from URL
        const urlObj = new URL(url);
        const origin = `${urlObj.protocol}//${urlObj.host}/*`;

        const granted = await chrome.permissions.request({
          origins: [origin]
        });

        sendResponse({ ok: true, granted });
      } catch (e) {
        console.error('Permission request error:', e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.SUMMARIZE_PAGE) {
    (async () => {
      try {
        const tabId = msg.tabId;
        if (!tabId) {
          sendResponse({ ok: false, error: "No tab ID provided" });
          return;
        }

        // Get the tab URL to check permissions
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url;

        // Check if we have permission to access this URL
        const hasPermission = await chrome.permissions.contains({
          origins: [url]
        });

        if (!hasPermission) {
          // Request permission from the user
          sendResponse({
            ok: false,
            error: "PERMISSION_NEEDED",
            requiresPermission: true,
            url: url
          });
          return;
        }

        // Function to extract page content
        const extractPageContent = () => {
          // Strategy 1: Try to find article tags
          const article = document.querySelector('article');
          if (article) {
            return {
              title: document.title,
              content: article.innerText,
              url: window.location.href
            };
          }

          // Strategy 2: Use main content areas
          const mainContent = document.querySelector('main') ||
                              document.querySelector('[role="main"]') ||
                              document.body;

          // Clone and strip unwanted elements
          const clone = mainContent.cloneNode(true);
          clone.querySelectorAll('script, style, nav, footer, aside, header, .ad, .advertisement, [role="navigation"], [role="complementary"]').forEach(el => el.remove());

          return {
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content || '',
            content: clone.innerText, // Get full content, we'll chunk it if needed
            url: window.location.href
          };
        };

        // Execute content extraction script in the active tab
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: extractPageContent
        });

        const pageData = results[0].result;

        // Smart chunking: Split content if it's too large
        const MAX_CHUNK_SIZE = 12000; // ~12k chars per chunk to leave room for prompt
        const content = pageData.content.trim();

        let finalAnswer;
        let finalTokens = null;

        if (content.length <= MAX_CHUNK_SIZE) {
          // Content is small enough, summarize in one go
          let prompt = `Please provide a concise summary of the following webpage:\n\nTitle: ${pageData.title}\nURL: ${pageData.url}\n`;

          if (pageData.description) {
            prompt += `\nDescription: ${pageData.description}\n`;
          }

          prompt += `\nContent:\n${content}`;

          const result = await callOpenRouter(prompt, msg.webSearch, msg.reasoning, tabId);
          finalAnswer = result.answer;
          finalTokens = result.tokens;
          await addHistoryEntry(prompt, finalAnswer);
        } else {
          // Content is large, chunk and summarize
          console.log(`[Chunking] Content is ${content.length} chars, splitting into chunks...`);

          // Split content into chunks
          const chunks = [];
          for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
            chunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
          }

          console.log(`[Chunking] Created ${chunks.length} chunks`);

          // Summarize each chunk and track total tokens
          const chunkSummaries = [];
          let totalTokens = 0;
          for (let i = 0; i < chunks.length; i++) {
            const chunkPrompt = `Please provide a concise summary of this section (part ${i + 1} of ${chunks.length}) from the webpage "${pageData.title}":\n\n${chunks[i]}`;

            const chunkResult = await callOpenRouter(chunkPrompt, msg.webSearch, msg.reasoning, tabId);
            chunkSummaries.push(chunkResult.answer);
            if (chunkResult.tokens) {
              totalTokens += chunkResult.tokens;
            }

            console.log(`[Chunking] Summarized chunk ${i + 1}/${chunks.length} (${chunkResult.tokens || '?'} tokens)`);
          }

          // Combine all chunk summaries into final summary
          const combinedPrompt = `Please provide a comprehensive summary by combining these section summaries from the webpage "${pageData.title}" (${pageData.url}):\n\n${chunkSummaries.map((s, i) => `Section ${i + 1}:\n${s}`).join('\n\n---\n\n')}`;

          const finalResult = await callOpenRouter(combinedPrompt, msg.webSearch, msg.reasoning, tabId);
          finalAnswer = finalResult.answer;
          if (finalResult.tokens) {
            totalTokens += finalResult.tokens;
          }
          finalTokens = totalTokens;

          // Save to history with a note about chunking
          const historyPrompt = `[Chunked Summary - ${chunks.length} parts] ${pageData.title}\n${pageData.url}`;
          await addHistoryEntry(historyPrompt, finalAnswer);

          console.log(`[Chunking] Final summary generated from ${chunks.length} chunks (${totalTokens} total tokens)`);
        }

        // Get final context size
        const contextSize = conversationContexts.has(tabId) ? conversationContexts.get(tabId).length : 0;

        sendResponse({
          ok: true,
          answer: finalAnswer,
          model: (await loadConfig()).model,
          tokens: finalTokens,
          contextSize: contextSize
        });
      } catch (e) {
        console.error('Summarize page error:', e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }
});

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
  } else if (reasoning && providerConfig.id === "naga") {
    requestBody.reasoning_effort = "medium";
  }
  if (webSearch && providerConfig.id === "naga") {
    requestBody.web_search_options = {};
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

  if (debugStreamEnabled) {
    pushDebugStreamEntry(debugStreamLog, {
      type: "summary_start",
      provider: providerConfig.id,
      model: requestBody.model,
      messageCount: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
      hasApiKey: Boolean(apiKey),
      hasProvisioningKey: Boolean(cfg.provisioningKey)
    });
  }

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

      if (debugStreamEnabled) {
        pushDebugStreamEntry(debugStreamLog, {
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
      }

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

      if (debugStreamEnabled) {
        pushDebugStreamEntry(debugStreamLog, {
          type: "summary_error",
          provider: providerConfig.id,
          error: error?.message || String(error),
          elapsedMs: Date.now() - summaryStartedAt
        });
      }

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

  if (providerConfig.id === "naga" && !cfg.provisioningKey) {
    return { supported: false, balance: null };
  }
  if (!cfg.apiKey && providerConfig.id !== "naga") {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  const balanceEndpoint = providerConfig.balanceEndpoint || "/credits";
  const res = await fetch(`${providerConfig.baseUrl}${balanceEndpoint}`, {
    method: "GET",
    headers: buildBalanceHeaders(cfg.apiKey, providerConfig, cfg.provisioningKey)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
  }

  let balance = null;
  if (providerConfig.id === "naga") {
    const rawBalance = data?.balance;
    if (typeof rawBalance === "number") {
      balance = rawBalance;
    } else if (typeof rawBalance === "string") {
      const parsed = Number.parseFloat(rawBalance);
      balance = Number.isNaN(parsed) ? null : parsed;
    }
  } else {
    console.log("Credits response:", data);

    const credits = data?.data?.total_credits;
    const usage = data?.data?.total_usage;
    if (typeof credits === "number" && typeof usage === "number") {
      balance = credits - usage;
    }
  }

  lastBalanceByProvider[cfg.modelProvider] = balance;
  lastBalanceAtByProvider[cfg.modelProvider] = now;
  return { supported: true, balance };
}

// ---- Streaming Port Connection ----
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'streaming') return;

  let isDisconnected = false;

  // Track port disconnection
  port.onDisconnect.addListener(() => {
    isDisconnected = true;
    console.log('[Streaming] Port disconnected by client');
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'start_stream') {
      try {
        await streamOpenRouterResponse(
          msg.prompt,
          msg.webSearch,
          msg.reasoning,
          msg.tabId,
          port,
          () => isDisconnected,
          msg.messages,  // Custom messages array (for Projects)
          msg.model,     // Custom model (for Projects)
          msg.provider,  // Custom provider (for Projects)
          msg.retry === true
        );
      } catch (e) {
        // Only send error if port is still connected
        if (!isDisconnected) {
          try {
            port.postMessage({ type: 'error', error: e?.message || String(e) });
          } catch (postError) {
            console.error('[Streaming] Failed to send error (port disconnected):', postError);
          }
        }
      }
    }
  });
});

// Streaming version of callOpenRouter that sends real-time updates via Port
async function streamOpenRouterResponse(prompt, webSearch, reasoning, tabId, port, isDisconnectedFn, customMessages = null, customModel = null, customProvider = null, retry = false) {
  const cfg = await loadConfig();
  const providerId = normalizeProviderId(customProvider || cfg.modelProvider);
  const apiKey = await getApiKeyForProvider(providerId);
  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }
  await ensureContextLoaded();
  const providerConfig = getProviderConfig(providerId);
  const streamStartedAt = Date.now();

  // Helper function to safely send port messages
  const safeSendMessage = (message) => {
    if (isDisconnectedFn && isDisconnectedFn()) {
      console.log('[Streaming] Skipping message send - port disconnected');
      return false;
    }
    try {
      port.postMessage(message);
      return true;
    } catch (e) {
      console.error('[Streaming] Failed to send message:', e);
      return false;
    }
  };

  // Use custom messages if provided (for Projects), otherwise use conversation context
  let context;
  const isProjectsMode = customMessages !== null;

  if (isProjectsMode) {
    // Projects mode: use provided messages array
    context = [...customMessages];
    // Add the new user message unless retry would duplicate it
    const last = context[context.length - 1];
    const shouldAppend = !retry || !(last && last.role === "user" && last.content === prompt);
    if (shouldAppend) {
      context.push({ role: "user", content: prompt });
    }
  } else {
    // Sidebar mode: use per-tab context
    context = conversationContexts.get(tabId) || [];
    const last = context[context.length - 1];
    const shouldAppend = !retry || !(last && last.role === "user" && last.content === prompt);
    if (shouldAppend) {
      context.push({ role: "user", content: prompt });
    }

    // Trim context if needed
    if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
    }
    conversationContexts.set(tabId, context);
    await persistContextForTab(tabId);
  }

  // Use custom model if provided, otherwise use config model
  let modelName = customModel || cfg.model || DEFAULTS.MODEL;
  if (providerConfig.supportsWebSearch && webSearch && !modelName.endsWith(':online')) {
    modelName = `${modelName}:online`;
  }

  const requestBody = {
    model: modelName,
    messages: context,
    stream: true
  };

  if (reasoning && providerConfig.id === "openrouter") {
    requestBody.reasoning = {
      enabled: true,
      effort: "medium"
    };
  } else if (reasoning && providerConfig.id === "naga") {
    requestBody.reasoning_effort = "medium";
  }
  if (webSearch && providerConfig.id === "naga") {
    requestBody.web_search_options = {};
  }
  if (providerConfig.id === "naga") {
    requestBody.stream_options = { include_usage: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  if (debugStreamEnabled) {
    pushDebugStreamEntry(debugStreamLog, {
      type: "stream_start",
      provider: providerConfig.id,
      model: modelName,
      tabId: tabId || null,
      projectsMode: isProjectsMode,
      promptChars: typeof prompt === "string" ? prompt.length : 0,
      messageCount: Array.isArray(context) ? context.length : 0,
      webSearch: Boolean(webSearch),
      reasoning: Boolean(reasoning),
      startedAt: new Date(streamStartedAt).toISOString()
    });
  }

  let res;
  try {
    res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: buildAuthHeaders(apiKey, providerConfig),
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (e) {
    if (debugStreamEnabled) {
      pushDebugStreamEntry(debugStreamLog, {
        type: "stream_error",
        stage: "fetch",
        message: e?.message || String(e),
        elapsedMs: Date.now() - streamStartedAt
      });
    }
    throw e;
  }

  clearTimeout(timeoutId);

  if (debugStreamEnabled) {
    pushDebugStreamEntry(debugStreamLog, {
      type: "stream_response",
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type") || null,
      elapsedMs: Date.now() - streamStartedAt
    });
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (debugStreamEnabled) {
      pushDebugStreamEntry(debugStreamLog, {
        type: "stream_error",
        stage: "response",
        status: res.status,
        message: data?.error?.message || ERROR_MESSAGES.API_ERROR,
        elapsedMs: Date.now() - streamStartedAt
      });
    }
    throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let tokens = null;
  let firstChunkLogged = false;

  console.log('[Streaming] Starting real-time stream...');

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('[Streaming] Reader reported done, exiting loop');
      if (debugStreamEnabled) {
        pushDebugStreamEntry(debugStreamLog, {
          type: "stream_reader_done",
          elapsedMs: Date.now() - streamStartedAt,
          contentLength: fullContent.length
        });
      }
      break;
    }

    // Check if port was disconnected
    if (isDisconnectedFn && isDisconnectedFn()) {
      console.log('[Streaming] Port disconnected, stopping stream');
      if (debugStreamEnabled) {
        pushDebugStreamEntry(debugStreamLog, {
          type: "stream_port_disconnected",
          elapsedMs: Date.now() - streamStartedAt
        });
      }
      break;
    }

    if (debugStreamEnabled && !firstChunkLogged) {
      firstChunkLogged = true;
      pushDebugStreamEntry(debugStreamLog, {
        type: "stream_first_chunk",
        elapsedMs: Date.now() - streamStartedAt
      });
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim() === '') continue;
      if (line.trim() === 'data: [DONE]') {
        console.log('[Streaming] Received [DONE] signal');
        if (debugStreamEnabled) {
          pushDebugStreamEntry(debugStreamLog, {
            type: "stream_done_signal",
            elapsedMs: Date.now() - streamStartedAt
          });
        }
        continue;
      }
      if (!line.startsWith('data: ')) continue;

      try {
        const jsonStr = line.slice(6);
        const chunk = JSON.parse(jsonStr);
        const delta = chunk.choices?.[0]?.delta;

        if (debugStreamEnabled) {
          const contentLength = typeof delta?.content === "string" ? delta.content.length : 0;
          const reasoningLength = typeof delta?.reasoning === "string"
            ? delta.reasoning.length
            : (typeof delta?.reasoning_content === "string" ? delta.reasoning_content.length : 0);
          pushDebugStreamEntry(debugStreamLog, {
            type: "stream_chunk",
            deltaKeys: delta ? Object.keys(delta) : [],
            contentLength,
            reasoningLength,
            hasUsage: Boolean(chunk.usage),
            totalTokens: chunk.usage?.total_tokens ?? null,
            elapsedMs: Date.now() - streamStartedAt
          });
        }

        // Debug: Log the full delta structure to understand web search response format
        if (delta && Object.keys(delta).length > 0) {
          console.log('[Streaming] Delta keys:', Object.keys(delta), 'delta:', JSON.stringify(delta).slice(0, 200));
        }

        // Stream content chunks
        if (delta?.content) {
          fullContent += delta.content;
          const sent = safeSendMessage({
            type: 'content',
            content: delta.content
          });
          if (!sent) break; // Stop if port disconnected
        }

        // Stream reasoning chunks
        // Note: delta.reasoning and delta.reasoning_details contain the same content
        // We only need to send one of them to avoid duplicates
        if (delta?.reasoning) {
          const sent = safeSendMessage({
            type: 'reasoning',
            reasoning: delta.reasoning
          });
          if (!sent) break; // Stop if port disconnected
        }
        if (delta?.reasoning_content) {
          const sent = safeSendMessage({
            type: 'reasoning',
            reasoning: delta.reasoning_content
          });
          if (!sent) break; // Stop if port disconnected
        }

        // Extract usage
        if (chunk.usage) {
          tokens = chunk.usage.total_tokens;
        }
      } catch (e) {
        console.error('[Streaming] Error parsing chunk:', e);
        if (debugStreamEnabled) {
          pushDebugStreamEntry(debugStreamLog, {
            type: "stream_parse_error",
            message: e?.message || String(e),
            elapsedMs: Date.now() - streamStartedAt
          });
        }
      }
    }
  }

  console.log('[Streaming] Stream complete, fullContent length:', fullContent.length);

  // Handle case where no content was received (e.g., only reasoning, or stream error)
  if (!fullContent || fullContent.length === 0) {
    console.warn('[Streaming] Warning: Stream completed with no content');
    if (debugStreamEnabled) {
      pushDebugStreamEntry(debugStreamLog, {
        type: "stream_no_content",
        elapsedMs: Date.now() - streamStartedAt,
        tokens
      });
    }
    safeSendMessage({
      type: 'error',
      error: 'No response content received from the model. The model may have only produced reasoning without a final answer. Please try again.'
    });
    return;
  }

  // Only save to sidebar context if not using Projects mode
  if (!isProjectsMode) {
    // Add assistant response to context
    context.push({ role: "assistant", content: fullContent });

    // Trim context again
    if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
    }

    // Save updated context back to Map
    conversationContexts.set(tabId, context);
    await persistContextForTab(tabId);

    // Save to history
    await addHistoryEntry(prompt, fullContent);
  }

  // Send completion message (only if port still connected)
  const completeSent = safeSendMessage({
    type: 'complete',
    tokens,
    contextSize: context.length,
    model: customModel || cfg.model
  });
  if (debugStreamEnabled) {
    pushDebugStreamEntry(debugStreamLog, {
      type: "stream_complete",
      elapsedMs: Date.now() - streamStartedAt,
      contentLength: fullContent.length,
      tokens
    });
  }
  console.log('[Streaming] Completion message sent:', completeSent);
}
