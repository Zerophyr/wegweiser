// encrypted-storage.js - wrapper around chrome.storage.local with AES-GCM encryption

const DEFAULT_ENCRYPTED_STORAGE_KEYS = [
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

const ENCRYPTED_STORAGE_KEYS = Object.freeze([...DEFAULT_ENCRYPTED_STORAGE_KEYS]);

function getCryptoApi() {
  if (typeof globalThis === "undefined") return null;
  const cryptoApi = globalThis.__wegweiserCrypto;
  if (!cryptoApi || typeof cryptoApi !== "object") {
    return null;
  }
  return cryptoApi;
}

async function encryptJsonSafe(value) {
  const cryptoApi = getCryptoApi();
  if (!cryptoApi || typeof cryptoApi.encryptJson !== "function") {
    throw new Error("encryptJson not available — crypto-store.js not loaded");
  }
  return cryptoApi.encryptJson(value);
}

async function decryptJsonSafe(value) {
  const cryptoApi = getCryptoApi();
  if (!cryptoApi || typeof cryptoApi.decryptJson !== "function") {
    throw new Error("decryptJson not available — crypto-store.js not loaded");
  }
  return cryptoApi.decryptJson(value);
}

function isEncryptedPayload(value) {
  return Boolean(value && typeof value === "object" && value.alg === "AES-GCM" && value.iv && value.data);
}

async function migratePlaintextKey(key, value) {
  if (value === undefined) return value;
  if (isEncryptedPayload(value)) return value;
  const encrypted = await encryptJsonSafe(value);
  await chrome.storage.local.set({ [key]: encrypted });
  return encrypted;
}

async function getEncrypted(keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const stored = await chrome.storage.local.get(keyList);
  const result = {};

  for (const key of keyList) {
    const value = stored[key];
    if (ENCRYPTED_STORAGE_KEYS.includes(key)) {
      if (value === undefined) {
        result[key] = undefined;
        continue;
      }
      const encrypted = isEncryptedPayload(value)
        ? value
        : await migratePlaintextKey(key, value);
      try {
        result[key] = await decryptJsonSafe(encrypted);
      } catch (e) {
        const message = e?.message || String(e);
        if (/decryptJson not available/i.test(message)) {
          throw e;
        }
        result[key] = undefined;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function setEncrypted(values) {
  const payload = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (value === undefined) continue;
    if (ENCRYPTED_STORAGE_KEYS.includes(key)) {
      payload[key] = await encryptJsonSafe(value);
    } else {
      payload[key] = value;
    }
  }
  return chrome.storage.local.set(payload);
}

if (typeof globalThis !== "undefined") {
  globalThis.getEncrypted = getEncrypted;
  globalThis.setEncrypted = setEncrypted;
}

if (typeof module !== "undefined") {
  module.exports = {
    getEncrypted,
    setEncrypted,
    migratePlaintextKey
  };
}

