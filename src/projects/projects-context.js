// projects-context.js - Shared helpers for Projects context and summarization behavior

function getLiveWindowSize(summary) {
  return summary ? 8 : 12;
}

function splitMessagesForSummary(messages, liveWindowSize) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  if (safeMessages.length <= liveWindowSize) {
    return { historyToSummarize: [], liveMessages: safeMessages };
  }
  const cutoffIndex = safeMessages.length - liveWindowSize;
  return {
    historyToSummarize: safeMessages.slice(0, cutoffIndex),
    liveMessages: safeMessages.slice(cutoffIndex)
  };
}

function shouldSkipSummarization(prompt) {
  if (typeof prompt !== "string") return false;
  const estimatedTokens = Math.ceil(prompt.length / 4);
  return estimatedTokens > 2000;
}

function getSummaryMinLength(historyCount) {
  const safeCount = Number.isFinite(historyCount) ? historyCount : Number(historyCount) || 0;
  const scaled = safeCount * 20;
  return Math.max(80, Math.min(200, scaled));
}

function appendArchivedMessages(currentArchive, newMessages) {
  const safeCurrent = Array.isArray(currentArchive) ? currentArchive : [];
  const safeNew = Array.isArray(newMessages) ? newMessages : [];
  return [...safeCurrent, ...safeNew];
}

function buildProjectsContextData(thread) {
  const summary = typeof thread?.summary === "string" ? thread.summary : "";
  const liveMessages = Array.isArray(thread?.messages) ? thread.messages : [];
  const archivedMessages = Array.isArray(thread?.archivedMessages) ? thread.archivedMessages : [];
  return { summary, liveMessages, archivedMessages };
}

function buildContextBadgeLabel(contextSize) {
  if (!contextSize || contextSize <= 2) {
    return "";
  }
  return `${Math.floor(contextSize / 2)} Q&A`;
}

function getContextUsageCount(thread, Project) {
  const data = buildProjectsContextData(thread);
  let count = data.liveMessages.length;
  if (data.summary) {
    count += 1;
  }
  if (Project?.customInstructions && Project.customInstructions.trim().length) {
    count += 1;
  }
  return count;
}

const projectsContextUtils = {
  getLiveWindowSize,
  splitMessagesForSummary,
  shouldSkipSummarization,
  getSummaryMinLength,
  appendArchivedMessages,
  buildProjectsContextData,
  buildContextBadgeLabel,
  getContextUsageCount
};

if (typeof window !== "undefined") {
  window.projectsContextUtils = projectsContextUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsContextUtils;
}
