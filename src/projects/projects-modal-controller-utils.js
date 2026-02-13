// projects-modal-controller-utils.js - Modal open/close/submit orchestration for Projects

function openCreateProjectModal(deps) {
  const { buildCreateProjectModalViewState, elements, setModalVisibility, setEditingProjectId } = deps;
  const viewState = buildCreateProjectModalViewState();
  setEditingProjectId(null);
  elements.modalTitle.textContent = viewState.title;
  elements.modalSave.textContent = viewState.saveLabel;
  elements.ProjectForm.reset();
  elements.ProjectIcon.value = viewState.icon;
  elements.iconPreview.textContent = viewState.icon;
  elements.emojiGrid.classList.remove("show");
  elements.ProjectWebSearch.checked = viewState.webSearch;
  elements.ProjectReasoning.checked = viewState.reasoning;
  setModalVisibility(elements.ProjectModal, true);
  elements.ProjectName.focus();
}

async function openEditProjectModal(projectId, deps) {
  const {
    getProject,
    buildEditProjectModalViewState,
    currentProvider,
    normalizeProviderSafe,
    buildCombinedModelIdSafe,
    getProjectModelLabel,
    elements,
    setModalVisibility,
    setEditingProjectId
  } = deps;
  const project = await getProject(projectId);
  if (!project) return;
  const viewState = buildEditProjectModalViewState({
    project,
    currentProvider,
    normalizeProvider: normalizeProviderSafe,
    buildCombinedModelId: buildCombinedModelIdSafe,
    getProjectModelLabel
  });

  setEditingProjectId(projectId);
  elements.modalTitle.textContent = viewState.title;
  elements.modalSave.textContent = viewState.saveLabel;
  elements.ProjectName.value = viewState.name;
  elements.ProjectDescription.value = viewState.description;
  elements.ProjectIcon.value = viewState.icon;
  elements.iconPreview.textContent = viewState.icon;
  elements.ProjectModel.value = viewState.modelCombinedId;
  if (elements.ProjectModelInput) {
    elements.ProjectModelInput.value = viewState.modelDisplayName;
  }
  elements.ProjectInstructions.value = viewState.customInstructions;
  elements.ProjectWebSearch.checked = viewState.webSearch;
  elements.ProjectReasoning.checked = viewState.reasoning;
  elements.emojiGrid.classList.remove("show");

  setModalVisibility(elements.ProjectModal, true);
  elements.ProjectName.focus();
}

function closeProjectModal(deps) {
  const { elements, setModalVisibility, setEditingProjectId } = deps;
  setModalVisibility(elements.ProjectModal, false);
  setEditingProjectId(null);
}

