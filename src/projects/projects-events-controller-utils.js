// projects-events-controller-utils.js - Event and bootstrap orchestration for Projects UI

function setSafeHtml(element, html) {
  if (!element) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.innerHTML = typeof html === "string" ? html : "";
}

function setupEmojiPicker(deps) {
  const { elements, buildEmojiButtonsHtml, PROJECT_EMOJIS, shouldCloseEmojiGridOnDocumentClick } = deps;
  setSafeHtml(elements.emojiGridInner, buildEmojiButtonsHtml(PROJECT_EMOJIS));

  elements.iconPreview.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.emojiGrid.classList.toggle("show");
  });

  elements.emojiGridInner.addEventListener("click", (e) => {
    const btn = e.target.closest(".emoji-btn");
    if (btn) {
      const emoji = btn.dataset.emoji;
      elements.ProjectIcon.value = emoji;
      elements.iconPreview.textContent = emoji;
      elements.emojiGrid.classList.remove("show");
    }
  });

  document.addEventListener("click", (e) => {
    if (shouldCloseEmojiGridOnDocumentClick(e.target)) {
      elements.emojiGrid.classList.remove("show");
    }
  });
}

function bindEvents(deps) {
  const {
    elements,
    openCreateProjectModal,
    openOptionsPage,
    closeProjectModal,
    handleProjectFormSubmit,
    closeRenameModal,
    handleRenameFormSubmit,
    closeDeleteModal,
    handleDeleteConfirm,
    hideStorageWarning,
    showView,
    renderProjectsList,
    currentProjectId,
    openEditProjectModal,
    createNewThread,
    imageModeState,
    getImageModeEnabled,
    setImageModeEnabled,
    getThread,
    currentThreadId,
    currentProjectData,
    getProject,
    setCurrentProjectData,
    openProjectsContextModal,
    resolveChatMessageClickAction,
    toggleArchiveSection,
    toggleProjectsExportMenu,
    exportCurrentThread,
    closeExportMenus,
    shouldCloseModalOnBackdropClick,
    setModalVisibility,
    isEscapeCloseEvent
  } = deps;

  elements.createProjectBtn.addEventListener("click", openCreateProjectModal);
  elements.emptyCreateBtn.addEventListener("click", openCreateProjectModal);

  if (elements.ProjectsSettingsBtn) {
    elements.ProjectsSettingsBtn.addEventListener("click", openOptionsPage);
    elements.ProjectsSettingsBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openOptionsPage();
      }
    });
  }

  elements.modalClose.addEventListener("click", closeProjectModal);
  elements.modalCancel.addEventListener("click", closeProjectModal);
  elements.ProjectForm.addEventListener("submit", handleProjectFormSubmit);

  elements.renameModalClose.addEventListener("click", closeRenameModal);
  elements.renameCancel.addEventListener("click", closeRenameModal);
  elements.renameForm.addEventListener("submit", handleRenameFormSubmit);

  elements.deleteModalClose.addEventListener("click", closeDeleteModal);
  elements.deleteCancel.addEventListener("click", closeDeleteModal);
  elements.deleteConfirm.addEventListener("click", handleDeleteConfirm);

  elements.warningClose.addEventListener("click", hideStorageWarning);

  elements.backBtn.addEventListener("click", async () => {
    showView("list");
    await renderProjectsList();
  });

  elements.ProjectSettingsBtn.addEventListener("click", () => {
    if (currentProjectId()) {
      openEditProjectModal(currentProjectId());
    }
  });

  elements.newThreadBtn.addEventListener("click", createNewThread);

  if (elements.chatImageMode) {
    elements.chatImageMode.addEventListener("change", () => {
      if (elements.chatImageMode.disabled) {
        elements.chatImageMode.checked = getImageModeEnabled();
        return;
      }
      setImageModeEnabled(elements.chatImageMode.checked);
      imageModeState.changed = true;
    });
  }

  if (elements.ProjectsContextBtn) {
    elements.ProjectsContextBtn.addEventListener("click", async () => {
      if (elements.ProjectsContextBtn.classList.contains("inactive")) return;
      if (!currentThreadId() || !currentProjectId()) return;
      const thread = await getThread(currentThreadId());
      const project = currentProjectData() || await getProject(currentProjectId());
      setCurrentProjectData(project || currentProjectData());
      openProjectsContextModal(thread, currentProjectData());
    });
  }

  elements.chatMessages.addEventListener("click", async (e) => {
    const action = resolveChatMessageClickAction(e.target);
    if (action.type === "archive-toggle") {
      e.preventDefault();
      e.stopPropagation();
      toggleArchiveSection();
      return;
    }
    if (action.type === "export-menu-toggle") {
      e.preventDefault();
      e.stopPropagation();
      toggleProjectsExportMenu(e.target.closest(".export-btn"), document);
      return;
    }
    if (action.type === "export-option") {
      e.preventDefault();
      e.stopPropagation();
      await exportCurrentThread(action.format);
      closeExportMenus();
    }
  });

  [elements.ProjectModal, elements.renameModal, elements.deleteModal].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (shouldCloseModalOnBackdropClick(e, modal)) {
        setModalVisibility(modal, false);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (isEscapeCloseEvent(e)) {
      closeProjectModal();
      closeRenameModal();
      closeDeleteModal();
    }
  });
}

function setupChatInput(deps) {
  const { elements, sendMessage, stopStreaming } = deps;
  elements.chatInput.addEventListener("input", () => {
    elements.chatInput.style.height = "auto";
    elements.chatInput.style.height = `${Math.min(elements.chatInput.scrollHeight, 200)}px`;
  });

  elements.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  elements.sendBtn.addEventListener("click", sendMessage);
  elements.stopBtn.addEventListener("click", stopStreaming);
}

async function initProjectsApp(deps) {
  const {
    initElements,
    bindEvents,
    setupChatInput,
    setupEmojiPicker,
    initTheme,
    cleanupImageCache,
    loadProviderSetting,
    loadModels,
    renderProjectsList,
    renderStorageUsage,
    showView
  } = deps;

  initElements();
  bindEvents();
  setupChatInput();
  setupEmojiPicker();

  if (typeof initTheme === "function") {
    initTheme();
  }
  if (typeof cleanupImageCache === "function") {
    cleanupImageCache().catch((e) => {
      console.warn("Failed to cleanup image cache:", e);
    });
  }

  await loadProviderSetting();
  await loadModels();
  await renderProjectsList();
  await renderStorageUsage();
  showView("list");
}

const projectsEventsControllerUtils = {
  setupEmojiPicker,
  bindEvents,
  setupChatInput,
  initProjectsApp
};

if (typeof window !== "undefined") {
  window.projectsEventsControllerUtils = projectsEventsControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsEventsControllerUtils;
}
