// image-cache.js - short-lived image cache helpers

function getStorage() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return null;
  }
  return chrome.storage.local;
}

function getImageCacheKey() {
  if (typeof STORAGE_KEYS !== "undefined" && STORAGE_KEYS.IMAGE_CACHE) {
    return STORAGE_KEYS.IMAGE_CACHE;
  }
  return "or_image_cache";
}

function getImageCacheLimitKey() {
  if (typeof STORAGE_KEYS !== "undefined" && STORAGE_KEYS.IMAGE_CACHE_LIMIT_MB) {
    return STORAGE_KEYS.IMAGE_CACHE_LIMIT_MB;
  }
  return "or_image_cache_limit_mb";
}

function getDefaultImageCacheLimitMb() {
  if (typeof DEFAULTS !== "undefined" && typeof DEFAULTS.IMAGE_CACHE_LIMIT_MB === "number") {
    return DEFAULTS.IMAGE_CACHE_LIMIT_MB;
  }
  return 512;
}

function normalizeImageCacheLimitMb(value) {
  const min = 128;
  const max = 2048;
  const step = 64;
  if (!Number.isFinite(value)) return getDefaultImageCacheLimitMb();
  const clamped = Math.max(min, Math.min(max, value));
  const snapped = Math.round(clamped / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

async function getImageCacheLimitBytes() {
  const storage = getStorage();
  if (!storage) return null;
  const key = getImageCacheLimitKey();
  const fallback = getDefaultImageCacheLimitMb();
  const result = await storage.get({ [key]: fallback });
  const limitMb = normalizeImageCacheLimitMb(result[key]);
  return limitMb * 1024 * 1024;
}

function getImageCacheTtl() {
  if (typeof CACHE_TTL !== "undefined" && typeof CACHE_TTL.IMAGE === "number") {
    return CACHE_TTL.IMAGE;
  }
  return 3 * 60 * 60 * 1000;
}

function hasImageStoreSupport() {
  return typeof putImageStoreEntry === "function" && typeof getImageStoreEntry === "function";
}

function normalizeCache(cache) {
  if (!cache || typeof cache !== "object") return {};
  return cache;
}

function pruneExpiredImageCache(cache, now = Date.now()) {
  const safeCache = normalizeCache(cache);
  const pruned = {};
  Object.keys(safeCache).forEach((key) => {
    const entry = safeCache[key];
    if (entry && typeof entry.expiresAt === "number" && entry.expiresAt > now) {
      pruned[key] = entry;
    }
  });
  return pruned;
}

function prepareImageCacheEntry(entry, now = Date.now(), storeSupported = hasImageStoreSupport()) {
  if (!entry || !entry.imageId) {
    return { cacheEntry: null, storeEntry: null };
  }

  const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : now;
  const expiresAt = typeof entry.expiresAt === "number"
    ? entry.expiresAt
    : (createdAt + getImageCacheTtl());

  const normalized = {
    ...entry,
    createdAt,
    expiresAt
  };

  if (storeSupported && (normalized.dataUrl || normalized.data)) {
    const storeEntry = {
      imageId: normalized.imageId,
      dataUrl: normalized.dataUrl || normalized.data,
      mimeType: normalized.mimeType || "image/png",
      createdAt,
      expiresAt
    };
    delete normalized.dataUrl;
    delete normalized.data;
    normalized.hasData = true;
    return { cacheEntry: normalized, storeEntry };
  }

  return { cacheEntry: normalized, storeEntry: null };
}

async function getImageCacheEntry(imageId, now = Date.now()) {
  if (!imageId) return null;
  const storage = getStorage();
  if (!storage) return null;

  const key = getImageCacheKey();
  const result = await storage.get({ [key]: {} });
  const cache = normalizeCache(result[key]);
  const entry = cache[imageId];
  if (!entry) return null;
  if (typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
    delete cache[imageId];
    await storage.set({ [key]: cache });
    return null;
  }
  if (entry.dataUrl || entry.data) {
    return entry;
  }
  if (entry.hasData && hasImageStoreSupport()) {
    const stored = await getImageStoreEntry(imageId);
    if (stored && (stored.dataUrl || stored.data)) {
      return { ...entry, ...stored };
    }
  }
  return entry;
}

async function putImageCacheEntry(entry, now = Date.now()) {
  if (!entry || !entry.imageId) return null;
  const storage = getStorage();
  if (!storage) return null;

  const key = getImageCacheKey();
  const ttl = getImageCacheTtl();

  const result = await storage.get({ [key]: {} });
  const cache = pruneExpiredImageCache(result[key], now);

  const { cacheEntry, storeEntry } = prepareImageCacheEntry(entry, now, hasImageStoreSupport());
  if (!cacheEntry) return null;
  if (storeEntry) {
    await putImageStoreEntry(storeEntry);
  }

  cache[cacheEntry.imageId] = cacheEntry;
  await storage.set({ [key]: cache });
  if (hasImageStoreSupport() && typeof trimImageStoreToMaxBytes === "function") {
    const limitBytes = await getImageCacheLimitBytes();
    if (Number.isFinite(limitBytes)) {
      const trimResult = await trimImageStoreToMaxBytes(limitBytes);
      const removedIds = Array.isArray(trimResult?.removedIds) ? trimResult.removedIds : [];
      if (removedIds.length) {
        let changed = false;
        removedIds.forEach((imageId) => {
          if (cache[imageId]) {
            delete cache[imageId];
            changed = true;
          }
        });
        if (changed) {
          await storage.set({ [key]: cache });
        }
      }
    }
  }
  return cacheEntry;
}

async function cleanupImageCache(now = Date.now()) {
  const storage = getStorage();
  if (!storage) return null;

  const key = getImageCacheKey();
  const result = await storage.get({ [key]: {} });
  const pruned = pruneExpiredImageCache(result[key], now);
  let nextCache = pruned;

  if (hasImageStoreSupport()) {
    nextCache = {};
    for (const entry of Object.values(pruned)) {
      const { cacheEntry, storeEntry } = prepareImageCacheEntry(entry, now, true);
      if (storeEntry) {
        await putImageStoreEntry(storeEntry);
      }
      if (cacheEntry) {
        nextCache[cacheEntry.imageId] = cacheEntry;
      }
    }
    await cleanupImageStore(now);
    if (typeof trimImageStoreToMaxBytes === "function") {
      const limitBytes = await getImageCacheLimitBytes();
      if (Number.isFinite(limitBytes)) {
        const trimResult = await trimImageStoreToMaxBytes(limitBytes);
        const removedIds = Array.isArray(trimResult?.removedIds) ? trimResult.removedIds : [];
        if (removedIds.length) {
          removedIds.forEach((imageId) => {
            delete nextCache[imageId];
          });
        }
      }
    }
  }

  await storage.set({ [key]: nextCache });
  return nextCache;
}

if (typeof module !== "undefined") {
  module.exports = {
    pruneExpiredImageCache,
    prepareImageCacheEntry,
    putImageCacheEntry,
    getImageCacheEntry,
    cleanupImageCache
  };
}
