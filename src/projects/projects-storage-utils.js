// projects-storage-utils.js - Storage usage helpers for Projects UI

async function getIndexedDbStorageUsage(options = {}) {
  const getImageStats = options.getImageStoreStats;
  const getChatStats = options.getChatStoreStats;
  const chatStore = options.chatStore;
  const storageApi = options.storageApi || (typeof navigator !== "undefined" ? navigator.storage : null);
  const logger = options.logger || console;
  const quotaBytesOverride = Number.isFinite(options.quotaBytesOverride) && options.quotaBytesOverride > 0
    ? options.quotaBytesOverride
    : null;

  let imageBytes = 0;
  let chatBytes = 0;
  let quotaBytes = null;
  let percentUsed = null;

  if (typeof getImageStats === "function") {
    const imageStats = await getImageStats();
    if (typeof imageStats?.bytesUsed === "number") {
      imageBytes = imageStats.bytesUsed;
    }
  }

  if (typeof getChatStats === "function") {
    const chatStats = await getChatStats();
    if (typeof chatStats?.bytesUsed === "number") {
      chatBytes = chatStats.bytesUsed;
    }
  } else if (chatStore && typeof chatStore.getStats === "function") {
    const chatStats = await chatStore.getStats();
    if (typeof chatStats?.bytesUsed === "number") {
      chatBytes = chatStats.bytesUsed;
    }
  }

  const bytesUsed = imageBytes + chatBytes;
  if (quotaBytesOverride) {
    quotaBytes = quotaBytesOverride;
    percentUsed = (bytesUsed / quotaBytes) * 100;
  } else if (storageApi && typeof storageApi.estimate === "function") {
    try {
      const estimate = await storageApi.estimate();
      if (typeof estimate?.quota === "number") {
        quotaBytes = estimate.quota;
        if (quotaBytes > 0) {
          percentUsed = (bytesUsed / quotaBytes) * 100;
        }
      }
    } catch (err) {
      if (logger && typeof logger.warn === "function") {
        logger.warn("Failed to estimate storage quota:", err);
      }
    }
  }

  return {
    bytesUsed,
    percentUsed,
    quotaBytes
  };
}

async function estimateItemSize(item) {
  const json = JSON.stringify(item);
  return new Blob([json]).size;
}

function normalizeThreadProjectId(thread) {
  if (!thread || typeof thread !== "object") return thread;
  const projectId = thread.projectId || thread.ProjectId || thread.spaceId || null;
  const normalized = { ...thread, projectId };
  delete normalized.ProjectId;
  delete normalized.spaceId;
  return normalized;
}

function ensureThreadMessage(message, threadId, index, baseTime) {
  const createdAt = message.createdAt || message.meta?.createdAt || (baseTime + index);
  const id = message.id || `${threadId}_msg_${index}`;
  return {
    ...message,
    id,
    threadId,
    createdAt
  };
}

function buildThreadRecordForStorage(thread) {
  const record = { ...(thread || {}) };
  delete record.messages;
  delete record.summary;
  delete record.summaryUpdatedAt;
  delete record.archivedMessages;
  delete record.archivedUpdatedAt;
  return record;
}

function normalizeLegacyThreadsPayload(rawThreads) {
  let threads = [];
  let normalized = false;

  if (Array.isArray(rawThreads)) {
    threads = rawThreads;
  } else if (rawThreads && typeof rawThreads === "object") {
    Object.entries(rawThreads).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((thread) => {
        if (!thread || typeof thread !== "object") return;
        const normalizedThread = normalizeThreadProjectId({
          ...thread,
          projectId: thread.projectId === undefined ? (thread.ProjectId || thread.spaceId || key) : thread.projectId
        });
        threads.push(normalizedThread);
        normalized = true;
      });
    });
  }

  threads = threads.map((thread) => {
    const next = normalizeThreadProjectId(thread);
    if (next !== thread || thread?.ProjectId !== undefined || thread?.spaceId !== undefined) {
      normalized = true;
    }
    return next;
  });

  return { threads, normalized };
}

const projectsStorageUtils = {
  getIndexedDbStorageUsage,
  estimateItemSize,
  normalizeThreadProjectId,
  ensureThreadMessage,
  buildThreadRecordForStorage,
  normalizeLegacyThreadsPayload
};

if (typeof window !== "undefined") {
  window.projectsStorageUtils = projectsStorageUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStorageUtils;
}
