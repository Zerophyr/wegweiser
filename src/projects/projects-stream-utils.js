// projects-stream-utils.js - Stream/prompt message helpers for Projects UI

function buildAssistantMessage(content, meta) {
  return {
    role: "assistant",
    content,
    meta
  };
}

function buildStreamMessages(messages, prompt, systemInstruction, summary) {
  const baseMessages = Array.isArray(messages) ? [...messages] : [];
  if (baseMessages.length > 0 && typeof prompt === "string") {
    const lastMessage = baseMessages[baseMessages.length - 1];
    if (lastMessage?.role === "user" && lastMessage.content === prompt) {
      baseMessages.pop();
    }
  }

  const finalMessages = [];
  if (systemInstruction) {
    const isOngoing = baseMessages.length > 0;
    const content = isOngoing
      ? `[Ongoing conversation. Follow these standing instructions without re-introducing yourself:]\n${systemInstruction}`
      : systemInstruction;
    finalMessages.push({ role: "system", content });
  }
  if (summary) {
    finalMessages.push({ role: "system", content: `Summary so far:\n${summary}` });
  }
  finalMessages.push(...baseMessages);
  return finalMessages;
}

function getSourcesData(content) {
  if (typeof extractSources === "function") {
    return extractSources(content);
  }
  return { sources: [], cleanText: content };
}

