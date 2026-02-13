// projects-chat-panel-utils.js - View state helpers for Projects chat panel visibility

function buildEmptyChatPanelState() {
  return {
    chatEmptyDisplay: "flex",
    chatContainerDisplay: "none",
    hasActiveThread: false
  };
}

function buildActiveChatPanelState() {
  return {
    chatEmptyDisplay: "none",
    chatContainerDisplay: "flex",
    hasActiveThread: true
  };
}

function applyChatPanelStateToElements(elements, state) {
  if (!elements || !state) return;
  if (elements.chatEmptyState?.style) {
    elements.chatEmptyState.style.display = state.chatEmptyDisplay;
  }
  if (elements.chatContainer?.style) {
    elements.chatContainer.style.display = state.chatContainerDisplay;
  }
}

const projectsChatPanelUtils = {
  buildEmptyChatPanelState,
  buildActiveChatPanelState,
  applyChatPanelStateToElements
};

if (typeof window !== "undefined") {
  window.projectsChatPanelUtils = projectsChatPanelUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsChatPanelUtils;
}
