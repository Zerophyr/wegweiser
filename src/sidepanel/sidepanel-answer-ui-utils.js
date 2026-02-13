// sidepanel-answer-ui-utils.js - small answer UI helpers for sidepanel

function hasAnswerContent(html) {
  return Boolean(String(html || "").trim());
}

function buildSourcesCountLabel(count) {
  const safeCount = Number.isFinite(count) ? count : 0;
  return `${safeCount} source${safeCount !== 1 ? "s" : ""}`;
}

const sidepanelAnswerUiUtils = {
  hasAnswerContent,
  buildSourcesCountLabel
};

if (typeof window !== "undefined") {
  window.sidepanelAnswerUiUtils = sidepanelAnswerUiUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelAnswerUiUtils;
}
