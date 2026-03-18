// crypto-store.js - AES-GCM helpers for local storage encryption

const KEY_DB_NAME = "wegweiser-crypto-store";
const KEY_STORE_NAME = "crypto_keys";
const KEY_RECORD_ID = "primary";
const KEY_PENDING_RECORD_ID = "pending_v2";
const RESET_MARKER_KEY = "or_crypto_reset_v2";
const INIT_LOCK_KEY = "or_crypto_init_lock_v2";
const INIT_LOCK_TIMEOUT_MS = 30000;
const INIT_LOCK_HEARTBEAT_MS = 1000;
const INIT_LOCK_RETRY_MS = 25;
const INIT_LOCK_WAIT_LIMIT_MS = 10000;
const LEGACY_KEY_STORAGE_KEY = "or_crypto_key";
const CRYPTO_API_GLOBAL_KEY = "__wegweiserCrypto";
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

function getStorageLocal() {
  if (!chrome?.storage?.local) {
    throw new Error("chrome.storage.local unavailable");
  }
  return chrome.storage.local;
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

async function loadKeyRecord(id) {
  return withKeyStore("readonly", (store) => requestToPromise(store.get(id)));
}

async function saveKeyRecord(id, key) {
  await withKeyStore("readwrite", (store) => requestToPromise(store.put({ id, key })));
}

async function clearKeyRecord(id) {
  try {
    await withKeyStore("readwrite", (store) => requestToPromise(store.delete(id)));
  } catch (_) {
    // Ignore cleanup failures; key material will be regenerated if needed.
  }
}

async function loadPersistedKey() {
  const record = await loadKeyRecord(KEY_RECORD_ID);
  return record?.key || null;
}

async function clearPersistedKey() {
  await clearKeyRecord(KEY_RECORD_ID);
}

function createLockToken() {
  return `lock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isLockActive(lockValue, now = Date.now()) {
  return Boolean(lockValue && typeof lockValue.owner === "string" && typeof lockValue.expiresAt === "number" && lockValue.expiresAt > now);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readInitState() {
  return getStorageLocal().get([RESET_MARKER_KEY, INIT_LOCK_KEY]);
}

async function tryAcquireInitLock(owner) {
  const storage = getStorageLocal();
  const now = Date.now();
  const state = await readInitState();
  const currentLock = state?.[INIT_LOCK_KEY];

  if (state?.[RESET_MARKER_KEY]) {
    return false;
  }

  if (isLockActive(currentLock, now) && currentLock.owner !== owner) {
    return false;
  }

  await storage.set({
    [INIT_LOCK_KEY]: {
      owner,
      acquiredAt: now,
      expiresAt: now + INIT_LOCK_TIMEOUT_MS
    }
  });

  const verify = await storage.get([INIT_LOCK_KEY]);
  return verify?.[INIT_LOCK_KEY]?.owner === owner;
}

async function renewInitLock(owner) {
  const storage = getStorageLocal();
  const state = await storage.get([INIT_LOCK_KEY, RESET_MARKER_KEY]);
  if (state?.[RESET_MARKER_KEY]) {
    return false;
  }
  const lockValue = state?.[INIT_LOCK_KEY];
  if (!lockValue || lockValue.owner !== owner) {
    return false;
  }
  const now = Date.now();
  await storage.set({
    [INIT_LOCK_KEY]: {
      owner,
      acquiredAt: lockValue.acquiredAt || now,
      expiresAt: now + INIT_LOCK_TIMEOUT_MS
    }
  });
  const verify = await storage.get([INIT_LOCK_KEY]);
  return verify?.[INIT_LOCK_KEY]?.owner === owner;
}

async function assertInitLockHeld(owner) {
  const renewed = await renewInitLock(owner);
  if (!renewed) {
    throw new Error("Crypto init lock lost");
  }
}

function startInitLockHeartbeat(owner) {
  if (typeof setInterval !== "function") {
    return () => {};
  }
  const intervalId = setInterval(() => {
    renewInitLock(owner).catch(() => {
      // Ignore heartbeat failures; bootstrap flow re-checks lock ownership.
    });
  }, INIT_LOCK_HEARTBEAT_MS);
  return () => clearInterval(intervalId);
}

async function releaseInitLock(owner) {
  const storage = getStorageLocal();
  const state = await storage.get([INIT_LOCK_KEY]);
  if (state?.[INIT_LOCK_KEY]?.owner === owner && typeof storage.remove === "function") {
    await storage.remove(INIT_LOCK_KEY);
  }
}

async function waitForResetOrLockRelease(owner) {
  const deadline = Date.now() + INIT_LOCK_WAIT_LIMIT_MS;
  while (Date.now() < deadline) {
    const state = await readInitState();
    if (state?.[RESET_MARKER_KEY]) {
      return true;
    }
    const lockValue = state?.[INIT_LOCK_KEY];
    if (!isLockActive(lockValue) || lockValue?.owner === owner) {
      return false;
    }
    await delay(INIT_LOCK_RETRY_MS);
  }
  return false;
}

async function verifyKeyUsable(subtle, key) {
  const cryptoObj = getCrypto();
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error("Web Crypto unavailable");
  }
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const probe = new Uint8Array([11, 22, 33, 44]);
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv }, key, probe);
  const decrypted = await subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  const decoded = new Uint8Array(decrypted);
  if (decoded.length !== probe.length) {
    throw new Error("Persisted key verification failed");
  }
  for (let i = 0; i < probe.length; i += 1) {
    if (decoded[i] !== probe[i]) {
      throw new Error("Persisted key verification failed");
    }
  }
}

async function createAndVerifyPendingKey(subtle) {
  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await saveKeyRecord(KEY_PENDING_RECORD_ID, key);
  const pendingRecord = await loadKeyRecord(KEY_PENDING_RECORD_ID);
  if (!pendingRecord?.key) {
    throw new Error("Pending key persistence verification failed");
  }
  await verifyKeyUsable(subtle, pendingRecord.key);
  return pendingRecord.key;
}

async function promotePendingKey(subtle) {
  const pendingRecord = await loadKeyRecord(KEY_PENDING_RECORD_ID);
  if (!pendingRecord?.key) {
    throw new Error("Pending key missing");
  }
  await saveKeyRecord(KEY_RECORD_ID, pendingRecord.key);
  const primaryRecord = await loadKeyRecord(KEY_RECORD_ID);
  if (!primaryRecord?.key) {
    throw new Error("Primary key persistence verification failed");
  }
  await verifyKeyUsable(subtle, primaryRecord.key);
  await clearKeyRecord(KEY_PENDING_RECORD_ID);
  return primaryRecord.key;
}

async function ensureMarkerBackedPrimaryKey(subtle) {
  const persistedKey = await loadPersistedKey();
  if (persistedKey) {
    return persistedKey;
  }

  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await saveKeyRecord(KEY_RECORD_ID, key);
  const primaryRecord = await loadKeyRecord(KEY_RECORD_ID);
  if (!primaryRecord?.key) {
    throw new Error("Primary key persistence verification failed");
  }
  await verifyKeyUsable(subtle, primaryRecord.key);
  return primaryRecord.key;
}

async function runResetBootstrap(subtle) {
  const storage = getStorageLocal();
  await getCryptoDb();

  const owner = createLockToken();
  let lockHeld = false;
  let stopHeartbeat = null;

  try {
    while (true) {
      const state = await readInitState();
      if (state?.[RESET_MARKER_KEY]) {
        return ensureMarkerBackedPrimaryKey(subtle);
      }

      if (!lockHeld) {
        lockHeld = await tryAcquireInitLock(owner);
        if (!lockHeld) {
          const markerWritten = await waitForResetOrLockRelease(owner);
          if (markerWritten) {
            return ensureMarkerBackedPrimaryKey(subtle);
          }
          continue;
        }
        stopHeartbeat = startInitLockHeartbeat(owner);
      }

      const lockedState = await readInitState();
      if (lockedState?.[RESET_MARKER_KEY]) {
        return ensureMarkerBackedPrimaryKey(subtle);
      }
      if (lockedState?.[INIT_LOCK_KEY]?.owner !== owner) {
        if (typeof stopHeartbeat === "function") {
          stopHeartbeat();
          stopHeartbeat = null;
        }
        lockHeld = false;
        continue;
      }

      const persistedKey = await loadPersistedKey();
      if (persistedKey) {
        await verifyKeyUsable(subtle, persistedKey);
        await assertInitLockHeld(owner);
        await storage.set({ [RESET_MARKER_KEY]: true });
        if (typeof storage.remove === "function") {
          try {
            await storage.remove([LEGACY_KEY_STORAGE_KEY, ...RESET_ENCRYPTED_STORAGE_KEYS]);
          } catch (_) {
            // Cleanup is best-effort once the reset marker is durable.
          }
        }
        return persistedKey;
      }

      await assertInitLockHeld(owner);
      await createAndVerifyPendingKey(subtle);
      await assertInitLockHeld(owner);

      let primaryKey;
      try {
        primaryKey = await promotePendingKey(subtle);
        await assertInitLockHeld(owner);
        await storage.set({ [RESET_MARKER_KEY]: true });
      } catch (error) {
        await clearKeyRecord(KEY_PENDING_RECORD_ID);
        throw error;
      }

      if (typeof storage.remove === "function") {
        try {
          await storage.remove([LEGACY_KEY_STORAGE_KEY, ...RESET_ENCRYPTED_STORAGE_KEYS]);
        } catch (_) {
          // Cleanup is best-effort once the new primary key and reset marker are durable.
        }
      }
      return primaryKey;
    }
  } finally {
    if (typeof stopHeartbeat === "function") {
      stopHeartbeat();
    }
    if (lockHeld) {
      await releaseInitLock(owner);
    }
  }
}

async function getOrCreateKey() {
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    const subtle = getSubtle();
    if (!subtle) {
      throw new Error("Web Crypto unavailable");
    }

    return runResetBootstrap(subtle);
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
  globalThis[CRYPTO_API_GLOBAL_KEY] = Object.freeze({
    encryptJson,
    decryptJson
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    getOrCreateKey,
    encryptJson,
    decryptJson
  };
}
