// projects-storage-bindings-utils.js - binds storage controller helpers with runtime deps

function createProjectsStorageBindings(deps) {
  const {
    storageController,
    chatStore,
    normalizeThreadProjectId,
    buildThreadRecordForStorage,
    ensureThreadMessage,
    getLocalStorage,
    setLocalStorage,
    storageKeys,
    normalizeLegacyThreadsPayload,
    createProjectRecord,
    applyProjectUpdate,
    createThreadRecord,
    applyThreadUpdate,
    appendMessageToThreadData,
    generateThreadTitle,
    generateId,
    fallbackModel,
    logger
  } = deps;

  const api = {};

  api.persistThreadToChatStore = async (thread) => storageController.persistThreadToChatStore(thread, {
    chatStore,
    normalizeThreadProjectId,
    buildThreadRecordForStorage,
    ensureThreadMessage
  });

  api.saveProjects = async (projects) => storageController.saveProjects(projects, {
    chatStore,
    setLocalStorage,
    storageKeys
  });

  api.loadProjects = async () => {
    const projects = await storageController.loadProjects({
      chatStore,
      getLocalStorage,
      storageKeys,
      logger: logger || console
    });
    let changed = false;
    const migrated = (Array.isArray(projects) ? projects : []).map((project) => {
      if (!project || typeof project !== "object") return project;
      if (String(project.modelProvider || "").toLowerCase() !== "naga") return project;
      changed = true;
      const nextModel = fallbackModel || "openai/gpt-4o-mini";
      return {
        ...project,
        modelProvider: "openrouter",
        model: nextModel,
        modelDisplayName: nextModel
      };
    });
    if (changed) {
      await api.saveProjects(migrated);
    }
    return migrated;
  };

  api.loadThreads = async (projectId = null) => storageController.loadThreads(projectId, {
    chatStore,
    getLocalStorage,
    storageKeys,
    normalizeLegacyThreadsPayload,
    saveThreads: api.saveThreads,
    logger: logger || console
  });

  api.saveThreads = async (threads) => storageController.saveThreads(threads, {
    chatStore,
    setLocalStorage,
    storageKeys,
    persistThreadToChatStore: api.persistThreadToChatStore
  });

  api.getThreadCount = async (projectId) => storageController.getThreadCount(projectId, { loadThreads: api.loadThreads });
  api.createProject = async (data) => storageController.createProject(data, {
    loadProjects: api.loadProjects,
    saveProjects: api.saveProjects,
    createProjectRecord,
    generateId
  });
  api.updateProject = async (id, data) => storageController.updateProject(id, data, {
    loadProjects: api.loadProjects,
    saveProjects: api.saveProjects,
    applyProjectUpdate
  });
  api.deleteProject = async (id) => storageController.deleteProject(id, {
    loadProjects: api.loadProjects,
    saveProjects: api.saveProjects,
    loadThreads: api.loadThreads,
    saveThreads: api.saveThreads
  });
  api.getProject = async (id) => storageController.getProject(id, { loadProjects: api.loadProjects });
  api.createThread = async (projectId, title = "New Thread") => storageController.createThread(projectId, title, {
    loadThreads: api.loadThreads,
    saveThreads: api.saveThreads,
    createThreadRecord,
    generateId
  });
  api.updateThread = async (id, data) => storageController.updateThread(id, data, {
    loadThreads: api.loadThreads,
    saveThreads: api.saveThreads,
    applyThreadUpdate
  });
  api.deleteThread = async (id) => storageController.deleteThread(id, {
    loadThreads: api.loadThreads,
    saveThreads: api.saveThreads
  });
  api.getThread = async (id) => storageController.getThread(id, { loadThreads: api.loadThreads });
  api.addMessageToThread = async (threadId, message) => storageController.addMessageToThread(threadId, message, {
    getThread: api.getThread,
    loadThreads: api.loadThreads,
    saveThreads: api.saveThreads,
    appendMessageToThreadData,
    generateThreadTitle
  });

  return api;
}

const projectsStorageBindingsUtils = { createProjectsStorageBindings };

if (typeof window !== "undefined") {
  window.projectsStorageBindingsUtils = projectsStorageBindingsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStorageBindingsUtils;
}
