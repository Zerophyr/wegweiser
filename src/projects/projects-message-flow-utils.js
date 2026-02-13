// projects-message-flow-utils.js - message send flow helpers for Projects UI

function clearChatInput(inputEl) {
  if (!inputEl) return;
  inputEl.value = "";
  inputEl.style.height = "auto";
}

function createGeneratingImageMessage(buildImageCardFn) {
  const tempWrapper = document.createElement("div");
  tempWrapper.className = "chat-message chat-message-assistant image-message";
  tempWrapper.innerHTML = `
    <div class="chat-bubble-wrapper">
      <div class="chat-bubble">
        <div class="chat-content"></div>
      </div>
    </div>
  `;

  const tempContent = tempWrapper.querySelector(".chat-content");
  if (tempContent && typeof buildImageCardFn === "function") {
    tempContent.appendChild(buildImageCardFn({ state: "generating" }));
  } else if (tempContent) {
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
