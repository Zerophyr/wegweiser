// projects-chat-view-utils.js - Helpers for Projects chat container rendering

function shouldShowSummaryBadge(summaryUpdatedAt, now = Date.now(), freshnessMs = 30000) {
  if (!summaryUpdatedAt || !Number.isFinite(now) || !Number.isFinite(freshnessMs)) {
    return false;
  }
  return (now - summaryUpdatedAt) < freshnessMs;
}

function buildChatMessagesContainerHtml({ archiveHtml = "", showSummaryBadge = false, messagesHtml = "" } = {}) {
  const summaryBadgeHtml = showSummaryBadge
    ? '<div class="chat-summary-badge">Summary updated</div>'
    : "";
  return `${archiveHtml}${summaryBadgeHtml}${messagesHtml}`;
}

const projectsChatViewUtils = {
  shouldShowSummaryBadge,
  buildChatMessagesContainerHtml
};

if (typeof window !== "undefined") {
  window.projectsChatViewUtils = projectsChatViewUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsChatViewUtils;
}
