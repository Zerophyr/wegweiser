export {};

const {
  setupChatInput,
  bindEvents,
  initProjectsApp
} = require("../src/projects/projects-events-controller-utils.js");

function createCoreElements() {
  const createButton = () => document.createElement("button");
  const createDiv = () => document.createElement("div");
  const createForm = () => document.createElement("form");

  const chatInput = document.createElement("textarea");
  const stopBtn = createButton();
  const sendBtn = createButton();

  return {
    createProjectBtn: createButton(),
    emptyCreateBtn: createButton(),
    ProjectsSettingsBtn: createButton(),
    modalClose: createButton(),
    modalCancel: createButton(),
    ProjectForm: createForm(),
    renameModalClose: createButton(),
    renameCancel: createButton(),
    renameForm: createForm(),
    deleteModalClose: createButton(),
    deleteCancel: createButton(),
    deleteConfirm: createButton(),
    warningClose: createButton(),
    backBtn: createButton(),
    ProjectSettingsBtn: createButton(),
    newThreadBtn: createButton(),
    chatImageMode: Object.assign(document.createElement("input"), { type: "checkbox" }),
    ProjectsContextBtn: createButton(),
    ProjectsContextBadge: createDiv(),
    chatMessages: createDiv(),
    ProjectModal: createDiv(),
    renameModal: createDiv(),
    deleteModal: createDiv(),
    emojiGridInner: createDiv(),
    iconPreview: createDiv(),
    emojiGrid: createDiv(),
    chatInput,
    sendBtn,
    stopBtn
  };
}

describe("projects-events-controller-utils", () => {
  test("setupChatInput sends on Enter and calls stop handler", () => {
    const elements = createCoreElements();
    const sendMessage = jest.fn();
    const stopStreaming = jest.fn();

    setupChatInput({ elements, sendMessage, stopStreaming });

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    elements.chatInput.dispatchEvent(enter);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    const shiftEnter = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true });
    elements.chatInput.dispatchEvent(shiftEnter);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    elements.stopBtn.click();
    expect(stopStreaming).toHaveBeenCalledTimes(1);
  });

  test("bindEvents wires settings keyboard trigger and image toggle guard", () => {
    const elements = createCoreElements();
    const openOptionsPage = jest.fn();
    const setImageModeEnabled = jest.fn();

    bindEvents({
      elements,
      openCreateProjectModal: jest.fn(),
      openOptionsPage,
      closeProjectModal: jest.fn(),
      handleProjectFormSubmit: jest.fn(),
      closeRenameModal: jest.fn(),
      handleRenameFormSubmit: jest.fn(),
      closeDeleteModal: jest.fn(),
      handleDeleteConfirm: jest.fn(),
      hideStorageWarning: jest.fn(),
      showView: jest.fn(),
      renderProjectsList: jest.fn(),
      currentProjectId: () => "p1",
      openEditProjectModal: jest.fn(),
      createNewThread: jest.fn(),
      imageModeState: { changed: false },
      getImageModeEnabled: () => true,
      setImageModeEnabled,
      getThread: jest.fn(),
      currentThreadId: () => "t1",
      currentProjectData: () => ({ id: "p1" }),
      getProject: jest.fn(),
      setCurrentProjectData: jest.fn(),
      openProjectsContextModal: jest.fn(),
      resolveChatMessageClickAction: () => ({ type: "none" }),
      toggleArchiveSection: jest.fn(),
      toggleProjectsExportMenu: jest.fn(),
      exportCurrentThread: jest.fn(),
      closeExportMenus: jest.fn(),
      shouldCloseModalOnBackdropClick: () => false,
      setModalVisibility: jest.fn(),
      isEscapeCloseEvent: () => false
    });

    elements.ProjectsSettingsBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(openOptionsPage).toHaveBeenCalledTimes(1);

    elements.chatImageMode.disabled = true;
    elements.chatImageMode.checked = false;
    elements.chatImageMode.dispatchEvent(new Event("change", { bubbles: true }));
    expect(elements.chatImageMode.checked).toBe(true);
    expect(setImageModeEnabled).not.toHaveBeenCalled();
  });

  test("initProjectsApp runs bootstrap sequence and view switch", async () => {
    const calls: string[] = [];

    await initProjectsApp({
      initElements: () => calls.push("initElements"),
      bindEvents: () => calls.push("bindEvents"),
      setupChatInput: () => calls.push("setupChatInput"),
      setupEmojiPicker: () => calls.push("setupEmojiPicker"),
      initTheme: () => calls.push("initTheme"),
      cleanupImageCache: async () => calls.push("cleanupImageCache"),
      loadProviderSetting: async () => calls.push("loadProviderSetting"),
      loadModels: async () => calls.push("loadModels"),
      renderProjectsList: async () => calls.push("renderProjectsList"),
      renderStorageUsage: async () => calls.push("renderStorageUsage"),
      showView: (view: string) => calls.push(`showView:${view}`)
    });

    expect(calls).toEqual([
      "initElements",
      "bindEvents",
      "setupChatInput",
      "setupEmojiPicker",
      "initTheme",
      "cleanupImageCache",
      "loadProviderSetting",
      "loadModels",
      "renderProjectsList",
      "renderStorageUsage",
      "showView:list"
    ]);
  });
});
