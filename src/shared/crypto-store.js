// crypto-store.js - AES-GCM helpers for local storage encryption

const KEY_DB_NAME = "wegweiser-crypto-store";
const KEY_STORE_NAME = "crypto_keys";
const KEY_RECORD_ID = "primary";
const RESET_MARKER_KEY = "or_crypto_reset_v2";
const LEGACY_KEY_STORAGE_KEY = "or_crypto_key";
const RESET_ENCRYPTED_STORAGE_KEYS = [
  "or_provider",
  "or_api_key",
  "or_model",
  "or_model_provider",
  "or_recent_models",
  "or_history_limit",
  "or_history",
  "or_projects",
  "or_project_threads",
  "or_web_search",
  "or_reasoning",
  "or_provider_enabled_openrouter"
];

let cachedKeyPromise = null;
let cachedDbPromise = null;

function getCrypto() {
  return (typeof globalThis !== "undefined" && globalThis.crypto) ? globalThis.crypto : null;
}

function getSubtle() {
  const cryptoObj = getCrypto();
  return cryptoObj?.subtle || null;
}

function getIndexedDb() {
  if (typeof indexedDB !== "undefined") return indexedDB;
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) return globalThis.indexedDB;
  return null;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

function openCryptoStoreDb(idb) {
  return new Promise((resolve, reject) => {
    const request = idb.open(KEY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCryptoDb() {
  if (!cachedDbPromise) {
    const idb = getIndexedDb();
    if (!idb) {
      throw new Error("IndexedDB unavailable");
    }
    cachedDbPromise = openCryptoStoreDb(idb).catch((error) => {
      cachedDbPromise = null;
      throw error;
    });
  }
  return cachedDbPromise;
}

async function withKeyStore(mode, handler) {
  const db = await getCryptoDb();
  const tx = db.transaction(KEY_STORE_NAME, mode);
  const store = tx.objectStore(KEY_STORE_NAME);
  const result = await handler(store);
  await transactionDone(tx);
  return result;
}

async function loadPersistedKey() {
  const record = await withKeyStore("readonly", (store) => requestToPromise(store.get(KEY_RECORD_ID)));
  return record?.key || null;
}

async function savePersistedKey(key) {
  await withKeyStore("readwrite", (store) => requestToPromise(store.put({ id: KEY_RECORD_ID, key })));
}

async function clearPersistedKey() {
  try {
    await withKeyStore("readwrite", (store) => requestToPromise(store.delete(KEY_RECORD_ID)));
  } catch (_) {
    // Ignore cleanup failures; key will be regenerated as needed.
  }
}

async function ensureResetApplied() {
  if (!chrome?.storage?.local) {
    throw new Error("chrome.storage.local unavailable");
  }

  const markerResult = await chrome.storage.local.get([RESET_MARKER_KEY]);
  if (markerResult?.[RESET_MARKER_KEY]) {
    return;
  }

  const keysToRemove = [LEGACY_KEY_STORAGE_KEY, ...RESET_ENCRYPTED_STORAGE_KEYS];
  if (typeof chrome.storage.local.remove === "function") {
    await chrome.storage.local.remove(keysToRemove);
  }

  await clearPersistedKey();
  await chrome.storage.local.set({ [RESET_MARKER_KEY]: true });
}

async function getOrCreateKey() {
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    const subtle = getSubtle();
    if (!subtle) {
      throw new Error("Web Crypto unavailable");
    }

    await ensureResetApplied();

    const persistedKey = await loadPersistedKey();
    if (persistedKey) {
      return persistedKey;
    }

    const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await savePersistedKey(key);
    return key;
  })().catch((error) => {
    cachedKeyPromise = null;
    throw error;
  });

  return cachedKeyPromise;
}

function bytesToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength || bytes.length || 0;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function encryptJson(value) {
  const subtle = getSubtle();
  if (!subtle) throw new Error("Web Crypto unavailable");
  const key = await getOrCreateKey();
  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    v: 1,
    alg: "AES-GCM",
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptJson(payload) {
  if (!payload || payload.alg !== "AES-GCM" || !payload.iv || !payload.data) return null;
  const subtle = getSubtle();
  if (!subtle) throw new Error("Web Crypto unavailable");
  const key = await getOrCreateKey();
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const decrypted = await subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
}

if (typeof globalThis !== "undefined") {
  globalThis.getOrCreateKey = getOrCreateKey;
  globalThis.encryptJson = encryptJson;
  globalThis.decryptJson = decryptJson;
}

if (typeof module !== "undefined") {
  module.exports = {
    getOrCreateKey,
    encryptJson,
    decryptJson
  };
}
