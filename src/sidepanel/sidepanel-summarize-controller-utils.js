// sidepanel-summarize-controller-utils.js - summarize-page orchestration

function buildHtmlNodes(html) {
  const safeHtml = typeof html === "string" ? html : "";
  if (typeof document === "undefined") return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    return Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  }
  return [document.createTextNode(safeHtml)];
}

function setSafeHtml(element, html) {
  if (!element) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.replaceChildren(...buildHtmlNodes(html));
}

function appendErrorHtml(answerEl, errorHtml) {
  if (!answerEl) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.appendSanitizedHtml === "function") {
    window.safeHtml.appendSanitizedHtml(answerEl, errorHtml);
    return;
  }
  const wrapper = document.createElement("div");
  setSafeHtml(wrapper, errorHtml);
  const node = wrapper.firstElementChild;
  if (node) {
    answerEl.appendChild(node);
  }
}

function registerSummarizeHandler(deps) {
  const {
    summarizeBtn,
    askBtn,
    metaEl,
    answerEl,
    answerSection,
    showAnswerBox,
    showTypingIndicator,
    hideTypingIndicator,
    getProviderLabel,
    getCurrentProvider,
    getWebSearchEnabled,
    getReasoningEnabled,
    sendRuntimeMessage,
    renderMarkdown,
    renderSourcesSummary,
    makeSourceReferencesClickable,
    createSourcesIndicator,
    extractSources,
    updateAnswerVisibility,
    refreshBalance,
    getContextViz,
    getSelectedModel,
    getDefaultModel,
    estimateTokenBarPercentage,
    escapeHtml,
    toast
  } = deps;

  if (!summarizeBtn) return;

  summarizeBtn.addEventListener("click", async () => {
    const startTime = Date.now();
    summarizeBtn.disabled = true;
    askBtn.disabled = true;

    metaEl.textContent = "Extracting page content...";
    showAnswerBox();
    showTypingIndicator();
    answerSection.scrollTop = answerSection.scrollHeight;

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) {
        throw new Error("Could not get active tab");
      }

      metaEl.textContent = `Sending to ${getProviderLabel(getCurrentProvider())} for summarization...`;
      await new Promise((resolve) => setTimeout(resolve, 200));

      let res = await sendRuntimeMessage({
        type: "summarize_page",
        tabId,
        webSearch: getWebSearchEnabled(),
        reasoning: getReasoningEnabled()
      });

      metaEl.textContent = "Processing response...";
      await new Promise((resolve) => setTimeout(resolve, 100));
      hideTypingIndicator();

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!res?.ok) {
        if (res?.requiresPermission && res?.url) {
          metaEl.textContent = "Requesting permission to access page...";
          const permResponse = await sendRuntimeMessage({
            type: "request_permission",
            url: res.url
          });

          if (permResponse?.ok && permResponse?.granted) {
            metaEl.textContent = "Permission granted. Retrying...";
            toast.success("Permission granted. Retrying page summarization...");
            await new Promise((resolve) => setTimeout(resolve, 500));
            showTypingIndicator();
            metaEl.textContent = `Sending to ${getProviderLabel(getCurrentProvider())} for summarization...`;

            const retryRes = await sendRuntimeMessage({
              type: "summarize_page",
              tabId,
              webSearch: getWebSearchEnabled(),
              reasoning: getReasoningEnabled()
            });

            hideTypingIndicator();

            if (!retryRes?.ok) {
              appendErrorHtml(answerEl, `<div class="answer-item error-item"><div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div><div class="answer-content">${escapeHtml(retryRes?.error || "Unknown error")}</div></div>`);
              updateAnswerVisibility();
              metaEl.textContent = "Failed to summarize page.";
              answerSection.scrollTop = answerSection.scrollHeight;
              return;
            }

            res = {
              ...res,
              ...retryRes
            };
          } else {
            appendErrorHtml(answerEl, `<div class="answer-item error-item"><div class="answer-meta">Permission denied - ${new Date().toLocaleTimeString()}</div><div class="answer-content">Allow page access and try again.</div></div>`);
            updateAnswerVisibility();
            metaEl.textContent = "Permission denied.";
            toast.error("Permission denied. Click Summarize Page again to retry.");
            answerSection.scrollTop = answerSection.scrollHeight;
            return;
          }
        } else {
          appendErrorHtml(answerEl, `<div class="answer-item error-item"><div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div><div class="answer-content">${escapeHtml(res?.error || "Unknown error")}</div></div>`);
          updateAnswerVisibility();
          metaEl.textContent = "Error summarizing page.";
          answerSection.scrollTop = answerSection.scrollHeight;
          return;
        }
      }

      if (res?.ok) {
        metaEl.textContent = "Rendering summary...";

        const answerItem = document.createElement("div");
        answerItem.className = "answer-item";
        const contextBadge = res.contextSize > 2
          ? `<span class="answer-context-badge" title="${res.contextSize} messages in conversation context">🧠 ${Math.floor(res.contextSize / 2)} Q&A</span>`
          : "";
        const summaryModel = getSelectedModel() || getDefaultModel(res.model || "default model");
        const tokenPercent = estimateTokenBarPercentage(res.tokens);

        setSafeHtml(answerItem, `
          <div class="answer-meta">
            <span>📄 Page Summary - ${new Date().toLocaleTimeString()} - ${escapeHtml(summaryModel)}</span>
          </div>
          <div class="answer-content"></div>
          <div class="answer-footer">
            <div class="answer-stats">
              <span class="answer-time">${elapsedTime}s</span>
              <span class="answer-tokens">${res.tokens || "-"} tokens</span>
              ${contextBadge}
            </div>
            <div class="token-usage-bar" role="progressbar" aria-valuenow="${Math.round(tokenPercent)}" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
              <div class="token-usage-fill" style="width: ${tokenPercent}%;"></div>
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
        `);
        answerEl.appendChild(answerItem);

        const answerContent = answerItem.querySelector(".answer-content");
        const { sources, cleanText } = extractSources(res.answer);
        await renderMarkdown(answerContent, cleanText);

        updateAnswerVisibility();
        const contextInfo = res.contextSize > 2 ? ` (${Math.floor(res.contextSize / 2)} previous Q&A in context)` : "";
        metaEl.textContent = `Summary ready using ${summaryModel}${contextInfo}.`;

        const contextViz = getContextViz();
        if (contextViz && res.contextSize) {
          contextViz.update(res.contextSize, "assistant");
        }

        if (sources.length > 0) {
          makeSourceReferencesClickable(answerContent, sources);
          const indicator = createSourcesIndicator(sources, answerItem);
          if (indicator) {
            answerItem.appendChild(indicator);
          }
        }

        renderSourcesSummary(answerItem, sources);
        toast.success(`Page summarized using ${summaryModel}`);
        answerSection.scrollTop = answerSection.scrollHeight;
        await refreshBalance();
      }
    } catch (e) {
      hideTypingIndicator();
      appendErrorHtml(answerEl, `<div class="answer-item error-item"><div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div><div class="answer-content">${escapeHtml(e?.message || String(e))}</div></div>`);
      updateAnswerVisibility();
      metaEl.textContent = "Failed to summarize page.";
      answerSection.scrollTop = answerSection.scrollHeight;
    } finally {
      summarizeBtn.disabled = false;
      askBtn.disabled = false;
    }
  });
}

const sidepanelSummarizeControllerUtils = {
  registerSummarizeHandler
};

if (typeof window !== "undefined") {
  window.sidepanelSummarizeControllerUtils = sidepanelSummarizeControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelSummarizeControllerUtils;
}

