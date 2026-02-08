// encrypted-storage.js - wrapper around chrome.storage.local with AES-GCM encryption

const DEFAULT_ENCRYPTED_STORAGE_KEYS = [
  "or_provider",
  "or_api_key",
  "naga_api_key",
  "naga_provisioning_key",
  "or_model",
  "or_model_provider",
  "or_model_naga",
  "or_recent_models",
  "or_recent_models_naga",
  "or_history_limit",
  "or_history",
  "or_spaces",
  "or_threads",
  "or_web_search",
  "or_reasoning",
  "or_provider_enabled_openrouter",
  "or_provider_enabled_naga"
];

const ENCRYPTED_STORAGE_KEYS = Array.isArray(globalThis?.ENCRYPTED_STORAGE_KEYS)
  ? globalThis.ENCRYPTED_STORAGE_KEYS
  : DEFAULT_ENCRYPTED_STORAGE_KEYS;

const {
  encryptJson = async (value) => value,
  decryptJson = async (value) => value
} = globalThis || {};

function isEncryptedPayload(value) {
  return Boolean(value && typeof value === "object" && value.alg === "AES-GCM" && value.iv && value.data);
}

async function migratePlaintextKey(key, value) {
  if (value === undefined) return value;
  if (isEncryptedPayload(value)) return value;
  const encrypted = await encryptJson(value);
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
      result[key] = await decryptJson(encrypted);
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
      payload[key] = await encryptJson(value);
    } else {
      payload[key] = value;
    }
  }
  return chrome.storage.local.set(payload);
}

if (typeof window !== "undefined") {
  window.getEncrypted = getEncrypted;
  window.setEncrypted = setEncrypted;
  window.migratePlaintextKey = migratePlaintextKey;
}

if (typeof module !== "undefined") {
  module.exports = {
    getEncrypted,
    setEncrypted,
    migratePlaintextKey
  };
}
