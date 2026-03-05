// options-history-render-controller-utils.js - prompt history list/detail rendering helpers

function defaultNormalizeHistoryEntry(entry) {
  return {
    ...entry,
    promptText: String(entry?.prompt || ""),
    answerText: String(entry?.answer || "")
  };
}

function defaultBuildPreviewSnippet(text, maxLen = 80) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}...`;
}

function buildHistoryPreviewHtml(entry, timestamp, escapeFn, snippetFn) {
  const promptPreview = snippetFn(entry.promptText || entry.prompt || "", 80);
  const answerPreview = snippetFn(entry.answerText || entry.answer || "", 110);
  return `
      <div class="history-preview">
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px;">${timestamp}</div>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 600;">Prompt:</div>
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; white-space: pre-wrap;">${escapeFn(promptPreview)}</div>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 600;">Response:</div>
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; white-space: pre-wrap;">${escapeFn(answerPreview || "No response available")}</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Click to view full context</div>
      </div>
    `;
}

async function loadPromptHistory({ getLocalStorage, setCurrentHistory, renderPromptHistory, promptHistoryEl, logError }) {
  try {
    const res = await getLocalStorage(["or_history"]);
    const history = res.or_history || [];
    setCurrentHistory(history);
    renderPromptHistory(history);
  } catch (e) {
    logError("Error loading history:", e);
    promptHistoryEl.textContent = "Error loading history.";
  }
}

function renderPromptHistory({
  history,
  promptHistoryEl,
  getCurrentHistory,
  onSelectHistoryItem,
  setHtmlSafely,
  escapeHtml,
  optionsHistoryFormatUtils,
  historyViewUtils
}) {
  if (!history.length) {
    promptHistoryEl.textContent = "No prompt history yet.";
    return;
  }

  promptHistoryEl.replaceChildren();

  const normalizeHistoryEntry = optionsHistoryFormatUtils.normalizeHistoryEntryForDisplay || defaultNormalizeHistoryEntry;
  const buildPreviewSnippet = optionsHistoryFormatUtils.buildPreviewSnippet || defaultBuildPreviewSnippet;
  const buildPreview = historyViewUtils.buildHistoryPreviewHtml || buildHistoryPreviewHtml;

  for (const item of history) {
    const displayItem = normalizeHistoryEntry(item);
    const div = document.createElement("div");
    div.className = "history-item";
    div.style.cssText = "background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;";

    const ts = new Date(item.createdAt).toLocaleString();
    setHtmlSafely(div, buildPreview(displayItem, ts, escapeHtml, buildPreviewSnippet));

    div.dataset.itemId = item.id;
    promptHistoryEl.appendChild(div);
  }

  document.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;

      const itemId = item.dataset.itemId;
      const historyItem = getCurrentHistory().find((h) => h.id === itemId);
      if (historyItem) {
        onSelectHistoryItem(historyItem);

        document.querySelectorAll(".history-item").forEach((node) => {
          node.style.background = "var(--color-bg)";
          node.style.borderColor = "var(--color-border)";
        });
        item.style.background = "var(--color-bg-secondary)";
        item.style.borderColor = "var(--color-primary)";
      }
    });
  });
}

function showHistoryDetail(item, deps) {
  return deps.optionsHistoryDetailControllerUtils.showOptionsHistoryDetail
    ? deps.optionsHistoryDetailControllerUtils.showOptionsHistoryDetail(item, {
        setHtmlSafely: deps.setHtmlSafely,
        escapeHtml: deps.escapeHtml,
        getCurrentHistory: deps.getCurrentHistory,
        setCurrentHistory: deps.setCurrentHistory,
        getPendingDeleteItem: deps.getPendingDeleteItem,
        setPendingDeleteItem: deps.setPendingDeleteItem,
        getLocalStorage: deps.getLocalStorage,
        setLocalStorage: deps.setLocalStorage,
        loadPromptHistory: deps.loadPromptHistory,
        showToast: deps.showToast,
        toastApi: deps.toastApi
      })
    : null;
}

async function commitDeleteHistoryItem({ id, getLocalStorage, setLocalStorage, setCurrentHistory, logError }) {
  try {
    const res = await getLocalStorage(["or_history"]);
    const history = res.or_history || [];
    const filtered = history.filter((item) => item.id !== id);
    await setLocalStorage({ or_history: filtered });
    setCurrentHistory(filtered);
  } catch (e) {
    logError("Error deleting history item:", e);
  }
}

const optionsHistoryRenderControllerUtils = {
  defaultNormalizeHistoryEntry,
  defaultBuildPreviewSnippet,
  buildHistoryPreviewHtml,
  loadPromptHistory,
  renderPromptHistory,
  showHistoryDetail,
  commitDeleteHistoryItem
};

if (typeof window !== "undefined") {
  window.optionsHistoryRenderControllerUtils = optionsHistoryRenderControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsHistoryRenderControllerUtils;
}
