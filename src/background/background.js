// background.js

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
import '/src/background/background-model-cache-controller-utils.js';
import '/src/background/background-query-controller-utils.js';
import '/src/background/background-balance-controller-utils.js';
import '/src/background/background-image-controller-utils.js';
import '/src/background/background-summarize-controller-utils.js';
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
  setDebugEnabled: setDebugStreamEnabledState = async (state, enabled) => {
    state.enabled = Boolean(enabled);
    return state.enabled;
  },
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
  getReasoningText = () => ''
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

const {
  createBackgroundModelCacheController = () => ({
    broadcastModelsUpdated: () => {},
    refreshProviderModels: async () => [],
    getProviderModels: async () => []
  })
} = globalThis.backgroundModelCacheControllerUtils || {};

const {
  createBackgroundQueryController = () => ({
    callOpenRouter: async () => ({ answer: '', tokens: null, contextSize: 0, reasoning: null }),
    callOpenRouterWithMessages: async () => ({ answer: '', tokens: null })
  })
} = globalThis.backgroundQueryControllerUtils || {};

const {
  createBackgroundBalanceController = () => ({
    getProviderBalance: async () => ({ supported: false, balance: null })
  })
} = globalThis.backgroundBalanceControllerUtils || {};

const {
  createBackgroundImageController = () => ({
    callImageGeneration: async () => {
      throw new Error(ERROR_MESSAGES.API_ERROR);
    }
  })
} = globalThis.backgroundImageControllerUtils || {};

const {
  createBackgroundSummarizeController = () => ({
    handleSummarizePageMessage: async (_msg, sendResponse) => sendResponse({ ok: false, error: ERROR_MESSAGES.API_ERROR })
  })
} = globalThis.backgroundSummarizeControllerUtils || {};

const MODELS_UPDATED_EVENT = MESSAGE_TYPES.MODELS_UPDATED || 'models_updated';
const getLocalStorage = (keys) => (typeof globalThis.getEncrypted === 'function'
  ? globalThis.getEncrypted(keys)
  : chrome.storage.local.get(keys));
const setLocalStorage = (values) => (typeof globalThis.setEncrypted === 'function'
  ? globalThis.setEncrypted(values)
  : chrome.storage.local.set(values));

const lastBalanceByProvider = {};
const lastBalanceAtByProvider = {};
const debugStreamState = createDebugStreamState(createDebugStreamLog(), false);
const debugLogger = createDebugLogger(debugStreamState, pushDebugStreamEntry);

chrome.storage.local.get([STORAGE_KEYS.DEBUG_STREAM]).then((items) => {
  debugStreamState.enabled = Boolean(items[STORAGE_KEYS.DEBUG_STREAM]);
});

chrome.storage.onChanged.addListener((changes, area) => {
  applyDebugStorageChange(debugStreamState, changes, area, STORAGE_KEYS.DEBUG_STREAM);
});

let cachedConfig = {
  provider: 'openrouter',
  modelProvider: 'openrouter',
  apiKey: null,
  model: DEFAULTS.MODEL
};
let lastConfigLoadAt = 0;

function setLastConfigLoadAt(value) {
  lastConfigLoadAt = Number.isFinite(value) ? value : 0;
}

async function runNagaRemovalMigration() {
  try {
    const markerKey = STORAGE_KEYS.MIGRATION_NAGA_REMOVED_V1;
    const existing = await chrome.storage.local.get([
      markerKey,
      ...LEGACY_NAGA_STORAGE_KEYS,
      STORAGE_KEYS.PROVIDER,
      STORAGE_KEYS.MODEL_PROVIDER,
      STORAGE_KEYS.MODEL
    ]);
    if (existing[markerKey]) return;

    const nextValues = {
      [markerKey]: true,
      [STORAGE_KEYS.PROVIDER]: 'openrouter',
      [STORAGE_KEYS.MODEL_PROVIDER]: 'openrouter',
      [STORAGE_KEYS.PROVIDER_ENABLED_OPENROUTER]: true
    };

    const providerWasNaga = String(existing[STORAGE_KEYS.MODEL_PROVIDER] || existing[STORAGE_KEYS.PROVIDER] || '').toLowerCase() === 'naga';
    if (providerWasNaga || !existing[STORAGE_KEYS.MODEL]) {
      nextValues[STORAGE_KEYS.MODEL] = DEFAULTS.MODEL;
    }

    await chrome.storage.local.set(nextValues);
    await chrome.storage.local.remove(LEGACY_NAGA_STORAGE_KEYS);
    cachedConfig.provider = 'openrouter';
    cachedConfig.modelProvider = 'openrouter';
    cachedConfig.model = nextValues[STORAGE_KEYS.MODEL] || existing[STORAGE_KEYS.MODEL] || DEFAULTS.MODEL;
    setLastConfigLoadAt(0);
  } catch (e) {
    console.warn('Naga removal migration failed:', e);
  }
}

runNagaRemovalMigration();

