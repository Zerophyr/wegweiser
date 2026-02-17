// sidepanel-prompt-controller-utils.js - prompt/image generation orchestration

function buildHtmlNodes(html) {
  const safeHtml = typeof html === "string" ? html : "";
  if (typeof document === "undefined") return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    return Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  }
  return [document.createTextNode(safeHtml)];
}

function setSafeHtml(element, html, safeHtmlSetter) {
  if (!element) return;
  if (typeof safeHtmlSetter === "function") {
    safeHtmlSetter(element, html);
    return;
  }
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html);
    return;
  }
  element.replaceChildren(...buildHtmlNodes(html));
}

function clearElementContent(element) {
  if (!element) return;
  element.textContent = "";
}

async function generateImage(deps, prompt) {
  const {
    state,
    askBtn,
    setPromptStreamingState,
    metaEl,
    showAnswerBox,
    answerEl,
    updateAnswerVisibility,
    answerSection,
    parseCombinedModelIdSafe,
    normalizeProviderSafe,
    sendRuntimeMessage,
    buildImageCard,
    putImageCacheEntry,
    getImageCacheEntry,
    openImageInNewTab,
    downloadImage,
    refreshBalance
  } = deps;

  askBtn.disabled = true;
  setPromptStreamingState(false);
  metaEl.textContent = "🖼️ Generating image...";
  showAnswerBox();

  const answerItem = document.createElement("div");
  answerItem.className = "answer-item";
  setSafeHtml(answerItem, `
    <div class="answer-meta">
      <span>${new Date().toLocaleTimeString()} - Image</span>
    </div>
    <div class="answer-content"></div>
  `);

  const answerContent = answerItem.querySelector(".answer-content");
  if (answerContent && typeof buildImageCard === "function") {
    answerContent.appendChild(buildImageCard({ state: "generating" }));
  } else if (answerContent) {
    answerContent.textContent = "Generating image...";
  }

  answerEl.appendChild(answerItem);
  updateAnswerVisibility();
  answerSection.scrollTop = answerSection.scrollHeight;

  try {
    const parsed = parseCombinedModelIdSafe(state.selectedCombinedModelId || "");
    const provider = normalizeProviderSafe(parsed.provider || state.currentProvider);
    const modelId = parsed.modelId || "";

    const res = await sendRuntimeMessage({
      type: "image_query",
      prompt,
      provider,
      model: modelId
    });

    if (!res?.ok) {
      const errorMessage = res?.error || "Failed to generate image.";
      if (answerContent && typeof buildImageCard === "function") {
        clearElementContent(answerContent);
        answerContent.appendChild(buildImageCard({ state: "error" }));
      } else if (answerContent) {
        answerContent.textContent = errorMessage;
      }
      metaEl.textContent = "❌ Failed to generate image.";
      return;
    }

    const image = res.image || {};
    const imageId = image.imageId || crypto.randomUUID();
    const mimeType = image.mimeType || "image/png";
    const dataUrl = image.dataUrl || image.data || "";

    if (typeof putImageCacheEntry === "function") {
      await putImageCacheEntry({ imageId, mimeType, dataUrl, createdAt: Date.now() });
    }

    let resolvedDataUrl = dataUrl;
    if (typeof getImageCacheEntry === "function") {
      const cached = await getImageCacheEntry(imageId);
      resolvedDataUrl = cached?.dataUrl || cached?.data || resolvedDataUrl;
    }

    if (answerContent && typeof buildImageCard === "function") {
      if (!resolvedDataUrl) {
        clearElementContent(answerContent);
        answerContent.appendChild(buildImageCard({ state: "expired" }));
        metaEl.textContent = "⚠️ Image expired.";
        return;
      }
      const readyCard = buildImageCard({
        state: "ready",
        imageUrl: resolvedDataUrl,
        mode: "sidepanel",
        onView: () => openImageInNewTab(resolvedDataUrl, imageId),
        onDownload: () => downloadImage(resolvedDataUrl, imageId, mimeType)
      });
      const thumb = readyCard.querySelector(".image-card-thumb");
      if (thumb) {
        thumb.addEventListener("click", () => openImageInNewTab(resolvedDataUrl, imageId));
      }
      clearElementContent(answerContent);
      answerContent.appendChild(readyCard);
    } else if (answerContent) {
      answerContent.textContent = "Image generated.";
    }

    metaEl.textContent = "✅ Image generated.";
    answerSection.scrollTop = answerSection.scrollHeight;
    await refreshBalance();
  } catch (e) {
    console.error("Error generating image:", e);
    if (answerContent && typeof buildImageCard === "function") {
      clearElementContent(answerContent);
      answerContent.appendChild(buildImageCard({ state: "error" }));
    } else if (answerContent) {
      answerContent.textContent = e?.message || String(e);
    }
    metaEl.textContent = "❌ Failed to generate image.";
  } finally {
    askBtn.disabled = false;
  }
}

