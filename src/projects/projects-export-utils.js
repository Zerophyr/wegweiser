// projects-export-utils.js - Helpers for thread export formatting

function getFullThreadMessages(thread) {
  const archived = Array.isArray(thread?.archivedMessages) ? thread.archivedMessages : [];
  const live = Array.isArray(thread?.messages) ? thread.messages : [];
  return [...archived, ...live];
}

function buildExportPdfHtml(messages, escapeHtmlFn) {
  const list = Array.isArray(messages) ? messages : [];
  const escape = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (v) => String(v || "");
  return list.map((msg) => {
    const role = msg.role === "assistant" ? "Assistant" : "User";
    return `
      <div style="margin-bottom: 16px;">
        <h2>${role}</h2>
        <p>${escape(msg.content || "")}</p>
      </div>
    `;
  }).join("");
}

function buildThreadExportHtml(messages, options = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const applyMarkdownStyles = typeof options.applyMarkdownStyles === "function"
    ? options.applyMarkdownStyles
    : null;
  const escapeHtml = typeof options.escapeHtml === "function"
    ? options.escapeHtml
    : (v) => String(v || "");
  return list.map((msg) => {
    const role = msg.role === "assistant" ? "Assistant" : "User";
    const content = applyMarkdownStyles
      ? applyMarkdownStyles(msg.content || "")
      : escapeHtml(msg.content || "");
    return `<h2>${role}</h2><div>${content}</div>`;
  }).join("");
}

const projectsExportUtils = {
  getFullThreadMessages,
  buildExportPdfHtml,
  buildThreadExportHtml
};

if (typeof window !== "undefined") {
  window.projectsExportUtils = projectsExportUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsExportUtils;
}
