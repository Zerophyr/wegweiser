// projects-storage-controller-utils.js - Projects/threads persistence and CRUD orchestration

async function persistThreadToChatStore(thread, deps) {
  const {
    chatStore,
    normalizeThreadProjectId,
    buildThreadRecordForStorage,
    ensureThreadMessage
  } = deps;
  if (!chatStore || typeof chatStore.putThread !== "function") return;
  if (!thread || !thread.id) return;

  const normalized = normalizeThreadProjectId(thread);
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const archivedMessages = Array.isArray(thread.archivedMessages) ? thread.archivedMessages : [];
  const summary = typeof thread.summary === "string" ? thread.summary : "";
  const summaryUpdatedAt = thread.summaryUpdatedAt || null;
  const archivedUpdatedAt = thread.archivedUpdatedAt || null;
  const baseTime = normalized.updatedAt || normalized.createdAt || Date.now();

  const threadRecord = buildThreadRecordForStorage(normalized);

  if (typeof chatStore.deleteThread === "function") {
    await chatStore.deleteThread(threadRecord.id);
  }
  await chatStore.putThread(threadRecord);

  for (let i = 0; i < messages.length; i += 1) {
    await chatStore.putMessage(ensureThreadMessage(messages[i], threadRecord.id, i, baseTime));
  }

  if (typeof chatStore.setSummary === "function" && (summary || summaryUpdatedAt)) {
    await chatStore.setSummary(threadRecord.id, summary, summaryUpdatedAt);
  }

  if (typeof chatStore.setArchivedMessages === "function" && (archivedMessages.length || archivedUpdatedAt)) {
    const archivedWithIds = archivedMessages.map((msg, index) => (
      ensureThreadMessage(msg, threadRecord.id, index, baseTime)
    ));
    await chatStore.setArchivedMessages(threadRecord.id, archivedWithIds, archivedUpdatedAt);
  }
}

async function loadProjects(deps) {
  const { chatStore, getLocalStorage, storageKeys, logger } = deps;
  try {
    if (chatStore && typeof chatStore.getProjects === "function") {
      return await chatStore.getProjects();
    }
    const result = await getLocalStorage([storageKeys.PROJECTS]);
    return result[storageKeys.PROJECTS] || [];
  } catch (e) {
    (logger || console).error("Error loading Projects:", e);
    return [];
  }
}

async function saveProjects(projects, deps) {
  const { chatStore, setLocalStorage, storageKeys } = deps;
  if (chatStore && typeof chatStore.putProject === "function") {
    const existing = (typeof chatStore.getProjects === "function")
      ? await chatStore.getProjects()
      : [];
    const nextIds = new Set((projects || []).map((project) => project.id));
    for (const project of (projects || [])) {
      if (project && project.id) {
        await chatStore.putProject(project);
      }
    }
    if (typeof chatStore.deleteProject === "function") {
      for (const project of existing || []) {
        if (project?.id && !nextIds.has(project.id)) {
          await chatStore.deleteProject(project.id);
        }
      }
    }
    return;
  }
  await setLocalStorage({ [storageKeys.PROJECTS]: projects });
}

async function loadThreads(projectId, deps) {
  const {
    chatStore,
    getLocalStorage,
    storageKeys,
    normalizeLegacyThreadsPayload,
    saveThreads,
    logger
  } = deps;
  try {
    if (chatStore && typeof chatStore.getThreads === "function") {
      const rawThreads = projectId && typeof chatStore.getThreadsByProject === "function"
        ? await chatStore.getThreadsByProject(projectId)
        : await chatStore.getThreads();
      const filteredThreads = (rawThreads || []).filter((thread) => thread?.projectId !== "__sidepanel__");
      const hydrated = [];
      for (const thread of filteredThreads) {
        const messages = await chatStore.getMessages?.(thread.id) || [];
        const summaryData = await chatStore.getSummary?.(thread.id);
        const archivedData = await chatStore.getArchivedMessages?.(thread.id);
        hydrated.push({
          ...thread,
          projectId: thread.projectId || projectId || null,
          messages,
          summary: summaryData?.summary || "",
          summaryUpdatedAt: summaryData?.summaryUpdatedAt || null,
          archivedMessages: archivedData?.archivedMessages || [],
          archivedUpdatedAt: archivedData?.archivedUpdatedAt || null
        });
      }
      return hydrated;
    }

    const result = await getLocalStorage([storageKeys.PROJECT_THREADS]);
    const rawThreads = result[storageKeys.PROJECT_THREADS];
    const normalizedResult = normalizeLegacyThreadsPayload(rawThreads);
    const threads = normalizedResult.threads;
    const normalized = normalizedResult.normalized;

    if (normalized) {
      await saveThreads(threads);
    }

    if (projectId) {
      return threads.filter((t) => t.projectId === projectId);
    }
    return threads;
  } catch (e) {
    (logger || console).error("Error loading threads:", e);
    return [];
  }
}