async function askQuestion(deps) {
  const {
    state,
    promptEl,
    sanitizePrompt,
    metaEl,
    clearPromptAfterSend,
    generateImageImpl,
    askBtn,
    setPromptStreamingState,
    showAnswerBox,
    answerEl,
    typingIndicator,
    showTypingIndicator,
    answerSection,
    queryActiveTab,
    sendRuntimeMessage,
    getProviderLabelSafe,
    updateAnswerVisibility,
    hideTypingIndicator,
    buildStreamErrorHtml,
    getStreamingFallbackMessage,
    extractReasoningFromStreamChunk,
    extractSources,
    applyMarkdownStyles,
    safeHtmlSetter,
    modelMap,
    getModelDisplayName,
    UI_CONSTANTS,
    removeReasoningBubbles,
    makeSourceReferencesClickable,
    createSourcesIndicator,
    renderSourcesSummary,
    contextViz,
    escapeHtml,
    estimatedCostEl,
    refreshBalance
  } = deps;

  const rawPrompt = promptEl.value;
  const prompt = sanitizePrompt(rawPrompt);
  if (!prompt) {
    metaEl.textContent = "Enter a prompt first.";
    return;
  }
  if (prompt.length >= 10000) {
    metaEl.textContent = "⚠️ Prompt truncated to 10,000 characters.";
  }

  if (state.activePort) {
    try { state.activePort.disconnect(); } catch (_) {}
    state.activePort = null;
  }

  if (state.imageModeEnabled) {
    if (typeof clearPromptAfterSend === "function") {
      clearPromptAfterSend(promptEl);
    } else {
      promptEl.value = "";
      promptEl.style.height = "auto";
    }
    await generateImageImpl(prompt);
    return;
  }

  askBtn.disabled = true;
  setPromptStreamingState(true);
  metaEl.textContent = "🔄 Preparing request...";
  showAnswerBox();
  answerEl.appendChild(typingIndicator);
  showTypingIndicator();
  answerSection.scrollTop = answerSection.scrollHeight;

  try {
    const tabs = await queryActiveTab();
    const tabId = tabs[0]?.id || "default";
    const currentContextMsg = await sendRuntimeMessage({ type: "get_context_size", tabId });
    const contextSize = currentContextMsg?.contextSize || 0;
    const contextInfo = contextSize > 0 ? ` (with ${Math.floor(contextSize / 2)} previous Q&A)` : "";
    metaEl.textContent = state.reasoningEnabled
      ? `💭 Thinking${contextInfo}...`
      : `📤 Streaming response${contextInfo}...`;

    const answerItem = document.createElement("div");
    answerItem.className = "answer-item";
    const contextBadge = contextSize > 2
      ? `<span class="answer-context-badge" title="${contextSize} messages in conversation context">🧠 ${Math.floor(contextSize / 2)} Q&A</span>`
      : "";
    setSafeHtml(answerItem, `
      <div class="answer-meta">
        <span>${new Date().toLocaleTimeString()} - Streaming...</span>
      </div>
      ${state.reasoningEnabled ? '<div class="reasoning-content" style="margin-bottom: 12px;" role="region" aria-label="Reasoning steps"></div>' : ''}
      <div class="answer-content" role="article" aria-live="polite"></div>
      <div class="answer-footer">
        <div class="answer-stats">
          <span class="answer-time" aria-label="Response time">--s</span>
          <span class="answer-tokens" aria-label="Token count">-- tokens</span>
          ${contextBadge}
        </div>
        <div class="token-usage-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
          <div class="token-usage-fill" style="width: 0%;"></div>
        </div>
        <div class="answer-actions">
          <div class="answer-actions-left">
            <button class="action-btn copy-answer-btn" title="Copy answer" aria-label="Copy answer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </button>
            <div class="export-menu">
              <button class="action-btn export-btn" title="Export" aria-label="Export" aria-haspopup="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/>
                </svg>
              </button>
              <div class="export-menu-items">
                <button class="export-option" data-format="pdf">Export PDF</button>
                <button class="export-option" data-format="markdown">Export Markdown</button>
                <button class="export-option" data-format="docx">Export DOCX</button>
              </div>
            </div>
          </div>
          <div class="answer-sources-summary"></div>
        </div>
      </div>
    `, safeHtmlSetter);

    hideTypingIndicator();
    answerEl.appendChild(answerItem);

    const answerContent = answerItem.querySelector(".answer-content");
    let reasoningContent = answerItem.querySelector(".reasoning-content");
    const answerMeta = answerItem.querySelector(".answer-meta");

    const ensureReasoningSection = () => {
      if (reasoningContent) return;
      const wrapper = document.createElement("div");
      wrapper.className = "reasoning-content";
      wrapper.style.marginBottom = "12px";
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "Reasoning steps");
      setSafeHtml(wrapper, `
        <div style="padding: 12px; background: var(--color-bg-tertiary); border-left: 3px solid var(--color-topic-5); border-radius: 4px;">
          <div class="reasoning-header" style="font-size: 12px; font-weight: 600; color: var(--color-topic-5); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;"><span>💭</span><span>Thinking...</span></div>
          <div class="reasoning-text" style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap;"></div>
        </div>`, safeHtmlSetter);
      answerContent.before(wrapper);
      reasoningContent = wrapper;
    };

    const streamContext = {
      prompt,
      tabId,
      contextSize,
      webSearch: state.webSearchEnabled,
      reasoning: state.reasoningEnabled,
      selectedCombinedModelId: state.selectedCombinedModelId,
      currentProvider: state.currentProvider
    };
    state.lastStreamContext = streamContext;

    const resetAnswerForRetry = () => {
      clearElementContent(answerContent);
      const metaSpan = answerMeta.querySelector("span");
      if (metaSpan) metaSpan.textContent = `${new Date().toLocaleTimeString()} - Streaming...`;
      const timeSpan = answerItem.querySelector(".answer-time");
      const tokensSpan = answerItem.querySelector(".answer-tokens");
      const tokenBar = answerItem.querySelector(".token-usage-fill");
      if (timeSpan) timeSpan.textContent = "--s";
      if (tokensSpan) tokensSpan.textContent = "-- tokens";
      if (tokenBar) tokenBar.style.width = "0%";
      const sourcesSummary = answerItem.querySelector(".answer-sources-summary");
      if (sourcesSummary) sourcesSummary.textContent = "";
      if (typeof removeReasoningBubbles === "function") removeReasoningBubbles(answerItem);
    };

    const renderStreamError = (message, statusText) => {
      setSafeHtml(answerContent, buildStreamErrorHtml(message), safeHtmlSetter);
      const retryBtn = answerContent.querySelector(".retry-btn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          if (state.activePort) return;
          retryBtn.disabled = true;
          resetAnswerForRetry();
          startStream({ retry: true });
        });
      }
      const metaSpan = answerMeta.querySelector("span");
      if (metaSpan) metaSpan.textContent = `Error - ${new Date().toLocaleTimeString()}`;
      metaEl.textContent = statusText || `❌ Error from ${getProviderLabelSafe(state.currentProvider)}.`;
      hideTypingIndicator();
      updateAnswerVisibility();
      answerSection.scrollTop = answerSection.scrollHeight;
    };

    const startStream = ({ retry = false } = {}) => {
      let fullAnswer = "";
      let hasCompleted = false;
      let hasError = false;
      let hasReceivedReasoning = false;
      const reasoningStreamState = { inReasoning: false, carry: "" };
      const streamStartTime = Date.now();

      state.streamStopRequested = false;
      state.streamStoppedByUser = false;

      if (retry) {
        metaEl.textContent = `🔁 Retrying${streamContext.contextSize > 0 ? ` (with ${Math.floor(streamContext.contextSize / 2)} previous Q&A)` : ""}...`;
      }

      const port = chrome.runtime.connect({ name: "streaming" });
      state.activePort = port;
      askBtn.disabled = true;
      setPromptStreamingState(true);
      port.postMessage({
        type: "start_stream",
        prompt: streamContext.prompt,
        webSearch: streamContext.webSearch,
        reasoning: streamContext.reasoning,
        tabId: streamContext.tabId,
        retry: retry === true
      });

      port.onDisconnect.addListener(() => {
        const stoppedByUser = Boolean(state.streamStoppedByUser || state.streamStopRequested);
        state.streamStopRequested = false;
        state.streamStoppedByUser = false;
        state.activePort = null;
        setPromptStreamingState(false);
        askBtn.disabled = false;
        if (!hasCompleted && !hasError && !stoppedByUser) {
          const fallbackMessage = typeof getStreamingFallbackMessage === "function"
            ? getStreamingFallbackMessage(fullAnswer, hasReceivedReasoning)
            : null;
          if (fallbackMessage) renderStreamError(fallbackMessage, "⚠️ Stream ended without an answer.");
        }
      });

      port.onMessage.addListener((msg) => {
        if (msg.type === "reasoning" && msg.reasoning) {
          ensureReasoningSection();
          const reasoningText = reasoningContent?.querySelector(".reasoning-text");
          const reasoningHeader = reasoningContent?.querySelector(".reasoning-header");
          if (reasoningText) {
            hasReceivedReasoning = true;
            if (reasoningHeader && reasoningHeader.textContent.includes("Thinking")) {
              reasoningHeader.replaceChildren();
              const icon = document.createElement("span");
              icon.textContent = "💭";
              const label = document.createElement("span");
              label.textContent = "Reasoning:";
              reasoningHeader.appendChild(icon);
              reasoningHeader.appendChild(label);
            }
            reasoningText.textContent += msg.reasoning;
            answerSection.scrollTop = answerSection.scrollHeight;
          }
          return;
        }

        if (msg.type === "content" && msg.content) {
          try {
            let contentChunk = msg.content;
            if (typeof extractReasoningFromStreamChunk === "function") {
              const parsed = extractReasoningFromStreamChunk(reasoningStreamState, contentChunk);
              contentChunk = parsed.content;
            }
            if (!contentChunk) return;
            fullAnswer += contentChunk;
            const { cleanText } = extractSources(fullAnswer);
            const renderedHTML = applyMarkdownStyles(cleanText);
            if (safeHtmlSetter) {
              safeHtmlSetter(answerContent, renderedHTML);
            } else {
              setSafeHtml(answerContent, renderedHTML, safeHtmlSetter);
            }
            answerSection.scrollTop = answerSection.scrollHeight;
          } catch (e) {
            const renderMessage = `Error rendering: ${e?.message || "Unknown error"}`;
            setSafeHtml(answerContent, buildStreamErrorHtml(renderMessage), safeHtmlSetter);
          }
          return;
        }

        if (msg.type === "complete") {
          hasCompleted = true;
          const elapsedTime = ((Date.now() - streamStartTime) / 1000).toFixed(2);
          const selectedModel = streamContext.selectedCombinedModelId
            ? modelMap.get(streamContext.selectedCombinedModelId)
            : null;
          const currentModel = selectedModel ? getModelDisplayName(selectedModel) : (msg.model || "default model");
          const finalTokens = msg.tokens;
          const finalContextSize = msg.contextSize;

          const metaSpan = answerMeta.querySelector("span");
          if (metaSpan) metaSpan.textContent = `${new Date().toLocaleTimeString()} - ${currentModel}`;
          const timeSpan = answerItem.querySelector(".answer-time");
          const tokensSpan = answerItem.querySelector(".answer-tokens");
          if (timeSpan) timeSpan.textContent = `${elapsedTime}s`;
          if (tokensSpan) tokensSpan.textContent = `${finalTokens || "—"} tokens`;

          if (finalTokens) {
            const percentage = Math.min((finalTokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) * 100, 100);
            const tokenBar = answerItem.querySelector(".token-usage-fill");
            if (tokenBar) tokenBar.style.width = `${percentage}%`;
          }

          if (typeof removeReasoningBubbles === "function") removeReasoningBubbles(answerItem);
          if (fullAnswer) {
            const { sources, cleanText } = extractSources(fullAnswer);
            const rendered = applyMarkdownStyles(cleanText);
            setSafeHtml(answerContent, rendered, safeHtmlSetter);
            if (sources.length > 0) {
              makeSourceReferencesClickable(answerContent, sources);
              const sourcesIndicator = createSourcesIndicator(sources, answerEl);
              if (sourcesIndicator) answerContent.appendChild(sourcesIndicator);
            }
            renderSourcesSummary(answerItem, sources);
          }

          if (contextViz && finalContextSize) {
            try { contextViz.update(finalContextSize, "assistant"); } catch (_) {}
          }
          metaEl.textContent = `✅ Answer received using ${currentModel}.`;
          state.streamStopRequested = false;
          state.streamStoppedByUser = false;
          port.disconnect();
          state.activePort = null;
          setPromptStreamingState(false);
          return;
        }

        if (msg.type === "error") {
          hasError = true;
          renderStreamError(msg.error, `❌ Error from ${getProviderLabelSafe(state.currentProvider)}.`);
          state.streamStopRequested = false;
          state.streamStoppedByUser = false;
          port.disconnect();
          state.activePort = null;
          setPromptStreamingState(false);
        }
      });
    };

    startStream();
    if (typeof clearPromptAfterSend === "function") {
      clearPromptAfterSend(promptEl);
    } else {
      promptEl.value = "";
      promptEl.style.height = "auto";
    }
    estimatedCostEl.style.display = "none";
    await refreshBalance();
  } catch (e) {
    console.error("Error sending query:", e);
    hideTypingIndicator();
    const errorHtml = `<div class="answer-item error-item"><div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div><div class="answer-content">${escapeHtml(e?.message || String(e))}</div></div>`;
    if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.appendSanitizedHtml === "function") {
      window.safeHtml.appendSanitizedHtml(answerEl, errorHtml);
    } else {
      const wrapper = document.createElement("div");
      setSafeHtml(wrapper, errorHtml, safeHtmlSetter);
      const errorNode = wrapper.firstElementChild;
      if (errorNode) {
        answerEl.appendChild(errorNode);
      }
    }
    updateAnswerVisibility();
    metaEl.textContent = "❌ Failed to send request.";
    answerSection.scrollTop = answerSection.scrollHeight;
  } finally {
    if (!state.activePort) {
      askBtn.disabled = false;
      setPromptStreamingState(false);
    }
  }
}

const sidepanelPromptControllerUtils = {
  generateImage,
  askQuestion
};

if (typeof window !== "undefined") {
  window.sidepanelPromptControllerUtils = sidepanelPromptControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelPromptControllerUtils;
}

