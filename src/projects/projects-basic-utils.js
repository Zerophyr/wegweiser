// projects-basic-utils.js - General utility helpers for Projects UI

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day}. ${month}. ${year}`;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

function generateThreadTitle(firstMessage) {
  const firstSentence = firstMessage.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) {
    return firstSentence.trim();
  }
  return firstMessage.substring(0, 50).trim() + "...";
}

function formatBytes(bytes) {
  const safeBytes = Number.isFinite(bytes) ? bytes : 0;
  return `${(safeBytes / 1024 / 1024).toFixed(1)}MB`;
}

function buildStorageLabel(label, bytesUsed, maxBytes = null) {
  if (typeof maxBytes === "number" && maxBytes > 0) {
    return `${label}: ${formatBytes(bytesUsed)} of ${formatBytes(maxBytes)}`;
  }
  return `${label}: ${formatBytes(bytesUsed)}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getImageExtension(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

function sanitizeFilename(name) {
  return (name || "thread").replace(/[^a-zA-Z0-9 _-]/g, "").trim().substring(0, 50) || "thread";
}

const projectsBasicUtils = {
  generateId,
  formatRelativeTime,
  formatDate,
  truncateText,
  generateThreadTitle,
  formatBytes,
  buildStorageLabel,
  escapeHtml,
  getImageExtension,
  sanitizeFilename
};

if (typeof window !== "undefined") {
  window.projectsBasicUtils = projectsBasicUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsBasicUtils;
}
