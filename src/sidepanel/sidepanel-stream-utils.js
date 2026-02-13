// sidepanel-stream-utils.js - Stream/input/image helper functions for sidepanel UI

function escapeHtmlSafe(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function buildStreamErrorHtml(message) {
  const safeMessage = escapeHtmlSafe(message || "Unknown error");
  return `
    <div class="error-content">
      <div class="error-text">${safeMessage}</div>
      <div class="error-actions">
        <button class="retry-btn" type="button">Retry</button>
      </div>
    </div>
  `;
}

function sanitizePrompt(prompt) {
  const text = typeof prompt === "string" ? prompt : "";
  const maxLength = 10000;
  const cleaned = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function getImageExtension(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

function getImageViewerBaseUrl() {
  if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
    return chrome.runtime.getURL("src/image-viewer/image-viewer.html");
  }
  return "src/image-viewer/image-viewer.html";
}

const sidepanelStreamUtils = {
  buildStreamErrorHtml,
  sanitizePrompt,
  getImageExtension,
  getImageViewerBaseUrl
};

if (typeof window !== "undefined") {
  window.sidepanelStreamUtils = sidepanelStreamUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelStreamUtils;
}
