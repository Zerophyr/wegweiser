// chat-store.js - encrypted IndexedDB-backed chat storage
(function () {
  const root = (typeof globalThis !== "undefined") ? globalThis : {};
  const cryptoStore = (typeof require !== "undefined") ? require("./crypto-store.js") : root;
  const backends = (typeof require !== "undefined") ? require("./chat-store-backends.js") : (root.chatStoreBackends || {});
  const { encryptJson, decryptJson } = cryptoStore;
  const {
    estimateRecordSize = () => 0,
    createEmptyStats = () => ({ bytesUsed: 0, counts: { projects: 0, threads: 0, messages: 0, summaries: 0, archives: 0 } }),
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

  function createStoreAdapter() {
    const memoryStore = createMemoryChatStore();
    if (typeof indexedDB === "undefined" || typeof createIndexedDbChatStore !== "function") {
      return memoryStore;
    }
    const indexedDbStore = createIndexedDbChatStore(indexedDB);
    return (indexedDbStore && typeof indexedDbStore === "object") ? indexedDbStore : memoryStore;
  }

  function getDefaultStore() {
    if (!cachedStore || typeof cachedStore !== "object") {
      cachedStore = createStoreAdapter();
    }
    return cachedStore;
  }

  function adapterOf(store) {
    return store || getDefaultStore();
  }

  async function encodePayload(payload) {
    const encrypted = await encryptJson(payload);
    return {
      data: encrypted.data,
      iv: encrypted.iv,
      alg: encrypted.alg,
      v: encrypted.v
    };
  }

  async function decodeRecord(record) {
    if (!record) return null;
    return decryptJson(record);
  }

  async function decodeList(records) {
    const output = [];
    for (const record of (records || [])) {
      const decrypted = await decodeRecord(record);
      if (decrypted) output.push(decrypted);
    }
    return output;
  }

  async function putThread(thread, store) {
    const adapter = adapterOf(store);
    if (!thread?.id) return null;
    const record = {
      id: thread.id,
      projectId: thread.projectId || null,
      ...(await encodePayload(thread))
    };
    if (typeof adapter.putThread === "function") {
      await adapter.putThread(record);
    } else {
      adapter.threads.set(thread.id, record);
    }
    return thread;
  }

  async function getThread(threadId, store) {
    const adapter = adapterOf(store);
    if (!threadId) return null;
    const record = (typeof adapter.getThread === "function")
      ? await adapter.getThread(threadId)
      : (adapter.threads.get(threadId) || null);
    return decodeRecord(record);
  }

  async function putMessage(message, store) {
    const adapter = adapterOf(store);
    if (!message?.id || !message?.threadId) return null;

    const createdAt = message.createdAt || message.meta?.createdAt || Date.now();
    const record = {
      id: message.id,
      threadId: message.threadId,
      role: message.role || null,
      createdAt,
      ...(await encodePayload(message))
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
    const adapter = adapterOf(store);
    if (!threadId) return [];
    const list = (typeof adapter.getMessages === "function")
      ? await adapter.getMessages(threadId)
      : (adapter.messages.get(threadId) || []);
    const result = await decodeList(list);
    result.sort((a, b) => (Number(a?.createdAt) || 0) - (Number(b?.createdAt) || 0));
    return result;
  }

  async function setSummary(threadId, summary, summaryUpdatedAt, store) {
    const adapter = adapterOf(store);
    if (!threadId) return null;

    const payload = { threadId, summary: summary || "", summaryUpdatedAt: summaryUpdatedAt || null };
    const record = {
      id: threadId,
      threadId,
      updatedAt: payload.summaryUpdatedAt,
      ...(await encodePayload(payload))
    };

    if (typeof adapter.putSummary === "function") {
      await adapter.putSummary(record);
    } else {
      adapter.summaries.set(threadId, record);
    }
    return payload;
  }

  async function getSummary(threadId, store) {
    const adapter = adapterOf(store);
    if (!threadId) return null;
    const record = (typeof adapter.getSummary === "function")
      ? await adapter.getSummary(threadId)
      : (adapter.summaries.get(threadId) || null);
    return decodeRecord(record);
  }

  async function setArchivedMessages(threadId, archivedMessages, archivedUpdatedAt, store) {
    const adapter = adapterOf(store);
    if (!threadId) return null;

    const payload = {
      threadId,
      archivedMessages: Array.isArray(archivedMessages) ? archivedMessages : [],
      archivedUpdatedAt: archivedUpdatedAt || null
    };
    const record = {
      id: threadId,
      threadId,
      updatedAt: payload.archivedUpdatedAt,
      ...(await encodePayload(payload))
    };

    if (typeof adapter.putArchive === "function") {
      await adapter.putArchive(record);
    } else {
      adapter.archives.set(threadId, record);
    }
    return payload;
  }

  async function getArchivedMessages(threadId, store) {
    const adapter = adapterOf(store);
    if (!threadId) return null;
    const record = (typeof adapter.getArchive === "function")
      ? await adapter.getArchive(threadId)
      : (adapter.archives.get(threadId) || null);
    return decodeRecord(record);
  }

  async function putProject(project, store) {
    const adapter = adapterOf(store);
    if (!project?.id) return null;
    const record = {
      id: project.id,
      updatedAt: project.updatedAt || null,
      ...(await encodePayload(project))
    };
    if (typeof adapter.putProject === "function") {
      await adapter.putProject(record);
    } else {
      adapter.projects.set(project.id, record);
    }
    return project;
  }

  async function getProject(projectId, store) {
    const adapter = adapterOf(store);
    if (!projectId) return null;
    const record = (typeof adapter.getProject === "function")
      ? await adapter.getProject(projectId)
      : (adapter.projects.get(projectId) || null);
    return decodeRecord(record);
  }

  async function deleteProject(projectId, store) {
    const adapter = adapterOf(store);
    if (!projectId) return null;
    if (typeof adapter.deleteProject === "function") await adapter.deleteProject(projectId);
    else adapter.projects.delete(projectId);
    return true;
  }

  async function getProjects(store) {
    const adapter = adapterOf(store);
    const list = (typeof adapter.getProjects === "function") ? await adapter.getProjects() : Array.from(adapter.projects.values());
    return decodeList(list || []);
  }

  async function getThreads(store) {
    const adapter = adapterOf(store);
    const list = (typeof adapter.getThreads === "function") ? await adapter.getThreads() : Array.from(adapter.threads.values());
    return decodeList(list || []);
  }

  async function getThreadsByProject(projectId, store) {
    const adapter = adapterOf(store);
    if (!projectId) return [];
    const list = (typeof adapter.getThreadsByProject === "function")
      ? await adapter.getThreadsByProject(projectId)
      : Array.from(adapter.threads.values()).filter((record) => record?.projectId === projectId);
    return decodeList(list || []);
  }

  async function deleteThread(threadId, store) {
    const adapter = adapterOf(store);
    if (!threadId) return null;

    if (typeof adapter.deleteThread === "function") await adapter.deleteThread(threadId);
    else adapter.threads.delete(threadId);

    if (typeof adapter.deleteMessages === "function") await adapter.deleteMessages(threadId);
    else adapter.messages.delete(threadId);

    if (typeof adapter.deleteSummary === "function") await adapter.deleteSummary(threadId);
    else adapter.summaries.delete(threadId);

    if (typeof adapter.deleteArchive === "function") await adapter.deleteArchive(threadId);
    else adapter.archives.delete(threadId);

    return true;
  }

  async function getChatStoreStats(store) {
    const adapter = adapterOf(store);
    if (typeof adapter?.stats === "function") return adapter.stats();
    if (!adapter) return createEmptyStats();

    const stats = createEmptyStats();
    const sumMap = (map, key) => {
      if (!(map instanceof Map)) return;
      stats.counts[key] = map.size;
      map.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
    };

    sumMap(adapter.projects, "projects");
    sumMap(adapter.threads, "threads");
    sumMap(adapter.summaries, "summaries");
    sumMap(adapter.archives, "archives");

    if (adapter.messages instanceof Map) {
      adapter.messages.forEach((list) => {
        const items = Array.isArray(list) ? list : [];
        stats.counts.messages += items.length;
        items.forEach((record) => { stats.bytesUsed += estimateRecordSize(record); });
      });
    }

    return stats;
  }

  const api = {
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

  if (typeof window !== "undefined") {
    window.chatStore = api;
    window.getChatStoreStats = getChatStoreStats;
  }

  if (typeof module !== "undefined") {
    module.exports = {
      ...api,
      getChatStoreStats
    };
  }
})();