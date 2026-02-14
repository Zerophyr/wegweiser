// options-history-controller-utils.js - history delete/undo orchestration for Options page

function clearElementChildren(element) {
  if (!element) return;
  element.replaceChildren();
}

async function clearAllHistory(deps) {
  if (!deps) return;
  const history = deps.getCurrentHistory();
  if (!Array.isArray(history) || history.length === 0) {
    deps.toast?.info("History is already empty");
    return;
  }

  const pendingDelete = deps.getPendingDeleteItem();
  if (pendingDelete) {
    clearTimeout(pendingDelete.timeout);
    await deps.commitDeleteHistoryItem(pendingDelete.item.id);
    deps.setPendingDeleteItem(null);
  }

  const pendingClear = deps.getPendingClearAllHistory();
  if (pendingClear) {
    clearTimeout(pendingClear.timeout);
  }

  const itemsToDelete = [...history];
  const itemCount = itemsToDelete.length;

  clearElementChildren(deps.promptHistoryEl);

  const previewColumn = deps.getPreviewColumn?.();
  if (previewColumn) {
    previewColumn.classList.remove("active");
  }

  deps.showToast(`${itemCount} items deleted`, "info", {
    duration: 5000,
    action: {
      label: "Undo",
      onClick: async () => {
        const clearState = deps.getPendingClearAllHistory();
        if (clearState) {
          clearTimeout(clearState.timeout);
          deps.setPendingClearAllHistory(null);
        }
        await deps.loadPromptHistory();
        deps.toast?.success("History restored");
      }
    }
  });

  const timeout = setTimeout(async () => {
    try {
      await deps.setLocalStorage({ or_history: [] });
      deps.setCurrentHistory([]);
    } catch (e) {
      deps.logError?.("Error clearing history:", e);
    }
    deps.setPendingClearAllHistory(null);
  }, 5000);

  deps.setPendingClearAllHistory({ items: itemsToDelete, timeout });
}

const optionsHistoryControllerUtils = {
  clearAllHistory
};

if (typeof window !== "undefined") {
  window.optionsHistoryControllerUtils = optionsHistoryControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsHistoryControllerUtils;
}