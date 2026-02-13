// background-context-store-utils.js - helpers for context storage keys/ids

function getContextStorageKey(tabId, prefix = "or_context_session_") {
  const keyId = tabId === undefined || tabId === null ? "default" : String(tabId);
  return `${prefix}${keyId}`;
}

function parseStoredTabId(tabId) {
  if (tabId === "default") return "default";
  const asNumber = Number(tabId);
  return Number.isNaN(asNumber) ? tabId : asNumber;
}

async function loadContextsFromStorage(options = {}) {
  const getAll = options.getAll;
  const prefix = options.prefix || "or_context_session_";
  if (typeof getAll !== "function") {
    return new Map();
  }
  const all = await getAll();
  const result = new Map();
  if (!all || typeof all !== "object") {
    return result;
  }
  Object.keys(all).forEach((key) => {
    if (!key.startsWith(prefix)) return;
    const tabKey = key.slice(prefix.length);
    const messages = all[key];
    if (!Array.isArray(messages)) return;
    result.set(parseStoredTabId(tabKey), messages);
  });
  return result;
}

async function persistContextForTab(storage, contextsMap, tabId, prefix = "or_context_session_") {
  if (!storage?.set) return;
  const key = getContextStorageKey(tabId, prefix);
  const messages = contextsMap?.get?.(tabId) || [];
  await storage.set({ [key]: messages });
}

async function removeContextForTab(storage, tabId, prefix = "or_context_session_") {
  if (!storage?.remove) return;
  const key = getContextStorageKey(tabId, prefix);
  await storage.remove([key]);
}

const backgroundContextStoreUtils = {
  getContextStorageKey,
  parseStoredTabId,
  loadContextsFromStorage,
  persistContextForTab,
  removeContextForTab
};

if (typeof window !== "undefined") {
  window.backgroundContextStoreUtils = backgroundContextStoreUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundContextStoreUtils = backgroundContextStoreUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundContextStoreUtils;
}
