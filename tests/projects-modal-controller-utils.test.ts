export {};

const {
  openCreateProjectModal,
  handleProjectFormSubmit,
  openDeleteModal
} = require("../src/projects/projects-modal-controller-utils.js");

describe("projects-modal-controller-utils", () => {
  test("openCreateProjectModal resets modal fields and focuses name", () => {
    const projectName = document.createElement("input");
    projectName.focus = jest.fn();
    const elements = {
      modalTitle: document.createElement("h2"),
      modalSave: document.createElement("button"),
      ProjectForm: document.createElement("form"),
      ProjectIcon: document.createElement("input"),
      iconPreview: document.createElement("div"),
      emojiGrid: document.createElement("div"),
      ProjectWebSearch: Object.assign(document.createElement("input"), { type: "checkbox" }),
      ProjectReasoning: Object.assign(document.createElement("input"), { type: "checkbox" }),
      ProjectModal: document.createElement("div"),
      ProjectName: projectName
    };
    const setModalVisibility = jest.fn();

    openCreateProjectModal({
      buildCreateProjectModalViewState: () => ({
        title: "Create Project",
        saveLabel: "Create",
        icon: "📁",
        webSearch: true,
        reasoning: false
      }),
      elements,
      setModalVisibility,
      setEditingProjectId: jest.fn()
    });

    expect(elements.modalTitle.textContent).toBe("Create Project");
    expect(elements.modalSave.textContent).toBe("Create");
    expect(elements.ProjectIcon.value).toBe("📁");
    expect(elements.iconPreview.textContent).toBe("📁");
    expect(elements.ProjectWebSearch.checked).toBe(true);
    expect(elements.ProjectReasoning.checked).toBe(false);
    expect(setModalVisibility).toHaveBeenCalledWith(elements.ProjectModal, true);
    expect(projectName.focus).toHaveBeenCalled();
  });

  test("handleProjectFormSubmit validates empty name", async () => {
    const showToast = jest.fn();
    const event = { preventDefault: jest.fn() };

    await handleProjectFormSubmit(event, {
      elements: {},
      buildProjectFormData: () => ({ name: "" }),
      parseCombinedModelIdSafe: jest.fn(),
      normalizeProviderSafe: jest.fn(),
      buildModelDisplayName: jest.fn(),
      showToast,
      getEditingProjectId: () => null,
      updateProject: jest.fn(),
      currentProjectId: () => null,
      setCurrentProjectData: jest.fn(),
      updateChatModelIndicator: jest.fn(),
      createProject: jest.fn(),
      closeProjectModal: jest.fn(),
      invalidateStorageUsageCache: jest.fn(),
      renderProjectsList: jest.fn(),
      renderStorageUsage: jest.fn()
    });

    expect(showToast).toHaveBeenCalledWith("Name is required", "error");
  });

  test("openDeleteModal fills project delete copy", async () => {
    const elements = {
      deleteTitle: document.createElement("h3"),
      deleteMessage: document.createElement("p"),
      deleteSize: document.createElement("span"),
      deleteModal: document.createElement("div")
    };
    const setModalVisibility = jest.fn();

    await openDeleteModal("Project", "p1", {
      setDeletingItem: jest.fn(),
      getProject: jest.fn().mockResolvedValue({ name: "My Project" }),
      getThreadCount: jest.fn().mockResolvedValue(3),
      buildProjectDeleteModalContent: (name: string, count: number) => ({
        title: `Delete ${name}`,
        message: `${count} threads`,
        sizeText: "12 KB"
      }),
      getThread: jest.fn(),
      estimateItemSize: jest.fn(),
      buildThreadDeleteModalContent: jest.fn(),
      elements,
      setModalVisibility
    });

    expect(elements.deleteTitle.textContent).toBe("Delete My Project");
    expect(elements.deleteMessage.textContent).toBe("3 threads");
    expect(elements.deleteSize.textContent).toBe("12 KB");
    expect(setModalVisibility).toHaveBeenCalledWith(elements.deleteModal, true);
  });
});
