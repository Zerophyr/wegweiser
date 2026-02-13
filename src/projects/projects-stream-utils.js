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

const projectsStreamUtils = {
  buildAssistantMessage,
  buildStreamMessages,
  getSourcesData,
  getTypingIndicatorHtml,
  getStreamErrorHtml
};

if (typeof window !== "undefined") {
  window.projectsStreamUtils = projectsStreamUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStreamUtils;
}
