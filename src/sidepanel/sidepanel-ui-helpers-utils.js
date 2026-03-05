// sidepanel-ui-helpers-utils.js - sidepanel UI helper functions

function estimateTokens(text, charsPerToken = 4) {
  return Math.ceil(String(text || "").length / charsPerToken);
}

function updateAnswerVisibility(answerEl, hasAnswerContent, clearBtn) {
  if (!hasAnswerContent(answerEl.innerHTML)) {
    answerEl.classList.add("hidden");
    if (clearBtn) clearBtn.style.display = "none";
  } else {
    answerEl.classList.remove("hidden");
    if (clearBtn) clearBtn.style.display = "block";
  }
}

function showAnswerBox(answerEl, clearBtn) {
  answerEl.classList.remove("hidden");
  if (clearBtn) clearBtn.style.display = "block";
}

function setAnswerLoading(answerEl, isLoading) {
  if (isLoading) answerEl.classList.add("loading");
  else answerEl.classList.remove("loading");
}

function renderSourcesSummary(answerItem, sources, deps) {
  const summary = answerItem?.querySelector(".answer-sources-summary");
  deps.renderSourcesSummaryToElementSafe(summary, sources, deps.getUniqueDomains, deps.buildSourcesCountLabelSafe);
}

function exportAnswer(answerItem, format, deps) {
  if (!answerItem) return;
  const payload = deps.getExportPayloadSafe(answerItem);
  const messages = payload.messages;

  if (format === "markdown" && typeof deps.exportMarkdownFile === "function") {
    deps.exportMarkdownFile(messages, "answer.md");
  } else if (format === "docx" && typeof deps.exportDocx === "function") {
    deps.exportDocx(messages, "answer.docx");
  } else if (format === "pdf" && typeof deps.exportPdf === "function") {
    deps.exportPdf(payload.html, "answer");
  }
}

function openImageInNewTab(dataUrl, imageId, deps) {
  if (!dataUrl) return;
  const viewerBaseUrl = deps.getImageViewerBaseUrl();
  const openUrl = typeof deps.buildImageOpenUrl === "function"
    ? deps.buildImageOpenUrl(dataUrl, imageId || "", viewerBaseUrl)
    : dataUrl;

  deps.openTab({ url: openUrl }, () => {
    if (deps.runtimeLastError?.()) {
      console.warn("Failed to open image:", deps.runtimeLastError().message);
      if (typeof deps.showToast === "function") {
        deps.showToast("Unable to open image in a new tab.", "error");
      }
    }
  });
}

function downloadImage(dataUrl, imageId, mimeType, getImageExtension) {
  if (!dataUrl) return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `wegweiser-image-${imageId}.${getImageExtension(mimeType)}`;
  link.click();
}

async function refreshContextVisualization(contextViz, tabsQuery, sendRuntimeMessage) {
  if (!contextViz) return;
  try {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id || "default";
    const res = await sendRuntimeMessage({ type: "get_context_size", tabId });
    const size = res?.contextSize || 0;
    contextViz.update(size, "assistant");
  } catch (e) {
    console.warn("Failed to refresh context visualization:", e);
    contextViz.update(0, "assistant");
  }
}

function autoResizeTextarea(promptEl, maxHeight) {
  promptEl.style.height = "auto";
  const newHeight = Math.min(promptEl.scrollHeight, maxHeight);
  promptEl.style.height = `${newHeight}px`;
}

function updateTokenEstimation(promptEl, estimatedCostEl, estimateTokensFn) {
  const text = promptEl.value.trim();
  if (text.length > 0) {
    const tokens = estimateTokensFn(text);
    estimatedCostEl.textContent = `~${tokens} tokens`;
    estimatedCostEl.style.display = "block";
  } else {
    estimatedCostEl.style.display = "none";
  }
}

function showTypingIndicator(typingIndicator) {
  typingIndicator.classList.add("active");
}

function hideTypingIndicator(typingIndicator) {
  typingIndicator.classList.remove("active");
}

const sidepanelUiHelpersUtils = {
  estimateTokens,
  updateAnswerVisibility,
  showAnswerBox,
  setAnswerLoading,
  renderSourcesSummary,
  exportAnswer,
  openImageInNewTab,
  downloadImage,
  refreshContextVisualization,
  autoResizeTextarea,
  updateTokenEstimation,
  showTypingIndicator,
  hideTypingIndicator
};

if (typeof window !== "undefined") {
  window.sidepanelUiHelpersUtils = sidepanelUiHelpersUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelUiHelpersUtils;
}
