// safe-html.js - Centralized helpers for safe HTML sinks

function resolvePurifier() {
  if (typeof DOMPurify !== "undefined") {
    return DOMPurify;
  }
  if (typeof window !== "undefined" && window.DOMPurify) {
    return window.DOMPurify;
  }
  return null;
}

function sanitizeHtml(html, config) {
  const value = typeof html === "string" ? html : "";
  const purifier = resolvePurifier();
  if (!purifier || typeof purifier.sanitize !== "function") {
    return value;
  }
  return purifier.sanitize(value, config);
}

function setSanitizedHtml(element, html, config) {
  if (!element) return;
  element.innerHTML = sanitizeHtml(html, config);
}

function appendSanitizedHtml(element, html, config) {
  if (!element) return;
  const safeHtml = sanitizeHtml(html, config);
  if (!safeHtml) return;
  element.insertAdjacentHTML("beforeend", safeHtml);
}

const safeHtmlApi = {
  sanitizeHtml,
  setSanitizedHtml,
  appendSanitizedHtml
};

if (typeof window !== "undefined") {
  window.safeHtml = safeHtmlApi;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = safeHtmlApi;
}