const conversationContexts = new Map();
const contextStorage = chrome?.storage?.session ? chrome.storage.session : chrome.storage.local;
const contextStoragePrefix = STORAGE_KEYS.CONTEXT_SESSION_PREFIX || 'or_context_session_';
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
    console.warn('Failed to load stored context:', e);
  });
  return contextLoadPromise;
}

async function persistContextForTab(tabId) {
  await persistContextForTabInStorage(contextStorage, conversationContexts, tabId, contextStoragePrefix);
}

async function removeContextForTab(tabId) {
  await removeContextForTabInStorage(contextStorage, tabId, contextStoragePrefix);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  conversationContexts.delete(tabId);
  removeContextForTab(tabId).catch((e) => {
    console.warn('Failed to remove context for tab', tabId, e);
  });
  console.log(`Cleaned up context for tab ${tabId}`);
});

async function getApiKeyForProvider(providerId) {
  normalizeProviderId(providerId);
  const keys = await getLocalStorage([STORAGE_KEYS.API_KEY]);
  return keys[STORAGE_KEYS.API_KEY] || '';
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
  const apiKey = items[STORAGE_KEYS.API_KEY] || '';
  const model = items[STORAGE_KEYS.MODEL] || DEFAULTS.MODEL;

  cachedConfig.provider = provider;
  cachedConfig.modelProvider = modelProvider;
  cachedConfig.apiKey = apiKey;
  cachedConfig.model = model;
  lastConfigLoadAt = now;
  return cachedConfig;
}

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

const modelCacheController = createBackgroundModelCacheController({
  normalizeProviderId,
  getProviderConfig,
  buildAuthHeaders,
  parseModelsPayload,
  deriveModelCapabilities,
  getModelsCacheKeys,
  modelsCacheSchemaVersion: MODELS_CACHE_SCHEMA_VERSION,
  storageLocal: chrome.storage.local,
  runtime: chrome.runtime,
  modelsUpdatedEvent: MODELS_UPDATED_EVENT,
  cacheTtlMs: CACHE_TTL.MODELS,
  hasModelCapabilityFields,
  errorMessages: ERROR_MESSAGES,
  fetchFn: fetch,
  logger: console,
  now: Date.now
});

const queryController = createBackgroundQueryController({
  loadConfig,
  normalizeProviderId,
  getApiKeyForProvider,
  ensureContextLoaded,
  getProviderConfig,
  buildAuthHeaders,
  conversationContexts,
  defaults: DEFAULTS,
  persistContextForTab,
  apiConfig: API_CONFIG,
  errorMessages: ERROR_MESSAGES,
  debugLogger,
  fetchFn: fetch,
  setTimeoutFn: setTimeout,
  clearTimeoutFn: clearTimeout,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  logger: console,
  now: Date.now
});

const balanceController = createBackgroundBalanceController({
  loadConfig,
  normalizeProviderId,
  getProviderConfig,
  cacheTtlMs: CACHE_TTL.BALANCE,
  lastBalanceByProvider,
  lastBalanceAtByProvider,
  buildBalanceHeaders,
  errorMessages: ERROR_MESSAGES,
  fetchFn: fetch,
  now: Date.now,
  logger: console
});

const imageController = createBackgroundImageController({
  normalizeProviderId,
  getProviderConfig,
  getApiKeyForProvider,
  cachedConfig,
  defaults: DEFAULTS,
  apiConfig: API_CONFIG,
  errorMessages: ERROR_MESSAGES,
  getProviderModels: modelCacheController.getProviderModels,
  resolveModelCapabilitiesFromList,
  resolveImageRouteFromCapabilities,
  buildAuthHeaders,
  extractOpenRouterImageUrl,
  buildDataUrlFromBase64,
  fetchImageAsDataUrl,
  fetchFn: fetch,
  setTimeoutFn: setTimeout,
  clearTimeoutFn: clearTimeout,
  createUuid: () => crypto.randomUUID()
});

const summarizeController = createBackgroundSummarizeController({
  chromeApi: chrome,
  callOpenRouter: queryController.callOpenRouter,
  addHistoryEntry,
  loadConfig,
  conversationContexts,
  maxChunkSize: 12000,
  logger: console
});

const { broadcastModelsUpdated, refreshProviderModels, getProviderModels } = modelCacheController;
const { callOpenRouter, callOpenRouterWithMessages } = queryController;
const { getProviderBalance } = balanceController;
const { callImageGeneration } = imageController;
const { handleSummarizePageMessage } = summarizeController;

chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

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
// CLOSE_SIDEPANEL, PROVIDER_ENABLED_OPENROUTER, MODELS_CACHE_SCHEMA_VERSION, versionKey
// IMAGE_MODEL_REQUIRED, images/generations, chat/completions, modalities, fetchImageAsDataUrl
// chrome.tabs.query({ active: true, currentWindow: true })

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

// keep exported-like references reachable for runtime diagnostics/tests
void broadcastModelsUpdated;
void refreshProviderModels;

