// projects-thread-controller-utils.js - thread open/create/menu orchestration

async function openProjectThread(threadId, deps) {
  let thread = await deps.getThread(threadId);
  if (!thread && typeof deps.loadThreads === "function") {
    const currentProjectId = deps.getCurrentProjectId?.();
    const threads = await deps.loadThreads(currentProjectId);
    thread = (threads || []).find((entry) => entry?.id === threadId) || null;
  }
  if (!thread) {
    if (typeof deps.showToast === "function") {
      deps.showToast("Thread not found", "error");
    }
    return;
  }

  deps.setCurrentThreadId(threadId);

  const project = await deps.getProject(deps.getCurrentProjectId());
  if (project) {
    deps.setCurrentProjectData(project);
    deps.applyProjectChatSettings(project);
    deps.updateChatModelIndicator(project);
  }

  if (typeof deps.applyChatPanelStateToElements === "function" && typeof deps.buildActiveChatPanelState === "function") {
    deps.applyChatPanelStateToElements(deps.elements, deps.buildActiveChatPanelState());
  }

  deps.renderChatMessages(thread.messages, thread);
  await deps.renderThreadList();
}

async function createProjectThread(deps) {
  const currentProjectId = deps.getCurrentProjectId();
  if (!currentProjectId) return;

  const project = await deps.getProject(currentProjectId);
  if (project) {
    deps.setCurrentProjectData(project);
    deps.applyProjectChatSettings(project);
  }

  const thread = await deps.createThread(currentProjectId);
  await deps.renderThreadList();
  await deps.openThread(thread.id);
  deps.showToast("New thread created", "success");
}

function toggleThreadMenu(button, deps) {
  deps.toggleProjectsDropdownMenu(button, deps.documentRef || document);
}

const projectsThreadControllerUtils = {
  openProjectThread,
  createProjectThread,
  toggleThreadMenu
};

if (typeof window !== "undefined") {
  window.projectsThreadControllerUtils = projectsThreadControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsThreadControllerUtils;
}
