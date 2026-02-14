// projects-send-controller-utils.js - send/stream/retry orchestration for Projects

function setSafeHtml(element, html, safeHtmlSetter) {
  if (!element) return;
  if (typeof safeHtmlSetter === "function") {
    safeHtmlSetter(element, html || "");
    return;
  }
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.innerHTML = typeof html === "string" ? html : "";
}

function renderStreamError(deps, ui, message, retryContext) {
  if (typeof deps.renderStreamError === "function") {
    deps.renderStreamError(ui, message, retryContext);
    return;
  }
  if (typeof deps.renderStreamErrorRuntime === "function") {
    deps.renderStreamErrorRuntime(ui, message, retryContext, {
      getStreamErrorHtml: deps.getStreamErrorHtml,
      setSanitizedHtml: deps.safeHtmlSetter,
      getRetryInProgress: deps.getRetryInProgress,
      getIsStreaming: deps.getIsStreaming,
      retryStreamFromContext: (ctx, state) => deps.retryStreamFromContext(ctx, state)
    });
    return;
  }
  if (!ui || !ui.content) return;
  if (typeof deps.getStreamErrorHtml === "function") {
    setSafeHtml(ui.content, deps.getStreamErrorHtml(message), deps.safeHtmlSetter);
    return;
  }
  ui.content.textContent = String(message || "Unknown error");
}

async function retryStreamFromContext(deps, retryContext, ui) {
  if (typeof deps.retryStreamFromContextRuntime === "function") {
    await deps.retryStreamFromContextRuntime(retryContext, ui, {
      getIsStreaming: deps.getIsStreaming,
      getRetryInProgress: deps.getRetryInProgress,
      setRetryInProgress: deps.setRetryInProgress,
      getThread: deps.getThread,
      getProject: deps.getProject,
      showToast: deps.showToast,
      resetStreamingUi: (state) => deps.resetStreamingUi(state, deps.getTokenBarStyle),
      sendBtn: deps.elements.sendBtn,
      setChatStreamingState: deps.setChatStreamingState,
      setIsStreaming: deps.setIsStreaming,
      streamMessage: deps.streamMessage,
      renderThreadList: deps.renderThreadList,
      logger: console
    });
    return;
  }
  if (!retryContext || deps.getIsStreaming()) return;
}

async function sendImageMessage(deps, content, project) {
  if (!deps.currentThreadId() || !deps.currentProjectId()) return;
  deps.setIsStreaming(true);
  if (deps.elements.sendBtn) {
    deps.elements.sendBtn.disabled = true;
  }
  deps.setChatStreamingState(false);

  await deps.addMessageToThread(deps.currentThreadId(), { role: "user", content });
  deps.clearChatInput(deps.elements.chatInput);

  const thread = await deps.getThread(deps.currentThreadId());
  if (thread) {
    deps.renderChatMessages(thread.messages, thread);
  }

  const tempWrapper = deps.createGeneratingImageMessage(
    typeof deps.buildImageCard === "function" ? deps.buildImageCard : null
  );
  deps.elements.chatMessages.appendChild(tempWrapper);
  deps.elements.chatMessages.scrollTop = deps.elements.chatMessages.scrollHeight;

  try {
    const provider = project?.modelProvider || deps.currentProvider();
    const model = project?.model || null;
    const res = await deps.sendRuntimeMessage({
      type: "image_query",
      prompt: content,
      provider,
      model
    });

    tempWrapper.remove();
    if (!res?.ok) {
      deps.showToast(res?.error || "Failed to generate image", "error");
      return;
    }

    const image = res.image || {};
    const imageId = image.imageId || deps.generateId("image");
    const mimeType = image.mimeType || "image/png";
    const dataUrl = image.dataUrl || image.data || "";

    if (typeof deps.putImageCacheEntry === "function") {
      await deps.putImageCacheEntry({ imageId, mimeType, dataUrl, createdAt: Date.now() });
    }

    const metaModel = deps.resolveAssistantModelLabel(project, provider, deps.buildModelDisplayName);
    await deps.addMessageToThread(deps.currentThreadId(), {
      role: "assistant",
      content: "Image generated",
      meta: { createdAt: Date.now(), model: metaModel, imageId, mimeType }
    });

    const updatedThread = await deps.getThread(deps.currentThreadId());
    if (updatedThread) {
      deps.renderChatMessages(updatedThread.messages, updatedThread);
      deps.updateProjectsContextButton(updatedThread, deps.currentProjectData());
    }
  } catch (err) {
    console.error("Image generation failed:", err);
    tempWrapper.remove();
    deps.showToast(err.message || "Failed to generate image", "error");
  } finally {
    deps.setIsStreaming(false);
    if (deps.elements.sendBtn) {
      deps.elements.sendBtn.disabled = false;
    }
    await deps.renderThreadList();
  }
}

