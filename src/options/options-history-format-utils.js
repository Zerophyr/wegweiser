// options-history-format-utils.js - normalization helpers for readable prompt history rendering

const KNOWN_UI_SELECTORS = [
  ".history-preview",
  ".history-detail-card",
  ".answer-item",
  ".answer-content",
  ".chat-message",
  ".chat-content",
  ".reasoning-content",
  ".answer-meta",
  ".answer-footer",
  ".token-usage-bar",
  ".copy-answer-btn",
  ".export-menu"
];

function coerceHistoryText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const objectValue = value.text || value.content || value.answer || value.prompt;
    if (typeof objectValue === "string") return objectValue;
    try {
      return JSON.stringify(value);
    } catch (_e) {
      return String(value);
    }
  }
  return String(value);
}

function cleanupExtractedText(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Prompt:?$/i.test(line))
    .filter((line) => !/^Answer:?$/i.test(line))
    .filter((line) => !/^Click to view full context$/i.test(line))
    .filter((line) => !/^Copy Prompt$/i.test(line))
    .filter((line) => !/^Copy Answer$/i.test(line))
    .filter((line) => !/^Delete$/i.test(line));
  return lines.join("\n").trim();
}

function extractDisplayTextFromKnownUiHtml(value) {
  const raw = coerceHistoryText(value);
  if (!raw.includes("<")) return raw;
  if (typeof DOMParser === "undefined") return raw;

  try {
    const parsed = new DOMParser().parseFromString(raw, "text/html");
    const hasKnownWrapper = KNOWN_UI_SELECTORS.some((selector) => parsed.querySelector(selector));
    if (!hasKnownWrapper) return raw;

    const answerContent = parsed.querySelector(".answer-content");
    if (answerContent && answerContent.textContent) {
      const extractedAnswer = cleanupExtractedText(answerContent.textContent);
      if (extractedAnswer) return extractedAnswer;
    }

    const previewPrompt = parsed.querySelector(".history-preview div:nth-of-type(3)");
    if (previewPrompt && previewPrompt.textContent) {
      const extractedPrompt = cleanupExtractedText(previewPrompt.textContent);
      if (extractedPrompt) return extractedPrompt;
    }

    const allText = cleanupExtractedText(parsed.body?.textContent || "");
    return allText || raw;
  } catch (_e) {
    return raw;
  }
}

function normalizeHistoryEntryForDisplay(entry) {
  const item = entry || {};
  const promptText = extractDisplayTextFromKnownUiHtml(item.prompt);
  const answerText = extractDisplayTextFromKnownUiHtml(item.answer);
  return {
    ...item,
    promptText,
    answerText
  };
}

function buildPreviewSnippet(text, maxLen = 80) {
  const raw = coerceHistoryText(text).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}...`;
}

const optionsHistoryFormatUtils = {
  coerceHistoryText,
  extractDisplayTextFromKnownUiHtml,
  normalizeHistoryEntryForDisplay,
  buildPreviewSnippet
};

if (typeof window !== "undefined") {
  window.optionsHistoryFormatUtils = optionsHistoryFormatUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsHistoryFormatUtils;
}
