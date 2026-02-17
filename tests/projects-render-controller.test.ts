export {};

const {
  renderProjectsList,
  renderThreadList,
  renderChatMessages,
  toggleArchiveSection
} = require("../src/projects/projects-render-controller-utils.js");

describe("projects-render-controller-utils", () => {
  test("renderProjectsList renders cards and opens a project on click", async () => {
    document.body.innerHTML = '<div class="project-card" data-project-id="p1"></div>';
    const ProjectsGrid = document.createElement("div");
    const emptyState = document.createElement("div");
    const openProject = jest.fn();

    await renderProjectsList({
      loadProjects: jest.fn().mockResolvedValue([{ id: "p1", updatedAt: Date.now() }]),
      getProjectsListVisibilityState: () => ({ gridDisplay: "grid", emptyDisplay: "none", showEmpty: false }),
      sortProjectsByUpdatedAt: (items: any[]) => items,
      elements: { ProjectsGrid, emptyState },
      getProjectModelLabel: () => "Model",
      formatDate: () => "Today",
      buildProjectCardHtml: async () => '<div class="project-card" data-project-id="p1"></div>',
      escapeHtml: (value: string) => value,
      resolveProjectCardClickAction: () => ({ type: "open", projectId: "p1" }),
      toggleMenu: jest.fn(),
      openEditProjectModal: jest.fn(),
      openDeleteModal: jest.fn(),
      openProject,
      queryProjectCards: () => document.querySelectorAll(".project-card")
    });

    const card = document.querySelector(".project-card") as HTMLElement;
    card.click();
    expect(openProject).toHaveBeenCalledWith("p1");
  });

  test("renderThreadList handles empty and open actions", async () => {
    const threadList = document.createElement("div");

    await renderThreadList({
      currentProjectId: "p1",
      loadThreads: jest.fn().mockResolvedValue([]),
      getThreadListViewState: () => ({ isEmpty: true }),
      elements: { threadList },
      buildEmptyThreadListHtml: () => "<div>Empty</div>",
      buildThreadListHtml: jest.fn(),
      currentThreadId: null,
      escapeHtml: (value: string) => value,
      formatRelativeTime: () => "now",
      resolveThreadItemClickAction: jest.fn(),
      toggleMenu: jest.fn(),
      openRenameModal: jest.fn(),
      exportThread: jest.fn(),
      openDeleteModal: jest.fn(),
      openThread: jest.fn(),
      queryThreadItems: () => []
    });

    expect(threadList.innerHTML).toContain("Empty");

    document.body.innerHTML = '<div class="thread-item" data-thread-id="t1"></div>';
    const openThread = jest.fn().mockResolvedValue(undefined);

    await renderThreadList({
      currentProjectId: "p1",
      loadThreads: jest.fn().mockResolvedValue([{ id: "t1" }]),
      getThreadListViewState: () => ({ isEmpty: false, threads: [{ id: "t1" }] }),
      elements: { threadList },
      buildEmptyThreadListHtml: () => "<div>Empty</div>",
      buildThreadListHtml: () => '<div class="thread-item" data-thread-id="t1"></div>',
      currentThreadId: null,
      escapeHtml: (value: string) => value,
      formatRelativeTime: () => "now",
      resolveThreadItemClickAction: () => ({ type: "open", threadId: "t1" }),
      toggleMenu: jest.fn(),
      openRenameModal: jest.fn(),
      exportThread: jest.fn(),
      openDeleteModal: jest.fn(),
      openThread,
      queryThreadItems: () => document.querySelectorAll(".thread-item")
    });

    (document.querySelector(".thread-item") as HTMLElement).click();
    await Promise.resolve();
    expect(openThread).toHaveBeenCalledWith("t1");
  });

  test("renderChatMessages and toggleArchiveSection use provided dependencies", () => {
    const chatMessages = document.createElement("div");
    const updateProjectsContextButton = jest.fn();
    const resultEmpty = renderChatMessages([], null, {
      elements: { chatMessages },
      currentProjectData: null,
      updateProjectsContextButton,
      shouldShowSummaryBadge: jest.fn(),
      buildArchiveSectionHtml: jest.fn(),
      buildChatMessagesContainerHtml: jest.fn(),
      buildProjectsMessageHtml: jest.fn(),
      escapeHtml: jest.fn(),
      applyMarkdownStyles: jest.fn(),
      extractSources: jest.fn(),
      getTokenBarStyle: jest.fn(),
      processProjectsAssistantSources: jest.fn(),
      makeSourceReferencesClickable: jest.fn(),
      createSourcesIndicator: jest.fn(),
      renderChatSourcesSummary: jest.fn(),
      bindProjectsCopyButtons: jest.fn(),
      writeClipboardText: jest.fn(),
      showToast: jest.fn(),
      setTimeoutFn: setTimeout,
      logger: console,
      hydrateImageCards: jest.fn()
    });

    expect(resultEmpty.archivedMessages).toEqual([]);
    expect(updateProjectsContextButton).toHaveBeenCalled();

    const toggleArchiveSectionInContainer = jest.fn();
    toggleArchiveSection({
      elements: { chatMessages },
      currentArchivedMessages: [{ role: "user", content: "a" }],
      toggleArchiveSectionInContainer,
      buildProjectsMessageHtml: (msgs: any[]) => msgs.map((m) => m.content).join(""),
      escapeHtml: (value: string) => value,
      applyMarkdownStyles: (value: string) => value,
      extractSources: null,
      getTokenBarStyle: null,
      processProjectsAssistantSources: jest.fn(),
      makeSourceReferencesClickable: null,
      createSourcesIndicator: null,
      renderChatSourcesSummary: jest.fn(),
      bindProjectsCopyButtons: jest.fn(),
      writeClipboardText: jest.fn(),
      showToast: jest.fn(),
      setTimeoutFn: setTimeout,
      logger: console
    });

    expect(toggleArchiveSectionInContainer).toHaveBeenCalled();
  });
});