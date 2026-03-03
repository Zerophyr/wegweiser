// projects-message-flow-utils.js - message send flow helpers for Projects UI

function clearChatInput(inputEl) {
  if (!inputEl) return;
  inputEl.value = "";
  inputEl.style.height = "auto";
}

function createGeneratingImageMessage(buildImageCardFn) {
  const tempWrapper = document.createElement("div");
  tempWrapper.className = "chat-message chat-message-assistant image-message";

  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.className = "chat-bubble-wrapper";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  const tempContent = document.createElement("div");
  tempContent.className = "chat-content";

  bubble.appendChild(tempContent);
  bubbleWrapper.appendChild(bubble);
  tempWrapper.appendChild(bubbleWrapper);

  if (typeof buildImageCardFn === "function") {
    tempContent.appendChild(buildImageCardFn({ state: "generating" }));
  } else {
    tempContent.textContent = "Generating image...";
  }
  return tempWrapper;
}

function resolveAssistantModelLabel(project, provider, buildModelDisplayNameFn) {
  if (project?.modelDisplayName) {
    return project.modelDisplayName;
  }
  if (project?.model && typeof buildModelDisplayNameFn === "function") {
    return buildModelDisplayNameFn(provider, project.model);
  }
  return "default model";
}

function buildStreamContext(params = {}) {
  return {
    prompt: params.content || "",
    projectId: params.currentProjectId || null,
    threadId: params.currentThreadId || null,
    model: params.project?.model || null,
    modelProvider: params.project?.modelProvider || params.currentProvider || "openrouter",
    modelDisplayName: params.project?.modelDisplayName || null,
    customInstructions: params.project?.customInstructions || "",
    summary: params.summary || "",
    webSearch: Boolean(params.webSearch),
    reasoning: Boolean(params.reasoning)
  };
}

function setSendStreamingState(sendBtn, setChatStreamingStateFn, isStreaming) {
  if (sendBtn) {
    sendBtn.style.display = isStreaming ? "none" : "block";
  }
  if (typeof setChatStreamingStateFn === "function") {
    setChatStreamingStateFn(Boolean(isStreaming));
  }
}

const projectsMessageFlowUtils = {
  clearChatInput,
  createGeneratingImageMessage,
  resolveAssistantModelLabel,
  buildStreamContext,
  setSendStreamingState
};

if (typeof window !== "undefined") {
  window.projectsMessageFlowUtils = projectsMessageFlowUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsMessageFlowUtils;
}