async function sendMessage(deps) {
  const content = deps.elements.chatInput.value.trim();
  if (!content || !deps.currentThreadId() || !deps.currentProjectId() || deps.getIsStreaming()) return;

  const project = await deps.getProject(deps.currentProjectId());
  if (!project) return;

  if (deps.getImageModeEnabled()) {
    await sendImageMessage(deps, content, project);
    return;
  }

  await deps.addMessageToThread(deps.currentThreadId(), { role: "user", content });
  deps.clearChatInput(deps.elements.chatInput);

  let thread = await deps.getThread(deps.currentThreadId());
  if (!thread) return;

  thread = await deps.maybeSummarizeBeforeStreaming({
    thread,
    content,
    currentThreadId: deps.currentThreadId(),
    project,
    currentProvider: deps.currentProvider()
  }, deps.summarizationDeps);

  deps.renderChatMessages(thread.messages, thread);

  const webSearch = deps.elements.chatWebSearch?.checked;
  const reasoning = deps.elements.chatReasoning?.checked;
  const streamContext = deps.buildStreamContext({
    content,
    currentProjectId: deps.currentProjectId(),
    currentThreadId: deps.currentThreadId(),
    project,
    currentProvider: deps.currentProvider(),
    summary: thread.summary || "",
    webSearch,
    reasoning
  });
  deps.setLastStreamContext(streamContext);

  const startTime = Date.now();
  const streamingUi = deps.createStreamingAssistantMessage(deps.getTokenBarStyle);
  deps.elements.chatMessages.appendChild(streamingUi.messageDiv);
  deps.elements.chatMessages.scrollTop = deps.elements.chatMessages.scrollHeight;

  deps.setSendStreamingState(deps.elements.sendBtn, deps.setChatStreamingState, true);
  deps.setIsStreaming(true);

  try {
    await deps.streamMessage(content, project, thread, streamingUi, startTime, {
      webSearch: streamContext.webSearch,
      reasoning: streamContext.reasoning,
      retryContext: streamContext
    });
  } catch (err) {
    console.error("Stream error:", err);
    deps.showToast(err.message || "Failed to send message", "error");
  } finally {
    deps.setSendStreamingState(deps.elements.sendBtn, deps.setChatStreamingState, false);
    deps.setIsStreaming(false);
    await deps.renderThreadList();
  }
}

