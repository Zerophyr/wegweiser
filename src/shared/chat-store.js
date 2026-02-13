// chat-store.js - encrypted IndexedDB-backed chat storage

(function () {
  const cryptoStore = (typeof require !== "undefined")
    ? require("./crypto-store.js")
    : (typeof globalThis !== "undefined" ? globalThis : {});
  const encryptJson = cryptoStore.encryptJson;
  const decryptJson = cryptoStore.decryptJson;
  const backends = (typeof require !== "undefined")
    ? require("./chat-store-backends.js")
    : (typeof globalThis !== "undefined" ? (globalThis.chatStoreBackends || {}) : {});
  const {
    STORE_NAMES = {
      PROJECTS: "projects",
      THREADS: "threads",
      MESSAGES: "messages",
      SUMMARIES: "summaries",
      ARCHIVES: "archives"
    },
    estimateRecordSize = () => 0,
    createEmptyStats = () => ({
      bytesUsed: 0,
      counts: { projects: 0, threads: 0, messages: 0, summaries: 0, archives: 0 }
    }),
    createMemoryChatStore = () => ({
      projects: new Map(),
      threads: new Map(),
      messages: new Map(),
      summaries: new Map(),
      archives: new Map(),
      stats: async () => ({ bytesUsed: 0, counts: { projects: 0, threads: 0, messages: 0, summaries: 0, archives: 0 } })
    }),
    createIndexedDbChatStore = () => null
  } = backends;

let cachedStore = null;

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

async function deleteProject(projectId, store) {
  const adapter = store || getDefaultStore();
  if (!projectId) return null;
  if (typeof adapter.deleteProject === "function") {
    await adapter.deleteProject(projectId);
  } else {
    adapter.projects.delete(projectId);
  }
  return true;
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

async function getThreads(store) {
  const adapter = store || getDefaultStore();
  const list = typeof adapter.getThreads === "function"
    ? await adapter.getThreads()
    : Array.from(adapter.threads.values());
  const result = [];
  for (const record of list || []) {
    const decrypted = await decryptJson(record);
    if (decrypted) result.push(decrypted);
  }
  return result;
}

async function getThreadsByProject(projectId, store) {
  const adapter = store || getDefaultStore();
  if (!projectId) return [];
  const list = typeof adapter.getThreadsByProject === "function"
    ? await adapter.getThreadsByProject(projectId)
    : Array.from(adapter.threads.values()).filter((record) => record?.projectId === projectId);
  const result = [];
  for (const record of list || []) {
    const decrypted = await decryptJson(record);
    if (decrypted) result.push(decrypted);
  }
  return result;
}

async function deleteThread(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  if (typeof adapter.deleteThread === "function") {
    await adapter.deleteThread(threadId);
  } else {
    adapter.threads.delete(threadId);
  }
  if (typeof adapter.deleteMessages === "function") {
    await adapter.deleteMessages(threadId);
  } else {
    adapter.messages.delete(threadId);
  }
  if (typeof adapter.deleteSummary === "function") {
    await adapter.deleteSummary(threadId);
  } else {
    adapter.summaries.delete(threadId);
  }
  if (typeof adapter.deleteArchive === "function") {
    await adapter.deleteArchive(threadId);
  } else {
    adapter.archives.delete(threadId);
  }
  return true;
}

async function getChatStoreStats(store) {
  const adapter = store || getDefaultStore();
  if (typeof adapter?.stats === "function") {
    return adapter.stats();
  }
  if (!adapter) return createEmptyStats();
  const stats = createEmptyStats();
  if (adapter.projects instanceof Map) {
    stats.counts.projects = adapter.projects.size;
    adapter.projects.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
  }
  if (adapter.threads instanceof Map) {
    stats.counts.threads = adapter.threads.size;
    adapter.threads.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
  }
  if (adapter.summaries instanceof Map) {
    stats.counts.summaries = adapter.summaries.size;
    adapter.summaries.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
  }
  if (adapter.archives instanceof Map) {
    stats.counts.archives = adapter.archives.size;
    adapter.archives.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
  }
  if (adapter.messages instanceof Map) {
    adapter.messages.forEach((list) => {
      const items = Array.isArray(list) ? list : [];
      stats.counts.messages += items.length;
      items.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    });
  }
  return stats;
}

if (typeof window !== "undefined") {
  window.chatStore = {
    createMemoryChatStore,
    createIndexedDbChatStore,
    putProject,
    getProject,
    getProjects,
    deleteProject,
    getThreads,
    getThreadsByProject,
    putThread,
    getThread,
    deleteThread,
    putMessage,
    getMessages,
    setSummary,
    getSummary,
    setArchivedMessages,
    getArchivedMessages,
    getStats: getChatStoreStats
  };
  window.getChatStoreStats = getChatStoreStats;
}

if (typeof module !== "undefined") {
  module.exports = {
    createMemoryChatStore,
    createIndexedDbChatStore,
    putProject,
    getProject,
    getProjects,
    deleteProject,
    getThreads,
    putThread,
    getThread,
    getThreadsByProject,
    deleteThread,
    putMessage,
    getMessages,
    setSummary,
    getSummary,
    setArchivedMessages,
    getArchivedMessages,
    getChatStoreStats
  };
}
})();