async function saveThreads(threads, deps) {
  const {
    chatStore,
    setLocalStorage,
    storageKeys,
    persistThreadToChatStore
  } = deps;
  if (chatStore && typeof chatStore.putThread === "function") {
    const existing = (typeof chatStore.getThreads === "function")
      ? await chatStore.getThreads()
      : [];
    const nextIds = new Set((threads || []).map((thread) => thread.id));
    if (typeof chatStore.deleteThread === "function") {
      for (const thread of existing || []) {
        if (thread?.id && !nextIds.has(thread.id)) {
          await chatStore.deleteThread(thread.id);
        }
      }
    }
    for (const thread of (threads || [])) {
      await persistThreadToChatStore(thread);
    }
    return;
  }
  await setLocalStorage({ [storageKeys.PROJECT_THREADS]: threads });
}

async function getThreadCount(projectId, deps) {
  const threads = await deps.loadThreads(projectId);
  return threads.length;
}

async function createProject(data, deps) {
  const projects = await deps.loadProjects();
  const project = deps.createProjectRecord({
    data,
    id: deps.generateId("project"),
    now: Date.now()
  });
  projects.push(project);
  await deps.saveProjects(projects);
  return project;
}

async function updateProject(id, data, deps) {
  const projects = await deps.loadProjects();
  const index = projects.findIndex((s) => s.id === id);
  if (index === -1) throw new Error("Project not found");

  projects[index] = deps.applyProjectUpdate(projects[index], data, Date.now());
  await deps.saveProjects(projects);
  return projects[index];
}

async function deleteProject(id, deps) {
  const projects = await deps.loadProjects();
  const filtered = projects.filter((s) => s.id !== id);
  await deps.saveProjects(filtered);

  const threads = await deps.loadThreads();
  const filteredThreads = threads.filter((t) => t.projectId !== id);
  await deps.saveThreads(filteredThreads);
}

async function getProject(id, deps) {
  const projects = await deps.loadProjects();
  return projects.find((s) => s.id === id);
}

async function createThread(projectId, title, deps) {
  const threads = await deps.loadThreads();
  const thread = deps.createThreadRecord({
    id: deps.generateId("thread"),
    projectId,
    title: title || "New Thread",
    now: Date.now()
  });
  threads.push(thread);
  await deps.saveThreads(threads);
  return thread;
}

async function updateThread(id, data, deps) {
  const threads = await deps.loadThreads();
  const index = threads.findIndex((t) => t.id === id);
  if (index === -1) throw new Error("Thread not found");

  threads[index] = deps.applyThreadUpdate(threads[index], data, Date.now());
  await deps.saveThreads(threads);
  return threads[index];
}

async function deleteThread(id, deps) {
  const threads = await deps.loadThreads();
  const filtered = threads.filter((t) => t.id !== id);
  await deps.saveThreads(filtered);
}

async function getThread(id, deps) {
  const threads = await deps.loadThreads();
  return threads.find((t) => t.id === id);
}

async function addMessageToThread(threadId, message, deps) {
  let thread = await deps.getThread(threadId);
  if (!thread) throw new Error("Thread not found");

  thread = deps.appendMessageToThreadData({
    thread,
    message,
    now: Date.now(),
    generateThreadTitle: deps.generateThreadTitle
  });

  const threads = await deps.loadThreads();
  const index = threads.findIndex((t) => t.id === threadId);
  threads[index] = thread;
  await deps.saveThreads(threads);

  return thread;
}

const projectsStorageControllerUtils = {
  persistThreadToChatStore,
  loadProjects,
  saveProjects,
  loadThreads,
  saveThreads,
  getThreadCount,
  createProject,
  updateProject,
  deleteProject,
  getProject,
  createThread,
  updateThread,
  deleteThread,
  getThread,
  addMessageToThread
};

if (typeof window !== "undefined") {
  window.projectsStorageControllerUtils = projectsStorageControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStorageControllerUtils;
}
