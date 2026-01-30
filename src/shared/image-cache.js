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

function getImageCacheTtl() {
  if (typeof CACHE_TTL !== "undefined" && typeof CACHE_TTL.IMAGE === "number") {
    return CACHE_TTL.IMAGE;
  }
  return 3 * 60 * 60 * 1000;
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

  const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : now;
  const expiresAt = typeof entry.expiresAt === "number" ? entry.expiresAt : (createdAt + ttl);

  const normalized = {
    ...entry,
    createdAt,
    expiresAt
  };

  cache[entry.imageId] = normalized;
  await storage.set({ [key]: cache });
  return normalized;
}

async function cleanupImageCache(now = Date.now()) {
  const storage = getStorage();
  if (!storage) return null;

  const key = getImageCacheKey();
  const result = await storage.get({ [key]: {} });
  const pruned = pruneExpiredImageCache(result[key], now);
  await storage.set({ [key]: pruned });
  return pruned;
}

if (typeof module !== "undefined") {
  module.exports = {
    pruneExpiredImageCache,
    putImageCacheEntry,
    getImageCacheEntry,
    cleanupImageCache
  };
}
