// projects-stream-runtime-utils.js - runtime stream error/retry helpers for Projects UI

function buildHtmlNodes(html) {
  const safeHtml = typeof html === "string" ? html : "";
  if (typeof document === "undefined") return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    return Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  }
  return [document.createTextNode(safeHtml)];
}

function setSafeHtml(element, html, safeHtmlSetter) {
  if (!element) return;
  if (typeof safeHtmlSetter === "function") {
    safeHtmlSetter(element, html || "");
    return;
  }
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.replaceChildren(...buildHtmlNodes(html));
}

function renderStreamError(ui, message, retryContext, deps) {
  if (!ui || !ui.content || !deps) return;
  const errorHtml = deps.getStreamErrorHtml(message);
  setSafeHtml(ui.content, errorHtml, deps.setSanitizedHtml);

  const retryBtn = ui.content.querySelector(".retry-btn");
  if (!retryBtn) return;
  retryBtn.addEventListener("click", async () => {
    if (deps.getRetryInProgress() || deps.getIsStreaming()) return;
    retryBtn.disabled = true;
    await deps.retryStreamFromContext(retryContext, ui);
  });
}

async function retryStreamFromContext(retryContext, ui, deps) {
  if (!deps) return;
  if (!retryContext || deps.getIsStreaming()) {
    deps.showToast?.("Nothing to retry yet", "error");
    return;
  }

  deps.setRetryInProgress(true);
  try {
    const thread = await deps.getThread(retryContext.threadId);
    const project = await deps.getProject(retryContext.projectId);
    if (!thread || !project) {
      deps.showToast?.("Retry failed: Project or thread not found", "error");
      return;
    }

    const effectiveProject = {
      ...project,
      model: retryContext.model,
      modelProvider: retryContext.modelProvider,
      modelDisplayName: retryContext.modelDisplayName,
      customInstructions: retryContext.customInstructions
    };

    deps.resetStreamingUi(ui);
    if (deps.sendBtn) deps.sendBtn.style.display = "none";
    deps.setChatStreamingState(true);
    deps.setIsStreaming(true);

    const startTime = Date.now();
    await deps.streamMessage(retryContext.prompt, effectiveProject, thread, ui, startTime, {
      webSearch: retryContext.webSearch,
      reasoning: retryContext.reasoning,
      retryContext,
      retry: true
    });
  } catch (err) {
    deps.logger?.error?.("Stream retry failed:", err);
    deps.showToast?.(err?.message || "Retry failed", "error");
  } finally {
    if (deps.sendBtn) deps.sendBtn.style.display = "block";
    deps.setChatStreamingState(false);
    deps.setIsStreaming(false);
    deps.setRetryInProgress(false);
    await deps.renderThreadList?.();
  }
}

function createReasoningAppender(messageDiv, assistantBubble) {
  let reasoningTextEl = null;

  const ensureReasoningBubble = () => {
    if (reasoningTextEl) return reasoningTextEl;
    const bubble = messageDiv?.querySelector(".chat-bubble");
    if (!bubble) return null;
    const wrapper = document.createElement("div");
    wrapper.className = "chat-reasoning-bubble";
    wrapper.style.marginBottom = "12px";
    setSafeHtml(wrapper, `
      <div style="padding: 12px; background: var(--color-bg-tertiary); border-left: 3px solid var(--color-topic-5); border-radius: 4px;">
        <div class="reasoning-header" style="font-size: 12px; font-weight: 600; color: var(--color-topic-5); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>&#128173;</span>
          <span>Reasoning:</span>
        </div>
        <div class="reasoning-text" style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap;"></div>
      </div>
    `);
    const contentEl = assistantBubble || bubble.querySelector(".chat-content");
    if (contentEl) {
      bubble.insertBefore(wrapper, contentEl);
    } else {
      bubble.appendChild(wrapper);
    }
    reasoningTextEl = wrapper.querySelector(".reasoning-text");
    return reasoningTextEl;
  };

  return {
    append(text) {
      if (!text) return;
      const target = ensureReasoningBubble();
      if (!target) return;
      target.textContent += text;
    }
  };
}

function renderAssistantContent(assistantBubble, text, deps = {}) {
  if (!assistantBubble) return;
  const rendered = typeof deps.applyMarkdownStyles === "function"
    ? deps.applyMarkdownStyles(text)
    : String(text || "");
  setSafeHtml(assistantBubble, rendered, deps.setSanitizedHtml);
}

function buildStreamMeta(msg, project, elapsedSec, deps = {}) {
  let metaModel = msg?.model || "default model";
  if (project?.modelDisplayName) {
    metaModel = project.modelDisplayName;
  } else if (project?.model && typeof deps.buildModelDisplayName === "function") {
    metaModel = deps.buildModelDisplayName(
      project.modelProvider || deps.currentProvider || "openrouter",
      project.model
    );
  }
  return {
    model: metaModel,
    tokens: msg?.tokens || null,
    responseTimeSec: typeof elapsedSec === "number" ? Number(elapsedSec.toFixed(2)) : null,
    contextSize: msg?.contextSize || 0,
    createdAt: Date.now()
  };
}

function disconnectStreamPort(port) {
  if (!port) return null;
  try {
    port.disconnect();
  } catch (_) {
    // ignore runtime disconnect errors
  }
  return null;
}

const projectsStreamRuntimeUtils = {
  renderStreamError,
  retryStreamFromContext,
  createReasoningAppender,
  renderAssistantContent,
  buildStreamMeta,
  disconnectStreamPort
};

if (typeof window !== "undefined") {
  window.projectsStreamRuntimeUtils = projectsStreamRuntimeUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStreamRuntimeUtils;
}

