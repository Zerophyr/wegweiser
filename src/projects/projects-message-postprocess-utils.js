// projects-message-postprocess-utils.js - Post-render behavior for Projects chat messages

function processProjectsAssistantSources(root, deps = {}) {
  const scope = root || document;
  const makeSourceReferencesClickable = deps.makeSourceReferencesClickable;
  const createSourcesIndicator = deps.createSourcesIndicator;
  const renderChatSourcesSummary = deps.renderChatSourcesSummary;
  const logger = deps.logger || console;

  scope.querySelectorAll(".chat-message-assistant .chat-content").forEach((contentEl) => {
    try {
      const sources = JSON.parse(contentEl.dataset.sources || "[]");
      if (sources.length > 0 && typeof makeSourceReferencesClickable === "function") {
        makeSourceReferencesClickable(contentEl, sources);
        if (typeof createSourcesIndicator === "function") {
          const indicator = createSourcesIndicator(sources, contentEl);
          if (indicator) {
            contentEl.appendChild(indicator);
          }
        }
      }

      const messageDiv = contentEl.closest(".chat-message-assistant");
      if (messageDiv && typeof renderChatSourcesSummary === "function") {
        renderChatSourcesSummary(messageDiv, sources);
      }
    } catch (e) {
      if (logger && typeof logger.error === "function") {
        logger.error("Error processing sources:", e);
      }
    }
  });
}

function bindProjectsCopyButtons(root, deps = {}) {
  const scope = root || document;
  const writeText = deps.writeText || ((text) => navigator.clipboard.writeText(text));
  const showToast = deps.showToast || (() => {});
  const setTimeoutFn = deps.setTimeoutFn || setTimeout;

  scope.querySelectorAll(".chat-copy-btn").forEach((btn) => {
    if (btn.dataset.bound === "true") return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const message = btn.closest(".chat-message-assistant");
      const contentEl = message?.querySelector(".chat-content");
      const content = contentEl?.innerText || contentEl?.textContent || "";
      try {
        await writeText(content);
        btn.classList.add("copied");
        setTimeoutFn(() => {
          btn.classList.remove("copied");
        }, 2000);
      } catch (_) {
        showToast("Failed to copy", "error");
      }
    });
  });
}

const projectsMessagePostprocessUtils = {
  processProjectsAssistantSources,
  bindProjectsCopyButtons
};

if (typeof window !== "undefined") {
  window.projectsMessagePostprocessUtils = projectsMessagePostprocessUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsMessagePostprocessUtils;
}
