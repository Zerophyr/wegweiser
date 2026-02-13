// projects-summarization-flow-utils.js - summarization/update flow for Projects chat

async function maybeSummarizeBeforeStreaming(params = {}, deps = {}) {
  const thread = params.thread;
  if (!thread) return thread;

  const getLiveWindowSize = deps.getLiveWindowSize || (() => 12);
  const splitMessagesForSummary = deps.splitMessagesForSummary || (() => ({ historyToSummarize: [], liveMessages: thread.messages || [] }));
  const shouldSkipSummarization = deps.shouldSkipSummarization || (() => false);

  const liveWindowSize = getLiveWindowSize(thread.summary);
  const { historyToSummarize, liveMessages } = splitMessagesForSummary(thread.messages, liveWindowSize);
  if (!Array.isArray(historyToSummarize) || historyToSummarize.length === 0 || shouldSkipSummarization(params.content)) {
    return thread;
  }

  try {
    deps.showToast?.("Updating summary...", "info");

    const summaryMessages = typeof deps.buildSummarizerMessages === "function"
      ? deps.buildSummarizerMessages(thread.summary, historyToSummarize)
      : historyToSummarize;
    const summaryRes = await deps.sendRuntimeMessage?.({
      type: "summarize_thread",
      messages: summaryMessages,
      model: params.project?.model || null,
      provider: params.project?.modelProvider || params.currentProvider
    });

    const getSummaryMinLength = deps.getSummaryMinLength || (() => 80);
    const minSummaryLength = getSummaryMinLength(historyToSummarize.length);
    const summaryText = typeof summaryRes?.summary === "string" ? summaryRes.summary.trim() : "";

    if (summaryRes?.ok && summaryText.length >= minSummaryLength) {
      const appendArchivedMessages = deps.appendArchivedMessages || ((currentArchive, newMessages) => [
        ...(Array.isArray(currentArchive) ? currentArchive : []),
        ...(Array.isArray(newMessages) ? newMessages : [])
      ]);
      const updatedArchive = appendArchivedMessages(thread.archivedMessages, historyToSummarize);
      const nextThread = {
        ...thread,
        summary: summaryText,
        summaryUpdatedAt: Date.now(),
        archivedMessages: updatedArchive,
        archivedUpdatedAt: Date.now(),
        messages: liveMessages
      };

      await deps.updateThread?.(params.currentThreadId, {
        messages: nextThread.messages,
        summary: nextThread.summary,
        summaryUpdatedAt: nextThread.summaryUpdatedAt,
        archivedMessages: nextThread.archivedMessages,
        archivedUpdatedAt: nextThread.archivedUpdatedAt
      });
      return nextThread;
    }

    deps.showToast?.("Summary update failed; continuing without it", "error");
    return thread;
  } catch (err) {
    deps.logger?.warn?.("Summary update failed:", err);
    deps.showToast?.("Summary update failed; continuing without it", "error");
    return thread;
  }
}

const projectsSummarizationFlowUtils = {
  maybeSummarizeBeforeStreaming
};

if (typeof window !== "undefined") {
  window.projectsSummarizationFlowUtils = projectsSummarizationFlowUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsSummarizationFlowUtils;
}
