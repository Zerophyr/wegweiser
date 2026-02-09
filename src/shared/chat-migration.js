// chat-migration.js - migrate chat data from chrome.storage to encrypted IndexedDB

(function () {
  const chatStoreModule = (typeof require !== "undefined")
    ? require("./chat-store.js")
    : (typeof globalThis !== "undefined" ? globalThis.chatStore : null);
  const putProject = chatStoreModule?.putProject || null;
  const putThread = chatStoreModule?.putThread || null;
  const putMessage = chatStoreModule?.putMessage || null;
  const setSummary = chatStoreModule?.setSummary || null;
  const setArchivedMessages = chatStoreModule?.setArchivedMessages || null;

  const MIGRATION_FLAG = "or_chat_idb_migration_v1";
  const LEGACY_KEYS = [
    "or_projects",
    "or_project_threads",
    "or_spaces",
    "or_threads"
  ];

function normalizeThreads(rawThreads) {
  const threads = [];
  if (Array.isArray(rawThreads)) {
    rawThreads.forEach((thread) => {
      if (!thread || typeof thread !== "object") return;
      threads.push(thread);
    });
    return threads;
  }
  if (rawThreads && typeof rawThreads === "object") {
    Object.entries(rawThreads).forEach(([key, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((thread) => {
        if (!thread || typeof thread !== "object") return;
        threads.push({ ...thread, projectId: thread.projectId || thread.ProjectId || thread.spaceId || key });
      });
    });
  }
  return threads;
}

function normalizeThread(thread) {
  const normalized = { ...thread };
  const projectId = normalized.projectId || normalized.ProjectId || normalized.spaceId || null;
  if (projectId) normalized.projectId = projectId;
  delete normalized.ProjectId;
  delete normalized.spaceId;
  return normalized;
}

function ensureMessageId(message, threadId, index, baseTime) {
  const createdAt = message.createdAt || message.meta?.createdAt || (baseTime + index);
  const id = message.id || `${threadId}_msg_${index}`;
  return {
    ...message,
    id,
    threadId,
    createdAt
  };
}

async function migrateLegacyChatToIdb() {
  if (!chrome?.storage?.local) return { migrated: false };
  const getStorage = (keys) => (
    typeof globalThis !== "undefined" && typeof globalThis.getEncrypted === "function"
      ? globalThis.getEncrypted(keys)
      : chrome.storage.local.get(keys)
  );

  const stored = await getStorage([MIGRATION_FLAG, ...LEGACY_KEYS]);
  if (stored[MIGRATION_FLAG]) return { migrated: false };

  const projects = Array.isArray(stored.or_projects)
    ? stored.or_projects
    : (Array.isArray(stored.or_spaces) ? stored.or_spaces : []);
  const rawThreads = stored.or_project_threads ?? stored.or_threads ?? [];
  const threads = normalizeThreads(rawThreads).map(normalizeThread);

  if (!projects.length && !threads.length) return { migrated: false };

  for (const project of projects) {
    if (project && project.id) {
      await putProject(project);
    }
  }

  for (const thread of threads) {
    if (!thread || !thread.id) continue;
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const archivedMessages = Array.isArray(thread.archivedMessages) ? thread.archivedMessages : [];
    const summary = typeof thread.summary === "string" ? thread.summary : "";
    const summaryUpdatedAt = thread.summaryUpdatedAt || null;
    const archivedUpdatedAt = thread.archivedUpdatedAt || null;

    const threadRecord = { ...thread };
    delete threadRecord.messages;
    delete threadRecord.summary;
    delete threadRecord.summaryUpdatedAt;
    delete threadRecord.archivedMessages;
    delete threadRecord.archivedUpdatedAt;

    await putThread(threadRecord);

    const baseTime = thread.updatedAt || thread.createdAt || Date.now();
    for (let i = 0; i < messages.length; i += 1) {
      await putMessage(ensureMessageId(messages[i], thread.id, i, baseTime));
    }

    if (summary) {
      await setSummary(thread.id, summary, summaryUpdatedAt);
    }

    if (archivedMessages.length) {
      const archivedWithIds = archivedMessages.map((msg, index) => (
        ensureMessageId(msg, thread.id, index, baseTime)
      ));
      await setArchivedMessages(thread.id, archivedWithIds, archivedUpdatedAt);
    }
  }

  await chrome.storage.local.remove(LEGACY_KEYS);
  await chrome.storage.local.set({ [MIGRATION_FLAG]: true });

  return { migrated: true };
}

  if (typeof globalThis !== "undefined") {
    globalThis.migrateLegacyChatToIdb = migrateLegacyChatToIdb;
  }

  if (typeof module !== "undefined") {
    module.exports = { migrateLegacyChatToIdb };
  }
})();
