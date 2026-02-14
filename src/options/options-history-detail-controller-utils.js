// options-history-detail-controller-utils.js - history detail panel rendering/actions

function showOptionsHistoryDetail(item, deps) {
  const {
    setHtmlSafely,
    escapeHtml,
    getCurrentHistory,
    setCurrentHistory,
    getPendingDeleteItem,
    setPendingDeleteItem,
    getLocalStorage,
    setLocalStorage,
    loadPromptHistory,
    showToast,
    toastApi
  } = deps;

  const previewColumn = document.getElementById("history-preview-column");
  const detailContent = document.getElementById("history-detail-content");
  if (!previewColumn || !detailContent) return;

  const ts = new Date(item.createdAt).toLocaleString();
  const historyViewUtils = (typeof window !== "undefined" && window.optionsHistoryViewUtils) || {};
  const buildDetail = historyViewUtils.buildHistoryDetailHtml || ((entry, timestamp, escapeFn) => `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 12px;">${timestamp}</div>
      <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 600;">Prompt</div>
      <div style="font-size: 13px; color: var(--color-text); margin-bottom: 16px; white-space: pre-wrap; background: var(--color-bg); padding: 16px; border-radius: 8px; line-height: 1.6;">${escapeFn(entry.prompt)}</div>
      <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 600;">Answer</div>
      <div style="font-size: 13px; color: var(--color-text); margin-bottom: 20px; white-space: pre-wrap; background: var(--color-bg); padding: 16px; border-radius: 8px; line-height: 1.6; max-height: 400px; overflow-y: auto;">${escapeFn(entry.answer || "No answer available")}</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="detail-copy-prompt-btn" style="padding: 8px 16px; background: var(--color-primary); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Prompt</button>
        <button class="detail-copy-answer-btn" style="padding: 8px 16px; background: var(--color-accent); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Answer</button>
        <button class="detail-delete-btn" style="padding: 8px 16px; background: var(--color-error); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Delete</button>
      </div>
    </div>
  `);

  setHtmlSafely(detailContent, buildDetail(item, ts, escapeHtml));
  previewColumn.classList.add("active");

  const copyPromptBtn = detailContent.querySelector(".detail-copy-prompt-btn");
  const copyAnswerBtn = detailContent.querySelector(".detail-copy-answer-btn");
  const deleteBtn = detailContent.querySelector(".detail-delete-btn");

  if (copyPromptBtn) {
    copyPromptBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.prompt);
        copyPromptBtn.textContent = "Copied!";
        setTimeout(() => {
          copyPromptBtn.textContent = "Copy Prompt";
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  }

  if (copyAnswerBtn) {
    copyAnswerBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.answer || "");
        copyAnswerBtn.textContent = "Copied!";
        setTimeout(() => {
          copyAnswerBtn.textContent = "Copy Answer";
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  }

  async function commitDeleteHistoryItem(id) {
    try {
      const res = await getLocalStorage(["or_history"]);
      const history = res.or_history || [];
      const filtered = history.filter((entry) => entry.id !== id);
      await setLocalStorage({ or_history: filtered });
      setCurrentHistory(filtered);
    } catch (e) {
      console.error("Error deleting history item:", e);
    }
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const pendingDeleteItem = getPendingDeleteItem();
      if (pendingDeleteItem) {
        clearTimeout(pendingDeleteItem.timeout);
        await commitDeleteHistoryItem(pendingDeleteItem.item.id);
        setPendingDeleteItem(null);
      }

      const itemToDelete = item;
      const itemEl = document.querySelector(`.history-item[data-item-id="${item.id}"]`);
      if (itemEl) {
        itemEl.remove();
      }

      previewColumn.classList.remove("active");

      showToast("Prompt deleted", "info", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const pending = getPendingDeleteItem();
            if (pending) {
              clearTimeout(pending.timeout);
              setPendingDeleteItem(null);
            }
            await loadPromptHistory();
            toastApi.success("Prompt restored");
          }
        }
      });

      setPendingDeleteItem({
        item: itemToDelete,
        timeout: setTimeout(async () => {
          await commitDeleteHistoryItem(itemToDelete.id);
          setPendingDeleteItem(null);
        }, 5000)
      });
    });
  }
}

const optionsHistoryDetailControllerUtils = {
  showOptionsHistoryDetail
};

if (typeof window !== "undefined") {
  window.optionsHistoryDetailControllerUtils = optionsHistoryDetailControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsHistoryDetailControllerUtils;
}
