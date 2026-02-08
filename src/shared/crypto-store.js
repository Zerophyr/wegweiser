// crypto-store.js - AES-GCM helpers for local storage encryption

const KEY_STORAGE_KEY = "or_crypto_key";
const KEY_OBFUSCATION_PREFIX = "v1:";
let cachedKeyPromise = null;

function getCrypto() {
  return (typeof globalThis !== "undefined" && globalThis.crypto) ? globalThis.crypto : null;
}

function getSubtle() {
  const cryptoObj = getCrypto();
  return cryptoObj?.subtle || null;
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

function obfuscateKey(rawBase64) {
  return `${KEY_OBFUSCATION_PREFIX}${rawBase64.split("").reverse().join("")}`;
}

function deobfuscateKey(value) {
  if (typeof value !== "string" || !value.startsWith(KEY_OBFUSCATION_PREFIX)) {
    return "";
  }
  const reversed = value.slice(KEY_OBFUSCATION_PREFIX.length);
  return reversed.split("").reverse().join("");
}

async function getOrCreateKey() {
  if (cachedKeyPromise) return cachedKeyPromise;
  cachedKeyPromise = (async () => {
    const subtle = getSubtle();
    if (!subtle || !chrome?.storage?.local) {
      throw new Error("Web Crypto or storage unavailable");
    }

    const stored = await chrome.storage.local.get([KEY_STORAGE_KEY]);
    const storedValue = stored[KEY_STORAGE_KEY];
    const base64Key = deobfuscateKey(storedValue);
    if (base64Key) {
      const raw = base64ToBytes(base64Key);
      return subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    }

    const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const raw = await subtle.exportKey("raw", key);
    const rawBytes = new Uint8Array(raw);
    const b64 = bytesToBase64(rawBytes);
    await chrome.storage.local.set({ [KEY_STORAGE_KEY]: obfuscateKey(b64) });
    return key;
  })();
  return cachedKeyPromise;
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

if (typeof window !== "undefined") {
  window.getOrCreateKey = getOrCreateKey;
  window.encryptJson = encryptJson;
  window.decryptJson = decryptJson;
}

if (typeof module !== "undefined") {
  module.exports = {
    getOrCreateKey,
    encryptJson,
    decryptJson
  };
}
