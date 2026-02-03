// image-store.js - IndexedDB-backed image storage

const IMAGE_STORE_DB = "wegweiser-image-store";
const IMAGE_STORE_NAME = "images";

function estimateImageEntrySize(entry) {
  if (!entry) return 0;
  if (typeof entry.dataSize === "number") return entry.dataSize;
  if (typeof entry.dataUrl === "string") return entry.dataUrl.length;
  if (typeof entry.data === "string") return entry.data.length;
  return 0;
}

function createMemoryImageStore() {
  const map = new Map();

  return {
    async get(imageId, now = Date.now()) {
      if (!imageId) return null;
      const entry = map.get(imageId) || null;
      if (entry && typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
        map.delete(imageId);
        return null;
      }
      return entry || null;
    },
    async put(entry) {
      if (!entry || !entry.imageId) return null;
      map.set(entry.imageId, entry);
      return entry;
    },
    async cleanup(now = Date.now()) {
      if (!Number.isFinite(now)) {
        map.clear();
        return 0;
      }
      for (const [key, entry] of map.entries()) {
        if (entry && typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
          map.delete(key);
        }
      }
      return map.size;
    },
    async stats() {
      let bytesUsed = 0;
      for (const entry of map.values()) {
        bytesUsed += estimateImageEntrySize(entry);
      }
      return { bytesUsed, count: map.size };
    },
    async trim(maxBytes) {
      if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
        map.clear();
        return { bytesUsed: 0, count: 0, removed: 0, removedIds: [] };
      }
      const items = Array.from(map.values()).map((entry) => ({
        imageId: entry?.imageId,
        size: estimateImageEntrySize(entry),
        createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : 0
      }));
      let bytesUsed = items.reduce((sum, item) => sum + item.size, 0);
      if (bytesUsed <= maxBytes) {
        return { bytesUsed, count: items.length, removed: 0, removedIds: [] };
      }
      items.sort((a, b) => a.createdAt - b.createdAt);
      let removed = 0;
      const removedIds = [];
      for (const item of items) {
        if (bytesUsed <= maxBytes) break;
        if (item.imageId) {
          map.delete(item.imageId);
          removedIds.push(item.imageId);
        }
        bytesUsed -= item.size;
        removed += 1;
      }
      return { bytesUsed, count: map.size, removed, removedIds };
    }
  };
}

