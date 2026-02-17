// projects-render-controller-utils.js - render/list orchestration for Projects UI

function buildMessageHtml(messages, deps = {}) {
  return deps.buildProjectsMessageHtml(messages, {
    escapeHtml: deps.escapeHtml,
    applyMarkdownStyles: deps.applyMarkdownStyles,
    extractSources: deps.extractSources,
    getTokenBarStyle: deps.getTokenBarStyle
  });
}

function postProcessMessages(root, deps = {}) {
  deps.processProjectsAssistantSources(root, {
    makeSourceReferencesClickable: deps.makeSourceReferencesClickable,
    createSourcesIndicator: deps.createSourcesIndicator,
    renderChatSourcesSummary: deps.renderChatSourcesSummary,
    logger: deps.logger
  });

  deps.bindProjectsCopyButtons(root, {
    writeText: (text) => deps.writeClipboardText(text),
    showToast: deps.showToast,
    setTimeoutFn: deps.setTimeoutFn
  });
}

async function renderProjectsList(deps = {}) {
  const projectsRaw = await deps.loadProjects();
  const visibility = deps.getProjectsListVisibilityState(projectsRaw);
  deps.elements.ProjectsGrid.style.display = visibility.gridDisplay;
  deps.elements.emptyState.style.display = visibility.emptyDisplay;
  if (visibility.showEmpty) {
    return;
  }

  const projects = deps.sortProjectsByUpdatedAt(projectsRaw);
  const cardsHtml = await Promise.all(projects.map(async (project) => {
    const modelName = deps.getProjectModelLabel(project);
    const dateStr = deps.formatDate(project.updatedAt);
    return deps.buildProjectCardHtml(project, modelName, dateStr, deps.escapeHtml);
  }));

  deps.elements.ProjectsGrid.innerHTML = cardsHtml.join("");
  const cards = typeof deps.queryProjectCards === "function"
    ? deps.queryProjectCards()
    : document.querySelectorAll(".project-card");

  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      const action = deps.resolveProjectCardClickAction(e.target, card);
      if (action.type === "toggle-menu") {
        e.stopPropagation();
        deps.toggleMenu(action.button);
      } else if (action.type === "edit") {
        e.stopPropagation();
        deps.openEditProjectModal(action.projectId);
      } else if (action.type === "delete") {
        e.stopPropagation();
        deps.openDeleteModal("Project", action.projectId);
      } else if (action.type === "open") {
        deps.openProject(action.projectId);
      }
    });
  });
}

async function renderThreadList(deps = {}) {
  if (!deps.currentProjectId) return;
  const threads = await deps.loadThreads(deps.currentProjectId);
  const threadViewState = deps.getThreadListViewState(threads);
  if (threadViewState.isEmpty) {
    deps.elements.threadList.innerHTML = deps.buildEmptyThreadListHtml();
    return;
  }

  deps.elements.threadList.innerHTML = deps.buildThreadListHtml(
    threadViewState.threads,
    deps.currentThreadId,
    deps.escapeHtml,
    deps.formatRelativeTime
  );

  const items = typeof deps.queryThreadItems === "function"
    ? deps.queryThreadItems()
    : document.querySelectorAll(".thread-item");

  items.forEach((item) => {
    item.addEventListener("click", async (e) => {
      const action = deps.resolveThreadItemClickAction(e.target, item);
      if (action.type === "toggle-menu") {
        e.stopPropagation();
        deps.toggleMenu(action.button);
      } else if (action.type === "rename") {
        e.stopPropagation();
        deps.openRenameModal(action.threadId);
      } else if (action.type === "export") {
        e.stopPropagation();
        deps.exportThread(action.threadId, action.format);
      } else if (action.type === "delete-thread") {
        e.stopPropagation();
        deps.openDeleteModal("thread", action.threadId);
      } else if (action.type === "ignore") {
        e.stopPropagation();
      } else if (action.type === "open") {
        const threadId = action.threadId || item?.dataset?.threadId || null;
        if (threadId) {
          await deps.openThread(threadId);
        }
      }
    });
  });
}

function renderChatMessages(messages, thread = null, deps = {}) {
  const chatMessagesEl = deps.elements.chatMessages || document.getElementById("chat-messages");
  if (!chatMessagesEl) {
    return { archivedMessages: [] };
  }

  if (!messages || messages.length === 0) {
    chatMessagesEl.replaceChildren();
    deps.updateProjectsContextButton(thread, deps.currentProjectData);
    return { archivedMessages: [] };
  }

  const archivedMessages = thread?.archivedMessages || [];
  const summaryUpdatedAt = thread?.summaryUpdatedAt || null;
  const showSummaryBadge = deps.shouldShowSummaryBadge(summaryUpdatedAt, Date.now(), 30000);
  const archiveHtml = deps.buildArchiveSectionHtml(archivedMessages);
  const messagesHtml = buildMessageHtml(messages, deps);
  chatMessagesEl.innerHTML = deps.buildChatMessagesContainerHtml({
    archiveHtml,
    showSummaryBadge,
    messagesHtml
  });
  postProcessMessages(chatMessagesEl, deps);
  deps.hydrateImageCards(chatMessagesEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  deps.updateProjectsContextButton(thread, deps.currentProjectData);
  return { archivedMessages };
}

function toggleArchiveSection(deps = {}) {
  const chatMessagesEl = deps.elements.chatMessages || document.getElementById("chat-messages");
  deps.toggleArchiveSectionInContainer({
    chatMessagesEl,
    currentArchivedMessages: deps.currentArchivedMessages,
    buildMessageHtml: (messages) => buildMessageHtml(messages, deps),
    postProcessMessages: (root) => postProcessMessages(root, deps)
  });
}

const projectsRenderControllerUtils = {
  renderProjectsList,
  renderThreadList,
  renderChatMessages,
  toggleArchiveSection
};

if (typeof window !== "undefined") {
  window.projectsRenderControllerUtils = projectsRenderControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsRenderControllerUtils;
}