function getTypingIndicatorHtml() {
  return `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
}

function getStreamErrorHtml(message, escapeHtmlFn) {
  const escape = typeof escapeHtmlFn === "function"
    ? escapeHtmlFn
    : ((value) => String(value || "").replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]
    )));
  const safeMessage = escape(message || "Unknown error");
  return `
    <div class="error-content">
      <div class="error-text">${safeMessage}</div>
      <div class="error-actions">
        <button class="retry-btn" type="button">Retry</button>
      </div>
    </div>
  `;
}

function getDefaultTokenStyle() {
  return { percent: 0, gradient: "linear-gradient(90deg, var(--color-success), #16a34a)" };
}

function resolveTokenStyle(getTokenBarStyleFn, tokens) {
  if (typeof getTokenBarStyleFn === "function") {
    return getTokenBarStyleFn(tokens);
  }
  return getDefaultTokenStyle();
}

function createStreamingAssistantMessage(getTokenBarStyleFn) {
  const tokenStyle = resolveTokenStyle(getTokenBarStyleFn, null);

  const messageDiv = document.createElement("div");
  messageDiv.className = "chat-message chat-message-assistant";
  messageDiv.innerHTML = `
    <div class="chat-bubble-wrapper">
      <div class="chat-meta">
        <span class="chat-meta-text">Streaming...</span>
      </div>
      <div class="chat-bubble">
        <div class="chat-content">
          ${getTypingIndicatorHtml()}
        </div>
        <div class="chat-footer">
          <div class="chat-stats">
            <span class="chat-time">--s</span>
            <span class="chat-tokens">-- tokens</span>
            <span class="chat-context-badge" style="display: none;"></span>
          </div>
          <div class="token-usage-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
            <div class="token-usage-fill" style="width: ${tokenStyle.percent}%; background: ${tokenStyle.gradient};"></div>
          </div>
        </div>
        <div class="chat-actions">
          <div class="chat-actions-left">
            <button class="action-btn chat-copy-btn" title="Copy answer" aria-label="Copy answer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </button>
            <div class="export-menu">
              <button class="action-btn export-btn" title="Export" aria-label="Export" aria-haspopup="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/>
                </svg>
              </button>
              <div class="export-menu-items">
                <button class="export-option" data-format="pdf">Export PDF</button>
                <button class="export-option" data-format="markdown">Export Markdown</button>
                <button class="export-option" data-format="docx">Export DOCX</button>
              </div>
            </div>
          </div>
          <div class="chat-sources-summary"></div>
        </div>
      </div>
    </div>
  `;

  return {
    messageDiv,
    wrapper: messageDiv.querySelector(".chat-bubble-wrapper"),
    content: messageDiv.querySelector(".chat-content"),
    metaText: messageDiv.querySelector(".chat-meta-text"),
    timeEl: messageDiv.querySelector(".chat-time"),
    tokensEl: messageDiv.querySelector(".chat-tokens"),
    contextBadgeEl: messageDiv.querySelector(".chat-context-badge"),
    tokenFillEl: messageDiv.querySelector(".token-usage-fill"),
    tokenBarEl: messageDiv.querySelector(".token-usage-bar"),
    sourcesSummaryEl: messageDiv.querySelector(".chat-sources-summary")
  };
}

function updateAssistantFooter(ui, meta, getTokenBarStyleFn) {
  if (!ui || !meta) return;

  const metaTime = meta.createdAt ? new Date(meta.createdAt).toLocaleTimeString() : "";
  const metaModel = meta.model || "default model";
  if (ui.metaText) {
    ui.metaText.textContent = `${metaTime} - ${metaModel}`;
  }

  if (ui.timeEl) {
    ui.timeEl.textContent = typeof meta.responseTimeSec === "number"
      ? `${meta.responseTimeSec.toFixed(2)}s`
      : "--s";
  }

  if (ui.tokensEl) {
    ui.tokensEl.textContent = meta.tokens ? `${meta.tokens} tokens` : "-- tokens";
  }

  if (ui.contextBadgeEl) {
    if (meta.contextSize > 2) {
      ui.contextBadgeEl.style.display = "inline-flex";
      ui.contextBadgeEl.textContent = `🧠 ${Math.floor(meta.contextSize / 2)} Q&A`;
      ui.contextBadgeEl.title = `${meta.contextSize} messages in conversation context`;
    } else {
      ui.contextBadgeEl.style.display = "none";
    }
  }

  const tokenStyle = resolveTokenStyle(getTokenBarStyleFn, meta.tokens || null);
  if (ui.tokenFillEl) {
    ui.tokenFillEl.style.width = `${tokenStyle.percent}%`;
    ui.tokenFillEl.style.background = tokenStyle.gradient;
  }
  if (ui.tokenBarEl) {
    ui.tokenBarEl.setAttribute("aria-valuenow", tokenStyle.percent);
  }
}

function resetStreamingUi(ui, getTokenBarStyleFn) {
  if (!ui) return ui;
  if (ui.content) {
    ui.content.innerHTML = getTypingIndicatorHtml();
  }
  if (ui.metaText) {
    ui.metaText.textContent = "Streaming...";
  }
  if (ui.timeEl) {
    ui.timeEl.textContent = "--s";
  }
  if (ui.tokensEl) {
    ui.tokensEl.textContent = "-- tokens";
  }
  if (ui.contextBadgeEl) {
    ui.contextBadgeEl.style.display = "none";
    ui.contextBadgeEl.textContent = "";
  }
  if (ui.sourcesSummaryEl) {
    ui.sourcesSummaryEl.textContent = "";
  }
  if (ui.wrapper) {
    const reasoningBubble = ui.wrapper.querySelector(".chat-reasoning-bubble");
    if (reasoningBubble) {
      reasoningBubble.remove();
    }
  }
  const tokenStyle = resolveTokenStyle(getTokenBarStyleFn, null);
  if (ui.tokenFillEl) {
    ui.tokenFillEl.style.width = `${tokenStyle.percent}%`;
    ui.tokenFillEl.style.background = tokenStyle.gradient;
  }
  if (ui.tokenBarEl) {
    ui.tokenBarEl.setAttribute("aria-valuenow", "0");
  }
  return ui;
}

const projectsStreamUtils = {
  buildAssistantMessage,
  buildStreamMessages,
  getSourcesData,
  getTypingIndicatorHtml,
  getStreamErrorHtml,
  createStreamingAssistantMessage,
  updateAssistantFooter,
  resetStreamingUi
};

if (typeof window !== "undefined") {
  window.projectsStreamUtils = projectsStreamUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStreamUtils;
}
