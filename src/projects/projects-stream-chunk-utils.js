// projects-stream-chunk-utils.js - chunk-level stream handlers for Projects UI

function createStreamChunkState(streamingUi, createReasoningAppenderFn) {
  const assistantBubble = streamingUi?.content || null;
  const messageDiv = streamingUi?.messageDiv || null;
  const createAppender = typeof createReasoningAppenderFn === "function"
    ? createReasoningAppenderFn
    : (() => ({ append: () => {} }));

  return {
    fullContent: "",
    assistantBubble,
    messageDiv,
    reasoningStreamState: { inReasoning: false, carry: "" },
    reasoningAppender: createAppender(messageDiv, assistantBubble)
  };
}

function applyContentChunk(state, msg, deps = {}) {
  if (!state || msg?.type !== "content") return false;

  let contentChunk = msg.content || "";
  let reasoningChunk = "";
  if (typeof deps.extractReasoningFromStreamChunk === "function") {
    const parsed = deps.extractReasoningFromStreamChunk(state.reasoningStreamState, contentChunk);
    contentChunk = parsed.content;
    reasoningChunk = parsed.reasoning;
  }

  if (reasoningChunk) {
    state.reasoningAppender?.append?.(reasoningChunk);
  }
  if (!contentChunk) {
    return true;
  }

  state.fullContent += contentChunk;
  deps.renderAssistantContent?.(state.assistantBubble, state.fullContent);
  deps.scrollToBottom?.();
  return true;
}

function applyReasoningChunk(state, msg) {
  if (!state || msg?.type !== "reasoning" || !msg.reasoning) return false;
  state.reasoningAppender?.append?.(msg.reasoning);
  return true;
}

const projectsStreamChunkUtils = {
  createStreamChunkState,
  applyContentChunk,
  applyReasoningChunk
};

if (typeof window !== "undefined") {
  window.projectsStreamChunkUtils = projectsStreamChunkUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStreamChunkUtils;
}
