// chat-store-backends.js - backend creation/helpers for chat-store

const CHAT_STORE_DB = "wegweiser-chat-store";
const STORE_NAMES = {
  PROJECTS: "projects",
  THREADS: "threads",
  MESSAGES: "messages",
  SUMMARIES: "summaries",
  ARCHIVES: "archives"
};

function estimateRecordSize(record) {
  if (!record) return 0;
  try {
    const json = JSON.stringify(record);
    if (typeof Blob !== "undefined") {
      return new Blob([json]).size;
    }
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch (e) {
    return 0;
  }
}

function createEmptyStats() {
  return {
    bytesUsed: 0,
    counts: {
      projects: 0,
      threads: 0,
      messages: 0,
      summaries: 0,
      archives: 0
    }
  };
}

function createMemoryChatStore() {
  const store = {
    projects: new Map(),
    threads: new Map(),
    messages: new Map(),
    summaries: new Map(),
    archives: new Map()
  };
  store.stats = async () => {
    const stats = createEmptyStats();
    stats.counts.projects = store.projects.size;
    stats.counts.threads = store.threads.size;
    stats.counts.summaries = store.summaries.size;
    stats.counts.archives = store.archives.size;
    store.projects.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    store.threads.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    store.summaries.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    store.archives.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    store.messages.forEach((list) => {
      const items = Array.isArray(list) ? list : [];
      stats.counts.messages += items.length;
      items.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    });
    return stats;
  };
  return store;
}

function openChatStoreDb(idb) {
  if (!idb) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = idb.open(CHAT_STORE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAMES.THREADS)) {
        const store = db.createObjectStore(STORE_NAMES.THREADS, { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.PROJECTS)) {
        db.createObjectStore(STORE_NAMES.PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.MESSAGES)) {
        const store = db.createObjectStore(STORE_NAMES.MESSAGES, { keyPath: "id" });
        store.createIndex("threadId", "threadId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.SUMMARIES)) {
        const store = db.createObjectStore(STORE_NAMES.SUMMARIES, { keyPath: "id" });
        store.createIndex("threadId", "threadId", { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.ARCHIVES)) {
        const store = db.createObjectStore(STORE_NAMES.ARCHIVES, { keyPath: "id" });
        store.createIndex("threadId", "threadId", { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbChatStore(idb) {
  let dbPromise = null;
  const getDb = async () => {
    if (!dbPromise) {
      dbPromise = openChatStoreDb(idb).catch(() => null);
    }
    return dbPromise;
  };

  const run = async (storeName, mode, fn) => {
    const db = await getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
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
    async stats() {
      const db = await getDb();
      if (!db) return createEmptyStats();
      return new Promise((resolve, reject) => {
        const stats = createEmptyStats();
        const storeNames = Object.values(STORE_NAMES);
        const tx = db.transaction(storeNames, "readonly");
        storeNames.forEach((storeName) => {
          const store = tx.objectStore(storeName);
          const req = store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            stats.bytesUsed += estimateRecordSize(cursor.value);
            if (storeName === STORE_NAMES.PROJECTS) stats.counts.projects += 1;
            if (storeName === STORE_NAMES.THREADS) stats.counts.threads += 1;
            if (storeName === STORE_NAMES.MESSAGES) stats.counts.messages += 1;
            if (storeName === STORE_NAMES.SUMMARIES) stats.counts.summaries += 1;
            if (storeName === STORE_NAMES.ARCHIVES) stats.counts.archives += 1;
            cursor.continue();
          };
          req.onerror = () => {};
        });
        tx.oncomplete = () => resolve(stats);
        tx.onerror = () => reject(tx.error);
      });
    },
    async putProject(record) {
      return run(STORE_NAMES.PROJECTS, "readwrite", (store) => store.put(record));
    },
    async getProject(projectId) {
      if (!projectId) return null;
      return run(STORE_NAMES.PROJECTS, "readonly", (store) => new Promise((resolve, reject) => {
        const req = store.get(projectId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      }));
    },
    async getProjects() {
      return run(STORE_NAMES.PROJECTS, "readonly", (store) => new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }));
    },
    async deleteProject(projectId) {
      if (!projectId) return null;
      return run(STORE_NAMES.PROJECTS, "readwrite", (store) => store.delete(projectId));
    },
    async getThreads() {
      return run(STORE_NAMES.THREADS, "readonly", (store) => new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }));
    },
    async getThreadsByProject(projectId) {
      if (!projectId) return [];
      return run(STORE_NAMES.THREADS, "readonly", (store) => new Promise((resolve, reject) => {
        const index = store.index("projectId");
        const req = index.getAll(projectId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }));
    },
    async deleteThread(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.THREADS, "readwrite", (store) => store.delete(threadId));
    },
    async putThread(record) {
      return run(STORE_NAMES.THREADS, "readwrite", (store) => store.put(record));
    },
    async getThread(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.THREADS, "readonly", (store) => new Promise((resolve, reject) => {
        const req = store.get(threadId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      }));
    },
    async putMessage(record) {
      return run(STORE_NAMES.MESSAGES, "readwrite", (store) => store.put(record));
    },
    async getMessages(threadId) {
      if (!threadId) return [];
      return run(STORE_NAMES.MESSAGES, "readonly", (store) => new Promise((resolve, reject) => {
        const index = store.index("threadId");
        const req = index.getAll(threadId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }));
    },
    async deleteMessages(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.MESSAGES, "readwrite", (store) => new Promise((resolve, reject) => {
        const index = store.index("threadId");
        const req = index.getAll(threadId);
        req.onsuccess = () => {
          const records = req.result || [];
          records.forEach((record) => {
            if (record?.id) store.delete(record.id);
          });
          resolve(records.length);
        };
        req.onerror = () => reject(req.error);
      }));
    },
    async putSummary(record) {
      return run(STORE_NAMES.SUMMARIES, "readwrite", (store) => store.put(record));
    },
    async getSummary(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.SUMMARIES, "readonly", (store) => new Promise((resolve, reject) => {
        const req = store.get(threadId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      }));
    },
    async deleteSummary(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.SUMMARIES, "readwrite", (store) => store.delete(threadId));
    },
    async putArchive(record) {
      return run(STORE_NAMES.ARCHIVES, "readwrite", (store) => store.put(record));
    },
    async getArchive(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.ARCHIVES, "readonly", (store) => new Promise((resolve, reject) => {
        const req = store.get(threadId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      }));
    },
    async deleteArchive(threadId) {
      if (!threadId) return null;
      return run(STORE_NAMES.ARCHIVES, "readwrite", (store) => store.delete(threadId));
    }
  };
}

const chatStoreBackends = {
  CHAT_STORE_DB,
  STORE_NAMES,
  estimateRecordSize,
  createEmptyStats,
  createMemoryChatStore,
  openChatStoreDb,
  createIndexedDbChatStore
};

if (typeof window !== "undefined") {
  window.chatStoreBackends = chatStoreBackends;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = chatStoreBackends;
}
