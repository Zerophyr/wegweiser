// sidepanel-events-controller-utils.js - sidepanel event wiring helpers

function registerAnswerEventHandlers(deps) {
  const {
    answerEl,
    closeExportMenus,
    exportAnswer,
    copyFeedbackDuration,
    showToast,
    openLinkInTab
  } = deps;

  if (!answerEl) return;

  answerEl.addEventListener("click", (e) => {
    const target = e.target;

    const copyBtn = target.closest(".copy-answer-btn");
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const answerItem = copyBtn.closest(".answer-item");
      if (answerItem) {
        const answerContent = answerItem.querySelector(".answer-content");
        if (answerContent) {
          const text = answerContent.innerText || answerContent.textContent;
          if (!navigator.clipboard || !navigator.clipboard.writeText) {
            showToast("Clipboard not supported in this browser", "error");
            return;
          }
          navigator.clipboard.writeText(text).then(() => {
            const originalColor = copyBtn.style.color;
            copyBtn.style.color = "var(--color-success)";
            copyBtn.setAttribute("aria-label", "Copied to clipboard");
            setTimeout(() => {
              copyBtn.style.color = originalColor;
              copyBtn.setAttribute("aria-label", "Copy answer to clipboard");
            }, copyFeedbackDuration);
            showToast("Answer copied to clipboard", "success");
          }).catch((err) => {
            if (err.name === "NotAllowedError") {
              showToast("Permission denied. Please allow clipboard access.", "error");
            } else if (err.name === "SecurityError") {
              showToast("Cannot copy from insecure context", "error");
            } else {
              showToast("Failed to copy to clipboard", "error");
            }
          });
        }
      }
      return;
    }

    const exportBtn = target.closest(".export-btn");
    if (exportBtn) {
      e.preventDefault();
      e.stopPropagation();
      const menu = exportBtn.closest(".export-menu");
      if (menu) {
        const isOpen = menu.classList.contains("open");
        closeExportMenus();
        if (!isOpen) {
          menu.classList.add("open");
        }
      }
      return;
    }

    const exportOption = target.closest(".export-option");
    if (exportOption) {
      e.preventDefault();
      e.stopPropagation();
      const format = exportOption.getAttribute("data-format");
      const answerItem = exportOption.closest(".answer-item");
      exportAnswer(answerItem, format);
      closeExportMenus();
      return;
    }

    if (target && target.tagName === "A") {
      e.preventDefault();
      const href = target.getAttribute("href");
      if (href) {
        openLinkInTab(href);
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".export-menu")) {
      closeExportMenus();
    }
  });
}

function registerPromptEventHandlers(deps) {
  const {
    promptEl,
    askQuestion,
    autoResizeTextarea,
    debouncedTokenEstimation
  } = deps;

  if (!promptEl) return;

  promptEl.addEventListener("input", () => {
    autoResizeTextarea();
    debouncedTokenEstimation();
  });

  promptEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      askQuestion();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  });
}

function registerGlobalShortcutHandlers(deps) {
  const {
    promptEl,
    metaEl,
    findClearButton
  } = deps;

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      const clearBtn = findClearButton();
      if (clearBtn && clearBtn.style.display !== "none") {
        clearBtn.click();
      }
    }

    if (e.key === "Escape") {
      promptEl.focus();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      metaEl.textContent = "Shortcuts: Enter=Send | Shift+Enter=New Line | Ctrl+K=Clear | Esc=Focus Input";
      setTimeout(() => {
        metaEl.textContent = "";
      }, 5000);
    }
  });
}

function registerProjectsButtonHandlers(deps) {
  const {
    projectsBtn,
    getLocalStorage,
    closeSidepanel,
    getProjectsUrl,
    queryTabsByUrl,
    focusExistingTab,
    openNewTab
  } = deps;

  if (!projectsBtn) return;

  const openProjectsPage = async () => {
    const stored = await getLocalStorage(["or_collapse_on_projects"]);
    const collapseOnProjects = stored.or_collapse_on_projects !== false;
    const projectsUrl = getProjectsUrl();
    const tabs = await queryTabsByUrl(projectsUrl);

    if (tabs.length > 0) {
      await focusExistingTab(tabs[0]);
    } else {
      await openNewTab(projectsUrl);
    }

    if (collapseOnProjects) {
      await closeSidepanel();
    }
  };

  projectsBtn.addEventListener("click", openProjectsPage);
  projectsBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProjectsPage();
    }
  });
}

function registerClearAnswerHandler(deps) {
  const {
    clearAnswerBtn,
    answerEl,
    clearAnswerHtml,
    updateAnswerVisibility,
    setAnswerHtml,
    metaEl,
    scheduleAnswerPersist,
    showToast,
    clearContext,
    refreshContextVisualization
  } = deps;

  if (!clearAnswerBtn) return;

  let pendingClearTimeout = null;
  let savedAnswersHtml = null;

  clearAnswerBtn.addEventListener("click", async () => {
    savedAnswersHtml = answerEl.innerHTML;

    clearAnswerHtml();
    updateAnswerVisibility();
    metaEl.textContent = "Answers cleared.";
    scheduleAnswerPersist();

    if (pendingClearTimeout) {
      clearTimeout(pendingClearTimeout);
    }

    showToast("Conversation cleared", "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          if (pendingClearTimeout) {
            clearTimeout(pendingClearTimeout);
            pendingClearTimeout = null;
          }
          if (savedAnswersHtml) {
            setAnswerHtml(savedAnswersHtml);
            updateAnswerVisibility();
            metaEl.textContent = "Answers restored.";
            savedAnswersHtml = null;
            scheduleAnswerPersist();
          }
        }
      }
    });

    pendingClearTimeout = setTimeout(async () => {
      pendingClearTimeout = null;
      savedAnswersHtml = null;
      await clearContext();
      refreshContextVisualization();
    }, 5000);
  });
}

const sidepanelEventsControllerUtils = {
  registerAnswerEventHandlers,
  registerPromptEventHandlers,
  registerGlobalShortcutHandlers,
  registerProjectsButtonHandlers,
  registerClearAnswerHandler
};

if (typeof window !== "undefined") {
  window.sidepanelEventsControllerUtils = sidepanelEventsControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelEventsControllerUtils;
}
