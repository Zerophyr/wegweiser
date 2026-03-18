// sidepanel-image-generation-utils.js - image generation orchestration helpers

function getSafeHtmlModule() {
  return (typeof globalThis !== "undefined" && globalThis.safeHtml)
  || (typeof module !== "undefined" && module.exports ? require("../modules/safe-html.js") : null)
  || {};
}

function setSafeHtml(element, html, safeHtmlSetter) {
  if (!element) return;
  if (typeof safeHtmlSetter === "function") {
    safeHtmlSetter(element, html);
    return;
  }
  if (typeof getSafeHtmlModule().setSanitizedHtml === "function") {
    getSafeHtmlModule().setSanitizedHtml(element, html || "");
    return;
  }
  element.textContent = typeof html === "string" ? html : "";
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

const sidepanelImageGenerationUtils = {
  setSafeHtml,
  clearElementContent,
  generateImage
};

if (typeof window !== "undefined") {
  window.sidepanelImageGenerationUtils = sidepanelImageGenerationUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.sidepanelImageGenerationUtils = sidepanelImageGenerationUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelImageGenerationUtils;
}