async function handleProjectFormSubmit(event, deps) {
  event.preventDefault();
  const {
    elements,
    buildProjectFormData,
    parseCombinedModelIdSafe,
    normalizeProviderSafe,
    buildModelDisplayName,
    showToast,
    getEditingProjectId,
    updateProject,
    currentProjectId,
    setCurrentProjectData,
    updateChatModelIndicator,
    createProject,
    closeProjectModal,
    invalidateStorageUsageCache,
    renderProjectsList,
    renderStorageUsage
  } = deps;

  const data = buildProjectFormData({
    elements,
    parseCombinedModelId: parseCombinedModelIdSafe,
    normalizeProvider: normalizeProviderSafe,
    buildModelDisplayName
  });

  if (!data.name) {
    showToast("Name is required", "error");
    return;
  }

  try {
    const editingProjectId = getEditingProjectId();
    if (editingProjectId) {
      await updateProject(editingProjectId, data);
      showToast("Project updated", "success");
      if (currentProjectId() === editingProjectId) {
        elements.ProjectTitle.textContent = data.name;
        setCurrentProjectData(data);
        updateChatModelIndicator(data);
      }
    } else {
      await createProject(data);
      showToast("Project created", "success");
    }
    closeProjectModal();
    invalidateStorageUsageCache();
    await renderProjectsList();
    await renderStorageUsage();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function openRenameModal(threadId, deps) {
  const { getThread, elements, setRenamingThreadId, setModalVisibility } = deps;
  const thread = await getThread(threadId);
  if (!thread) return;
  setRenamingThreadId(threadId);
  elements.threadTitle.value = thread.title;
  setModalVisibility(elements.renameModal, true);
  elements.threadTitle.focus();
  elements.threadTitle.select();
}

function closeRenameModal(deps) {
  const { elements, setModalVisibility, setRenamingThreadId } = deps;
  setModalVisibility(elements.renameModal, false);
  setRenamingThreadId(null);
}

async function handleRenameFormSubmit(event, deps) {
  event.preventDefault();
  const {
    elements,
    showToast,
    getRenamingThreadId,
    updateThread,
    closeRenameModal,
    renderThreadList
  } = deps;

  const title = elements.threadTitle.value.trim();
  if (!title) {
    showToast("Title is required", "error");
    return;
  }

  try {
    await updateThread(getRenamingThreadId(), { title });
    showToast("Thread renamed", "success");
    closeRenameModal();
    await renderThreadList();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function openDeleteModal(type, id, deps) {
  const {
    setDeletingItem,
    getProject,
    getThreadCount,
    buildProjectDeleteModalContent,
    getThread,
    estimateItemSize,
    buildThreadDeleteModalContent,
    elements,
    setModalVisibility
  } = deps;

  setDeletingItem({ type, id });
  if (type === "Project") {
    const project = await getProject(id);
    const threadCount = await getThreadCount(id);
    const modalContent = buildProjectDeleteModalContent(project.name, threadCount);
    elements.deleteTitle.textContent = modalContent.title;
    elements.deleteMessage.textContent = modalContent.message;
    elements.deleteSize.textContent = modalContent.sizeText;
  } else {
    const thread = await getThread(id);
    const size = await estimateItemSize(thread);
    const modalContent = buildThreadDeleteModalContent(thread.title, size);
    elements.deleteTitle.textContent = modalContent.title;
    elements.deleteMessage.textContent = modalContent.message;
    elements.deleteSize.textContent = modalContent.sizeText;
  }
  setModalVisibility(elements.deleteModal, true);
}

function closeDeleteModal(deps) {
  const { elements, setModalVisibility, setDeletingItem } = deps;
  setModalVisibility(elements.deleteModal, false);
  setDeletingItem(null);
}

async function handleDeleteConfirm(deps) {
  const {
    getDeletingItem,
    deleteProject,
    showToast,
    currentProjectId,
    showView,
    invalidateStorageUsageCache,
    renderProjectsList,
    deleteThread,
    setCurrentThreadId,
    applyChatPanelStateToElements,
    elements,
    buildEmptyChatPanelState,
    renderThreadList,
    closeDeleteModal,
    renderStorageUsage
  } = deps;

  const deletingItem = getDeletingItem();
  if (!deletingItem) return;

  try {
    if (deletingItem.type === "Project") {
      await deleteProject(deletingItem.id);
      showToast("Project deleted", "success");
      if (currentProjectId() === deletingItem.id) {
        showView("list");
      }
      invalidateStorageUsageCache();
      await renderProjectsList();
    } else {
      await deleteThread(deletingItem.id);
      showToast("Thread deleted", "success");
      if (deps.currentThreadId() === deletingItem.id) {
        setCurrentThreadId(null);
        applyChatPanelStateToElements(elements, buildEmptyChatPanelState());
      }
      invalidateStorageUsageCache();
      await renderThreadList();
    }

    closeDeleteModal();
    await renderStorageUsage();
  } catch (err) {
    showToast(err.message, "error");
  }
}

const projectsModalControllerUtils = {
  openCreateProjectModal,
  openEditProjectModal,
  closeProjectModal,
  handleProjectFormSubmit,
  openRenameModal,
  closeRenameModal,
  handleRenameFormSubmit,
  openDeleteModal,
  closeDeleteModal,
  handleDeleteConfirm
};

if (typeof window !== "undefined") {
  window.projectsModalControllerUtils = projectsModalControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsModalControllerUtils;
}
