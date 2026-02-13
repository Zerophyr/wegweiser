// projects-elements-utils.js - Centralized DOM element lookup for Projects UI

function collectProjectsElements(doc) {
  const d = doc || document;
  return {
    ProjectsListView: d.getElementById("projects-list-view"),
    ProjectView: d.getElementById("project-view"),

    ProjectsGrid: d.getElementById("projects-grid"),
    emptyState: d.getElementById("empty-state"),
    createProjectBtn: d.getElementById("create-project-btn"),
    ProjectsSettingsBtn: d.getElementById("projects-settings-btn"),
    emptyCreateBtn: d.getElementById("empty-create-btn"),
    storageFooter: d.getElementById("storage-footer"),
    storageFillImages: d.getElementById("storage-fill-images"),
    storageTextImages: d.getElementById("storage-text-images"),
    storageWarning: d.getElementById("storage-warning"),
    warningMessage: d.getElementById("warning-message"),
    warningClose: d.getElementById("warning-close"),

    backBtn: d.getElementById("back-btn"),
    ProjectTitle: d.getElementById("project-title"),
    ProjectSettingsBtn: d.getElementById("project-settings-btn"),
    newThreadBtn: d.getElementById("new-thread-btn"),
    threadList: d.getElementById("thread-list"),
    chatEmptyState: d.getElementById("chat-empty-state"),
    chatContainer: d.getElementById("chat-container"),
    chatMessages: d.getElementById("chat-messages"),
    chatInput: d.getElementById("chat-input"),
    chatInputContainer: d.getElementById("chat-input-container"),
    sendBtn: d.getElementById("send-btn"),
    stopBtn: d.getElementById("stop-btn"),
    chatModelIndicator: d.getElementById("chat-model-indicator"),
    ProjectsContextBtn: d.getElementById("projects-context-btn"),
    ProjectsContextBadge: d.querySelector(".projects-context-badge"),
    chatWebSearch: d.getElementById("chat-web-search"),
    chatReasoning: d.getElementById("chat-reasoning"),
    chatImageMode: d.getElementById("chat-image-mode"),

    ProjectModal: d.getElementById("project-modal"),
    modalTitle: d.getElementById("modal-title"),
    modalClose: d.getElementById("modal-close"),
    ProjectForm: d.getElementById("project-form"),
    ProjectName: d.getElementById("project-name"),
    ProjectDescription: d.getElementById("project-description"),
    ProjectModel: d.getElementById("project-model"),
    ProjectModelInput: d.getElementById("project-model-input"),
    ProjectInstructions: d.getElementById("project-instructions"),
    ProjectIcon: d.getElementById("project-icon"),
    iconPreview: d.getElementById("icon-preview"),
    emojiGrid: d.getElementById("emoji-grid"),
    emojiGridInner: d.getElementById("emoji-grid-inner"),
    ProjectWebSearch: d.getElementById("project-web-search"),
    ProjectReasoning: d.getElementById("project-reasoning"),
    modalCancel: d.getElementById("modal-cancel"),
    modalSave: d.getElementById("modal-save"),

    renameModal: d.getElementById("rename-modal"),
    renameModalClose: d.getElementById("rename-modal-close"),
    renameForm: d.getElementById("rename-form"),
    threadTitle: d.getElementById("thread-title"),
    renameCancel: d.getElementById("rename-cancel"),

    deleteModal: d.getElementById("delete-modal"),
    deleteTitle: d.getElementById("delete-title"),
    deleteModalClose: d.getElementById("delete-modal-close"),
    deleteMessage: d.getElementById("delete-message"),
    deleteSize: d.getElementById("delete-size"),
    deleteCancel: d.getElementById("delete-cancel"),
    deleteConfirm: d.getElementById("delete-confirm")
  };
}

const projectsElementsUtils = {
  collectProjectsElements
};

if (typeof window !== "undefined") {
  window.projectsElementsUtils = projectsElementsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsElementsUtils;
}
