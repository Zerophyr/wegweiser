// chat-store.js - encrypted IndexedDB-backed chat storage

const { encryptJson, decryptJson } = require("./crypto-store.js");

const CHAT_STORE_DB = "wegweiser-chat-store";
const STORE_NAMES = {
  PROJECTS: "projects",
  THREADS: "threads",
  MESSAGES: "messages",
  SUMMARIES: "summaries",
  ARCHIVES: "archives"
};

let cachedStore = null;

function createMemoryChatStore() {
  return {
    projects: new Map(),
    threads: new Map(),
    messages: new Map(),
    summaries: new Map(),
    archives: new Map()
  };
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
    }
  };
}

function getDefaultStore() {
  if (!cachedStore) {
    if (typeof indexedDB === "undefined") {
      cachedStore = createMemoryChatStore();
    } else {
      cachedStore = createIndexedDbChatStore(indexedDB);
    }
  }
  return cachedStore;
}

async function putThread(thread, store) {
  const adapter = store || getDefaultStore();
  if (!thread || !thread.id) return null;
  const encrypted = await encryptJson(thread);
  const record = {
    id: thread.id,
    projectId: thread.projectId || null,
    data: encrypted.data,
    iv: encrypted.iv,
    alg: encrypted.alg,
    v: encrypted.v
  };
  if (typeof adapter.putThread === "function") {
    await adapter.putThread(record);
  } else {
    adapter.threads.set(thread.id, record);
  }
  return thread;
}

async function getThread(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  const record = typeof adapter.getThread === "function"
    ? await adapter.getThread(threadId)
    : (adapter.threads.get(threadId) || null);
  if (!record) return null;
  return decryptJson(record);
}

async function putMessage(message, store) {
  const adapter = store || getDefaultStore();
  if (!message || !message.id || !message.threadId) return null;
  const createdAt = message.createdAt || message.meta?.createdAt || Date.now();
  const encrypted = await encryptJson(message);
  const record = {
    id: message.id,
    threadId: message.threadId,
    role: message.role || null,
    createdAt,
    data: encrypted.data,
    iv: encrypted.iv,
    alg: encrypted.alg,
    v: encrypted.v
  };
  if (typeof adapter.putMessage === "function") {
    await adapter.putMessage(record);
  } else {
    const list = adapter.messages.get(message.threadId) || [];
    list.push(record);
    adapter.messages.set(message.threadId, list);
  }
  return message;
}

async function getMessages(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return [];
  const list = typeof adapter.getMessages === "function"
    ? await adapter.getMessages(threadId)
    : (adapter.messages.get(threadId) || []);
  const result = [];
  for (const record of list) {
    const decrypted = await decryptJson(record);
    if (decrypted) result.push(decrypted);
  }
  result.sort((a, b) => {
    const aTime = typeof a?.createdAt === "number" ? a.createdAt : 0;
    const bTime = typeof b?.createdAt === "number" ? b.createdAt : 0;
    return aTime - bTime;
  });
  return result;
}

async function setSummary(threadId, summary, summaryUpdatedAt, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  const payload = {
    threadId,
    summary: summary || "",
    summaryUpdatedAt: summaryUpdatedAt || null
  };
  const encrypted = await encryptJson(payload);
  const record = {
    id: threadId,
    threadId,
    updatedAt: summaryUpdatedAt || null,
    data: encrypted.data,
    iv: encrypted.iv,
    alg: encrypted.alg,
    v: encrypted.v
  };
  if (typeof adapter.putSummary === "function") {
    await adapter.putSummary(record);
  } else {
    adapter.summaries.set(threadId, record);
  }
  return payload;
}

async function getSummary(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  const record = typeof adapter.getSummary === "function"
    ? await adapter.getSummary(threadId)
    : (adapter.summaries.get(threadId) || null);
  if (!record) return null;
  return decryptJson(record);
}

async function setArchivedMessages(threadId, archivedMessages, archivedUpdatedAt, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  const payload = {
    threadId,
    archivedMessages: Array.isArray(archivedMessages) ? archivedMessages : [],
    archivedUpdatedAt: archivedUpdatedAt || null
  };
  const encrypted = await encryptJson(payload);
  const record = {
    id: threadId,
    threadId,
    updatedAt: archivedUpdatedAt || null,
    data: encrypted.data,
    iv: encrypted.iv,
    alg: encrypted.alg,
    v: encrypted.v
  };
  if (typeof adapter.putArchive === "function") {
    await adapter.putArchive(record);
  } else {
    adapter.archives.set(threadId, record);
  }
  return payload;
}

async function getArchivedMessages(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  const record = typeof adapter.getArchive === "function"
    ? await adapter.getArchive(threadId)
    : (adapter.archives.get(threadId) || null);
  if (!record) return null;
  return decryptJson(record);
}

async function putProject(project, store) {
  const adapter = store || getDefaultStore();
  if (!project || !project.id) return null;
  const encrypted = await encryptJson(project);
  const record = {
    id: project.id,
    updatedAt: project.updatedAt || null,
    data: encrypted.data,
    iv: encrypted.iv,
    alg: encrypted.alg,
    v: encrypted.v
  };
  if (typeof adapter.putProject === "function") {
    await adapter.putProject(record);
  } else {
    adapter.projects.set(project.id, record);
  }
  return project;
}

async function getProject(projectId, store) {
  const adapter = store || getDefaultStore();
  if (!projectId) return null;
  const record = typeof adapter.getProject === "function"
    ? await adapter.getProject(projectId)
    : (adapter.projects.get(projectId) || null);
  if (!record) return null;
  return decryptJson(record);
}

async function getProjects(store) {
  const adapter = store || getDefaultStore();
  const list = typeof adapter.getProjects === "function"
    ? await adapter.getProjects()
    : Array.from(adapter.projects.values());
  const result = [];
  for (const record of list || []) {
    const decrypted = await decryptJson(record);
    if (decrypted) result.push(decrypted);
  }
  return result;
}

if (typeof module !== "undefined") {
  module.exports = {
    createMemoryChatStore,
    createIndexedDbChatStore,
    putProject,
    getProject,
    getProjects,
    putThread,
    getThread,
    putMessage,
    getMessages,
    setSummary,
    getSummary,
    setArchivedMessages,
    getArchivedMessages
  };
}
