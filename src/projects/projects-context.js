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

function buildContextMessageHtml(messages, truncateTextFn, escapeHtmlFn) {
  const truncate = typeof truncateTextFn === "function" ? truncateTextFn : (v) => String(v || "");
  const escape = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (v) => String(v || "");
  return (messages || []).map((msg) => {
    const role = msg.role === "assistant" ? "Assistant" : msg.role === "system" ? "System" : "User";
    const roleClass = msg.role === "assistant" ? "assistant" : "";
    const preview = truncate(msg.content || "", 160);
    return `
      <div class="projects-context-item">
        <div class="projects-context-role ${roleClass}">${escape(role)}</div>
        <div class="projects-context-text">${escape(preview)}</div>
      </div>
    `;
  }).join("");
}

function getProjectsContextButtonState(thread, Project, maxContextMessages = 16) {
  const data = buildProjectsContextData(thread);
  const label = buildContextBadgeLabel(data.liveMessages.length);
  const isActive = Boolean(label);
  const usedCount = getContextUsageCount(thread, Project);
  const remaining = Math.max(maxContextMessages - usedCount, 0);
  return {
    label,
    isActive,
    usedCount,
    remaining,
    title: isActive
      ? `${usedCount} messages in context · ${remaining} remaining`
      : "No conversation context yet"
  };
}

function getProjectsContextModalState(thread, Project, maxContextMessages = 16) {
  const data = buildProjectsContextData(thread);
  const usedCount = getContextUsageCount(thread, Project);
  const remaining = Math.max(maxContextMessages - usedCount, 0);
  const fillPercentage = Math.min((usedCount / maxContextMessages) * 100, 100);
  const isNearLimit = fillPercentage > 75;
  return {
    data,
    usedCount,
    remaining,
    fillPercentage,
    isNearLimit
  };
}

function buildProjectsContextModalHtml({
  thread,
  project,
  maxContextMessages = 16,
  truncateText,
  escapeHtml
} = {}) {
  const modalState = getProjectsContextModalState(thread, project, maxContextMessages);
  const data = modalState.data;
  const usedCount = modalState.usedCount;
  const remaining = modalState.remaining;
  const fillPercentage = modalState.fillPercentage;
  const isNearLimit = modalState.isNearLimit;
  return `
    <div class="projects-context-header">
      <h3><span>🧠</span><span>Conversation Context</span></h3>
      <button class="projects-context-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="projects-context-body">
      ${data.summary ? `
        <div class="projects-context-section">
          <h4>Summary</h4>
          <div class="projects-context-text">${(escapeHtml || String)(data.summary)}</div>
        </div>
      ` : ''}
      <div class="projects-context-section">
        <h4>Live Messages (${data.liveMessages.length})</h4>
        ${data.liveMessages.length ? buildContextMessageHtml(data.liveMessages, truncateText, escapeHtml) : '<div class="projects-context-text">No live messages yet.</div>'}
      </div>
      ${data.archivedMessages.length ? `
        <div class="projects-context-section">
          <button class="projects-context-archive-toggle" type="button">
            <span>Archived messages (${data.archivedMessages.length})</span>
            <span>+</span>
          </button>
          <div class="projects-context-archive-content">
            ${buildContextMessageHtml(data.archivedMessages, truncateText, escapeHtml)}
          </div>
        </div>
      ` : ''}
      ${project?.customInstructions && project.customInstructions.trim().length ? `
        <div class="projects-context-section">
          <h4>Custom Instructions</h4>
          <div class="projects-context-text">${(escapeHtml || String)((truncateText || String)(project.customInstructions, 220))}</div>
        </div>
      ` : ''}
    </div>
    <div class="projects-context-footer">
      <div class="projects-context-text">${usedCount}/${maxContextMessages} messages in context · ${remaining} remaining</div>
      <div class="projects-context-bar">
        <div class="projects-context-bar-fill" style="width: ${fillPercentage}%; background: ${isNearLimit ? 'var(--color-warning)' : 'var(--color-success)'};"></div>
      </div>
      ${isNearLimit ? '<div class="projects-context-warning">⚠️ Context is nearing capacity.</div>' : ''}
    </div>
  `;
}

const projectsContextUtils = {
  getLiveWindowSize,
  splitMessagesForSummary,
  shouldSkipSummarization,
  getSummaryMinLength,
  appendArchivedMessages,
  buildProjectsContextData,
  buildContextBadgeLabel,
  getContextUsageCount,
  buildContextMessageHtml,
  getProjectsContextButtonState,
  getProjectsContextModalState,
  buildProjectsContextModalHtml
};

if (typeof window !== "undefined") {
  window.projectsContextUtils = projectsContextUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsContextUtils;
}
