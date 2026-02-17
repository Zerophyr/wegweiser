// projects-send-deps-utils.js - dependency object builders for Projects send/stream orchestration

function buildRenderStreamErrorDeps(params = {}) {
  return {
    renderStreamErrorRuntime: params.renderStreamErrorRuntime,
    getStreamErrorHtml: params.getStreamErrorHtml,
    safeHtmlSetter: params.safeHtmlSetter,
    getRetryInProgress: params.getRetryInProgress,
    getIsStreaming: params.getIsStreaming,
    retryStreamFromContext: params.retryStreamFromContext
  };
}

function buildRetryStreamFromContextDeps(params = {}) {
  return {
    retryStreamFromContextRuntime: params.retryStreamFromContextRuntime,
    getIsStreaming: params.getIsStreaming,
    getRetryInProgress: params.getRetryInProgress,
    setRetryInProgress: params.setRetryInProgress,
    getThread: params.getThread,
    getProject: params.getProject,
    showToast: params.showToast,
    resetStreamingUi: params.resetStreamingUi,
    getTokenBarStyle: params.getTokenBarStyle,
    elements: params.elements,
    setChatStreamingState: params.setChatStreamingState,
    setIsStreaming: params.setIsStreaming,
    streamMessage: params.streamMessage,
    renderThreadList: params.renderThreadList
  };
}

function buildSendImageMessageDeps(params = {}) {
  return {
    currentThreadId: params.currentThreadId,
    currentProjectId: params.currentProjectId,
    setIsStreaming: params.setIsStreaming,
    elements: params.elements,
    setChatStreamingState: params.setChatStreamingState,
    addMessageToThread: params.addMessageToThread,
    clearChatInput: params.clearChatInput,
    getThread: params.getThread,
    renderChatMessages: params.renderChatMessages,
    createGeneratingImageMessage: params.createGeneratingImageMessage,
    buildImageCard: params.buildImageCard,
    sendRuntimeMessage: params.sendRuntimeMessage,
    showToast: params.showToast,
    generateId: params.generateId,
    putImageCacheEntry: params.putImageCacheEntry,
    resolveAssistantModelLabel: params.resolveAssistantModelLabel,
    buildModelDisplayName: params.buildModelDisplayName,
    currentProvider: params.currentProvider,
    currentProjectData: params.currentProjectData,
    updateProjectsContextButton: params.updateProjectsContextButton,
    renderThreadList: params.renderThreadList
  };
}

function buildSendMessageDeps(params = {}) {
  return {
    elements: params.elements,
    currentThreadId: params.currentThreadId,
    currentProjectId: params.currentProjectId,
    getIsStreaming: params.getIsStreaming,
    getProject: params.getProject,
    getImageModeEnabled: params.getImageModeEnabled,
    addMessageToThread: params.addMessageToThread,
    clearChatInput: params.clearChatInput,
    getThread: params.getThread,
    maybeSummarizeBeforeStreaming: params.maybeSummarizeBeforeStreaming,
    summarizationDeps: params.summarizationDeps,
    renderChatMessages: params.renderChatMessages,
    buildStreamContext: params.buildStreamContext,
    currentProvider: params.currentProvider,
    setLastStreamContext: params.setLastStreamContext,
    createStreamingAssistantMessage: params.createStreamingAssistantMessage,
    getTokenBarStyle: params.getTokenBarStyle,
    setSendStreamingState: params.setSendStreamingState,
    setChatStreamingState: params.setChatStreamingState,
    setIsStreaming: params.setIsStreaming,
    streamMessage: params.streamMessage,
    showToast: params.showToast,
    renderThreadList: params.renderThreadList
  };
}

function buildStreamMessageDeps(params = {}) {
  return {
    createPort: params.createPort,
    setStreamPort: params.setStreamPort,
    getStreamPort: params.getStreamPort,
    createStreamChunkState: params.createStreamChunkState,
    createReasoningAppender: params.createReasoningAppender,
    safeHtmlSetter: params.safeHtmlSetter,
    applyContentChunk: params.applyContentChunk,
    extractReasoningFromStreamChunk: params.extractReasoningFromStreamChunk,
    renderAssistantContent: params.renderAssistantContent,
    applyMarkdownStyles: params.applyMarkdownStyles,
    elements: params.elements,
    applyReasoningChunk: params.applyReasoningChunk,
    buildStreamMeta: params.buildStreamMeta,
    buildModelDisplayName: params.buildModelDisplayName,
    currentProvider: params.currentProvider,
    addMessageToThread: params.addMessageToThread,
    currentThreadId: params.currentThreadId,
    buildAssistantMessage: params.buildAssistantMessage,
    getThread: params.getThread,
    currentProjectData: params.currentProjectData,
    updateProjectsContextButton: params.updateProjectsContextButton,
    updateAssistantFooter: params.updateAssistantFooter,
    getTokenBarStyle: params.getTokenBarStyle,
    getSourcesData: params.getSourcesData,
    makeSourceReferencesClickable: params.makeSourceReferencesClickable,
    createSourcesIndicator: params.createSourcesIndicator,
    renderChatSourcesSummary: params.renderChatSourcesSummary,
    removeReasoningBubbles: params.removeReasoningBubbles,
    disconnectStreamPort: params.disconnectStreamPort,
    renderStreamError: params.renderStreamError,
    lastStreamContext: params.lastStreamContext,
    getIsStreaming: params.getIsStreaming,
    buildStreamMessages: params.buildStreamMessages,
    resolveStreamToggles: params.resolveStreamToggles,
    buildStartStreamPayload: params.buildStartStreamPayload
  };
}

function buildStopStreamingDeps(params = {}) {
  return {
    getStreamPort: params.getStreamPort,
    setStreamPort: params.setStreamPort,
    setIsStreaming: params.setIsStreaming,
    setSendStreamingState: params.setSendStreamingState,
    elements: params.elements,
    setChatStreamingState: params.setChatStreamingState,
    showToast: params.showToast
  };
}

const projectsSendDepsUtils = {
  buildRenderStreamErrorDeps,
  buildRetryStreamFromContextDeps,
  buildSendImageMessageDeps,
  buildSendMessageDeps,
  buildStreamMessageDeps,
  buildStopStreamingDeps
};

if (typeof window !== "undefined") {
  window.projectsSendDepsUtils = projectsSendDepsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsSendDepsUtils;
}