async function streamMessage(deps, content, project, thread, streamingUi, startTime, options) {
  return new Promise((resolve, reject) => {
    let streamPort = deps.createPort();
    deps.setStreamPort(streamPort);

    const chunkState = deps.createStreamChunkState(streamingUi, deps.createReasoningAppender);
    const assistantBubble = chunkState.assistantBubble;
    const messageDiv = chunkState.messageDiv;
    const safeHtmlSetter = deps.safeHtmlSetter;

    streamPort.onMessage.addListener(async (msg) => {
      if (deps.applyContentChunk(chunkState, msg, {
        extractReasoningFromStreamChunk: deps.extractReasoningFromStreamChunk,
        renderAssistantContent: (bubble, text) => deps.renderAssistantContent(bubble, text, {
          applyMarkdownStyles: deps.applyMarkdownStyles,
          setSanitizedHtml: safeHtmlSetter
        }),
        scrollToBottom: () => { deps.elements.chatMessages.scrollTop = deps.elements.chatMessages.scrollHeight; }
      })) {
        return;
      }
      if (deps.applyReasoningChunk(chunkState, msg)) {
        return;
      }
      if (msg.type === "complete") {
        const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : null;
        const meta = deps.buildStreamMeta(msg, project, elapsedSec, {
          buildModelDisplayName: deps.buildModelDisplayName,
          currentProvider: deps.currentProvider()
        });

        await deps.addMessageToThread(deps.currentThreadId(), deps.buildAssistantMessage(chunkState.fullContent, meta));
        const updatedThread = await deps.getThread(deps.currentThreadId());
        if (updatedThread) {
          deps.updateProjectsContextButton(updatedThread, deps.currentProjectData());
        }

        deps.updateAssistantFooter(streamingUi, meta, deps.getTokenBarStyle);
        const { sources, cleanText } = deps.getSourcesData(chunkState.fullContent);
        deps.renderAssistantContent(assistantBubble, cleanText, {
          applyMarkdownStyles: deps.applyMarkdownStyles,
          setSanitizedHtml: safeHtmlSetter
        });

        if (sources.length > 0) {
          if (typeof deps.makeSourceReferencesClickable === "function" && assistantBubble) {
            deps.makeSourceReferencesClickable(assistantBubble, sources);
          }
          if (typeof deps.createSourcesIndicator === "function") {
            const indicator = deps.createSourcesIndicator(sources, assistantBubble || messageDiv);
            if (indicator && assistantBubble) {
              assistantBubble.appendChild(indicator);
            }
          }
        }

        deps.renderChatSourcesSummary(messageDiv, sources);
        if (typeof deps.removeReasoningBubbles === "function") {
          deps.removeReasoningBubbles(messageDiv);
        }
        streamPort = deps.disconnectStreamPort(streamPort);
        deps.setStreamPort(streamPort);
        resolve();
      } else if (msg.type === "error") {
        renderStreamError(deps, streamingUi, msg.error, options.retryContext || deps.lastStreamContext());
        if (streamingUi?.metaText) {
          streamingUi.metaText.textContent = `Error - ${new Date().toLocaleTimeString()}`;
        }
        if (typeof deps.removeReasoningBubbles === "function") {
          deps.removeReasoningBubbles(messageDiv);
        }
        streamPort = deps.disconnectStreamPort(streamPort);
        deps.setStreamPort(streamPort);
        reject(new Error(msg.error));
      }
    });

    streamPort.onDisconnect.addListener(() => {
      deps.setStreamPort(null);
      if (deps.getIsStreaming()) {
        resolve();
      }
    });

    const messages = deps.buildStreamMessages(thread.messages, content, project.customInstructions, thread.summary);
    const { webSearch, reasoning } = deps.resolveStreamToggles(options, deps.elements);

    streamPort.postMessage(deps.buildStartStreamPayload({
      content,
      messages,
      project,
      provider: deps.currentProvider(),
      webSearch,
      reasoning,
      retry: options.retry === true
    }));
  });
}

function stopStreaming(deps) {
  const port = deps.getStreamPort();
  if (port) {
    port.disconnect();
    deps.setStreamPort(null);
  }
  deps.setIsStreaming(false);
  deps.setSendStreamingState(deps.elements.sendBtn, deps.setChatStreamingState, false);
  deps.showToast("Generation stopped", "info");
}

const projectsSendControllerUtils = {
  renderStreamError,
  retryStreamFromContext,
  sendImageMessage,
  sendMessage,
  streamMessage,
  stopStreaming
};

if (typeof window !== "undefined") {
  window.projectsSendControllerUtils = projectsSendControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsSendControllerUtils;
}