function openImageStoreDb(idb) {
  if (!idb) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = idb.open(IMAGE_STORE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME, { keyPath: "imageId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbStore(idb) {
  let dbPromise = null;

  const getDb = async () => {
    if (!dbPromise) {
      dbPromise = openImageStoreDb(idb).catch(() => null);
    }
    return dbPromise;
  };

  const run = async (mode, fn) => {
    const db = await getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE_NAME, mode);
      const store = tx.objectStore(IMAGE_STORE_NAME);
      let result;
      try {
        result = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  };

  return {
    async get(imageId, now = Date.now()) {
      if (!imageId) return null;
      return run("readonly", (store) => new Promise((resolve, reject) => {
        const req = store.get(imageId);
        req.onsuccess = () => {
          const entry = req.result || null;
          if (entry && typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
            run("readwrite", (rwStore) => rwStore.delete(imageId));
            resolve(null);
            return;
          }
          resolve(entry || null);
        };
        req.onerror = () => reject(req.error);
      }));
    },
    async put(entry) {
      if (!entry || !entry.imageId) return null;
      return run("readwrite", (store) => store.put(entry));
    },
    async cleanup(now = Date.now()) {
      const db = await getDb();
      if (!db) return null;
      if (!Number.isFinite(now)) {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
          const store = tx.objectStore(IMAGE_STORE_NAME);
          const clearReq = store.clear();
          clearReq.onsuccess = () => resolve(0);
          clearReq.onerror = () => reject(clearReq.error);
        });
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
        const store = tx.objectStore(IMAGE_STORE_NAME);
        const cursor = store.openCursor();
        let removed = 0;

        cursor.onsuccess = (event) => {
          const cur = event.target.result;
          if (!cur) return;
          const entry = cur.value;
          if (entry && typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
            store.delete(cur.key);
            removed += 1;
          }
          cur.continue();
        };
        tx.oncomplete = () => resolve(removed);
        tx.onerror = () => reject(tx.error);
      });
    },
    async stats() {
      const db = await getDb();
      if (!db) return { bytesUsed: 0, count: 0 };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
        const store = tx.objectStore(IMAGE_STORE_NAME);
        const cursor = store.openCursor();
        let bytesUsed = 0;
        let count = 0;

        cursor.onsuccess = (event) => {
          const cur = event.target.result;
          if (!cur) return;
          const entry = cur.value;
          bytesUsed += estimateImageEntrySize(entry);
          count += 1;
          cur.continue();
        };
        tx.oncomplete = () => resolve({ bytesUsed, count });
        tx.onerror = () => reject(tx.error);
      });
    },
    async trim(maxBytes) {
      const db = await getDb();
      if (!db) return null;
      if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
          const store = tx.objectStore(IMAGE_STORE_NAME);
          const clearReq = store.clear();
          clearReq.onsuccess = () => resolve({ bytesUsed: 0, count: 0, removed: 0, removedIds: [] });
          clearReq.onerror = () => reject(clearReq.error);
        });
      }
      const items = await new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
        const store = tx.objectStore(IMAGE_STORE_NAME);
        const cursor = store.openCursor();
        const collected = [];
        cursor.onsuccess = (event) => {
          const cur = event.target.result;
          if (!cur) return;
          const entry = cur.value;
          collected.push({
            key: cur.key,
            size: estimateImageEntrySize(entry),
            createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : 0
          });
          cur.continue();
        };
        tx.oncomplete = () => resolve(collected);
        tx.onerror = () => reject(tx.error);
      });
      let bytesUsed = items.reduce((sum, item) => sum + item.size, 0);
      if (bytesUsed <= maxBytes) {
        return { bytesUsed, count: items.length, removed: 0, removedIds: [] };
      }
      items.sort((a, b) => a.createdAt - b.createdAt);
      const removeKeys = [];
      for (const item of items) {
        if (bytesUsed <= maxBytes) break;
        bytesUsed -= item.size;
        removeKeys.push(item.key);
      }
      if (!removeKeys.length) {
        return { bytesUsed, count: items.length, removed: 0, removedIds: [] };
      }
      await run("readwrite", (store) => {
        removeKeys.forEach((key) => store.delete(key));
        return null;
      });
      return {
        bytesUsed,
        count: items.length - removeKeys.length,
        removed: removeKeys.length,
        removedIds: removeKeys
      };
    }
  };
}

let cachedStore = null;
function getDefaultImageStore() {
  if (cachedStore) return cachedStore;
  if (typeof indexedDB === "undefined") {
    cachedStore = createMemoryImageStore();
  } else {
    cachedStore = createIndexedDbStore(indexedDB);
  }
  return cachedStore;
}

async function getImageStoreEntry(imageId, store) {
  const adapter = store || getDefaultImageStore();
  return adapter.get(imageId);
}

async function putImageStoreEntry(entry, store) {
  const adapter = store || getDefaultImageStore();
  return adapter.put(entry);
}

async function cleanupImageStore(now = Date.now(), store) {
  const adapter = store || getDefaultImageStore();
  return adapter.cleanup(now);
}

async function getImageStoreStats(store) {
  const adapter = store || getDefaultImageStore();
  if (typeof adapter.stats === "function") {
    return adapter.stats();
  }
  return { bytesUsed: 0, count: 0 };
}

async function trimImageStoreToMaxBytes(maxBytes, store) {
  const adapter = store || getDefaultImageStore();
  if (typeof adapter.trim === "function") {
    return adapter.trim(maxBytes);
  }
  return null;
}

if (typeof window !== "undefined") {
  window.createMemoryImageStore = createMemoryImageStore;
  window.getImageStoreEntry = getImageStoreEntry;
  window.putImageStoreEntry = putImageStoreEntry;
  window.cleanupImageStore = cleanupImageStore;
  window.getImageStoreStats = getImageStoreStats;
  window.trimImageStoreToMaxBytes = trimImageStoreToMaxBytes;
}

if (typeof module !== "undefined") {
  module.exports = {
    createMemoryImageStore,
    getImageStoreStats,
    getImageStoreEntry,
    putImageStoreEntry,
    cleanupImageStore,
    trimImageStoreToMaxBytes
  };
}
