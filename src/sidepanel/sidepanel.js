// sidepanel.js

// Import UI constants (if modules are supported, otherwise constants are global)
const UI_CONSTANTS = window.UI_CONSTANTS || {
  TEXTAREA_MAX_HEIGHT: 200,
  TEXTAREA_MIN_HEIGHT: 44,
  CHARS_PER_TOKEN: 4,
  TOKEN_BAR_MAX_TOKENS: 4000,
  COPY_FEEDBACK_DURATION: 500,
  DEBOUNCE_DELAY: 150
};

// Initialize theme on page load
if (typeof initTheme === 'function') {
  initTheme();
}

const getLocalStorage = (keys) => (
  typeof window.getEncrypted === "function"
    ? window.getEncrypted(keys)
    : chrome.storage.local.get(keys)
);
const setLocalStorage = (values) => (
  typeof window.setEncrypted === "function"
    ? window.setEncrypted(values)
    : chrome.storage.local.set(values)
);
// encrypted-storage
const chatStore = (typeof window !== "undefined" && window.chatStore) ? window.chatStore : null;
const SIDEPANEL_PROJECT_ID = "__sidepanel__";

const promptEl = document.getElementById("prompt");
const answerEl = document.getElementById("answer");
const answerSection = document.getElementById("answer-section");
const askBtn = document.getElementById("askBtn");
const metaEl = document.getElementById("meta");
const balanceEl = document.getElementById("balance");
const balanceRefreshBtn = document.getElementById("balance-refresh");
const modelInput = document.getElementById("model-input");
const modelStatusEl = document.getElementById("model-status");
const webSearchToggle = document.getElementById("web-search-toggle");
const reasoningToggle = document.getElementById("reasoning-toggle");
const imageToggle = document.getElementById("image-toggle");
const settingsIcon = document.getElementById("settings-icon");
const setupPanel = document.getElementById("setup-panel");
const setupOpenOptionsBtn = document.getElementById("setup-open-options");
const promptContainer = document.getElementById("prompt-container");
const modelSection = document.getElementById("model-section");
const typingIndicator = document.getElementById("typing-indicator");
const stopBtn = document.getElementById("stopBtn");
const estimatedCostEl = document.getElementById("estimated-cost");

function setPromptStreamingState(isStreaming) {
  if (typeof setStreamingUi === "function") {
    setStreamingUi({
      container: promptContainer,
      input: promptEl,
      stopButton: stopBtn,
      isStreaming
    });
    return;
  }
  if (promptEl) {
    promptEl.disabled = Boolean(isStreaming);
  }
  if (stopBtn) {
    stopBtn.style.display = isStreaming ? "inline-flex" : "none";
  }
}

// ---- Toggle states ----
let webSearchEnabled = false;
let reasoningEnabled = false;
let imageModeEnabled = false;

// ---- Provider state ----
let currentProvider = "openrouter";
let combinedModels = [];
let modelMap = new Map();
let favoriteModelsByProvider = {
  openrouter: new Set(),
  naga: new Set()
};
let recentModelsByProvider = {
  openrouter: [],
  naga: []
};
let selectedCombinedModelId = null;
let sidebarSetupRequired = false;
let lastStreamContext = null;

function normalizeProviderSafe(providerId) {
  if (typeof normalizeProviderId === "function") {
    return normalizeProviderId(providerId);
  }
  return providerId === "naga" ? "naga" : "openrouter";
}

function getProviderLabelSafe(providerId) {
  if (typeof getProviderLabel === "function") {
    return getProviderLabel(providerId);
  }
  return normalizeProviderSafe(providerId) === "naga" ? "NagaAI" : "OpenRouter";
}

function getProviderStorageKeySafe(baseKey, providerId) {
  if (typeof getProviderStorageKey === "function") {
    return getProviderStorageKey(baseKey, providerId);
  }
  return normalizeProviderSafe(providerId) === "naga" ? `${baseKey}_naga` : baseKey;
}

function buildCombinedModelIdSafe(providerId, modelId) {
  if (typeof buildCombinedModelId === "function") {
    return buildCombinedModelId(providerId, modelId);
  }
  return `${normalizeProviderSafe(providerId)}:${modelId}`;
}

function parseCombinedModelIdSafe(combinedId) {
  if (typeof parseCombinedModelId === "function") {
    return parseCombinedModelId(combinedId);
  }
  if (!combinedId || typeof combinedId !== "string") {
    return { provider: "openrouter", modelId: "" };
  }
  const splitIndex = combinedId.indexOf(":");
  if (splitIndex === -1) {
    return { provider: "openrouter", modelId: combinedId };
  }
  const provider = normalizeProviderSafe(combinedId.slice(0, splitIndex));
  const modelId = combinedId.slice(splitIndex + 1);
  return { provider, modelId };
}

function getModelDisplayName(model) {
  return model?.displayName || model?.name || model?.id || "";
}

function setImageToggleUi(enabled, disabled = false) {
  if (!imageToggle) return;
  imageToggle.classList.toggle("active", enabled);
  imageToggle.setAttribute("aria-pressed", enabled.toString());
  imageToggle.setAttribute("aria-disabled", disabled ? "true" : "false");
  imageToggle.classList.toggle("disabled", disabled);
}

function setImageToggleTitle(title) {
  if (!imageToggle) return;
  imageToggle.title = title;
}

async function applyImageModeForModel() {
  setImageToggleUi(imageModeEnabled, false);
  setImageToggleTitle("Enable Image Mode");
}

function buildCombinedFavoritesList() {
  const combined = [];
  ["openrouter", "naga"].forEach((provider) => {
    const favorites = favoriteModelsByProvider[provider] || new Set();
    favorites.forEach((modelId) => {
      combined.push(buildCombinedModelIdSafe(provider, modelId));
    });
  });
  return combined;
}

function buildCombinedRecentList() {
  const combined = [];
  ["openrouter", "naga"].forEach((provider) => {
    const recents = recentModelsByProvider[provider] || [];
    recents.forEach((modelId) => {
      const combinedId = buildCombinedModelIdSafe(provider, modelId);
      if (!combined.includes(combinedId)) {
        combined.push(combinedId);
      }
    });
  });
  return combined;
}

function loadFavoritesAndRecents(localItems, syncItems) {
  favoriteModelsByProvider = {
    openrouter: new Set(syncItems.or_favorites || []),
    naga: new Set(syncItems.or_favorites_naga || [])
  };

  recentModelsByProvider = {
    openrouter: localItems.or_recent_models || [],
    naga: localItems.or_recent_models_naga || []
  };
}

async function refreshFavoritesOnly() {
  try {
    const syncItems = await chrome.storage.sync.get(["or_favorites", "or_favorites_naga"]);
    favoriteModelsByProvider = {
      openrouter: new Set(syncItems.or_favorites || []),
      naga: new Set(syncItems.or_favorites_naga || [])
    };

    if (modelDropdown) {
      modelDropdown.setFavorites(buildCombinedFavoritesList());
    }
  } catch (e) {
    console.warn("Failed to refresh favorites:", e);
  }
}

async function loadProviderSetting() {
  try {
    const stored = await getLocalStorage(["or_provider", "or_model_provider"]);
    currentProvider = normalizeProviderSafe(stored.or_model_provider || stored.or_provider);
  } catch (e) {
    console.warn("Failed to load provider setting:", e);
  }
}

// ---- Setup panel (no provider enabled) ----
function isProviderReady(localItems) {
  const openrouterEnabled = localItems.or_provider_enabled_openrouter !== false;
  const nagaEnabled = Boolean(localItems.or_provider_enabled_naga);
  const openrouterKey = typeof localItems.or_api_key === "string" ? localItems.or_api_key.trim() : "";
  const nagaKey = typeof localItems.naga_api_key === "string" ? localItems.naga_api_key.trim() : "";
  const openrouterReady = openrouterEnabled && Boolean(openrouterKey);
  const nagaReady = nagaEnabled && Boolean(nagaKey);
  return openrouterReady || nagaReady;
}

function updateSetupPanelVisibility(isReady) {
  sidebarSetupRequired = !isReady;
  if (setupPanel) {
    setupPanel.style.display = isReady ? "none" : "flex";
  }
  if (promptContainer) {
    promptContainer.style.display = isReady ? "" : "none";
  }
  if (modelSection) {
    modelSection.style.display = isReady ? "" : "none";
  }
  if (!isReady && modelStatusEl) {
    modelStatusEl.textContent = "Enable a provider to load models.";
  }
}

async function refreshSidebarSetupState() {
  const localItems = await getLocalStorage([
    "or_api_key",
    "naga_api_key",
    "or_provider_enabled_openrouter",
    "or_provider_enabled_naga"
  ]);
  const ready = isProviderReady(localItems);
  updateSetupPanelVisibility(ready);
  return ready;
}
// ---- Model dropdown manager ----
let modelDropdown = null;

// ---- Context visualization ----
let contextViz = null;

// ---- Active streaming port ----
let activePort = null;

async function refreshContextVisualization() {
  if (!contextViz) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id || 'default';
    const res = await chrome.runtime.sendMessage({
      type: "get_context_size",
      tabId
    });
    const size = res?.contextSize || 0;
    contextViz.update(size, 'assistant');
  } catch (e) {
    console.warn("Failed to refresh context visualization:", e);
    contextViz.update(0, 'assistant');
  }
}

// ---- Utility functions ----
// Token estimation using constants
function estimateTokens(text) {
  return Math.ceil(text.length / UI_CONSTANTS.CHARS_PER_TOKEN);
}

// ---- Answer visibility management ----
function updateAnswerVisibility() {
  const clearBtn = document.getElementById("clear-answer-btn");
  if (answerEl.innerHTML.trim() === "") {
    answerEl.classList.add("hidden");
    if (clearBtn) clearBtn.style.display = "none";
  } else {
    answerEl.classList.remove("hidden");
    if (clearBtn) clearBtn.style.display = "block";
  }
}

function showAnswerBox() {
  answerEl.classList.remove("hidden");
  const clearBtn = document.getElementById("clear-answer-btn");
  if (clearBtn) clearBtn.style.display = "block";
}

function setAnswerLoading(isLoading) {
  if (isLoading) {
    answerEl.classList.add("loading");
  } else {
    answerEl.classList.remove("loading");
  }
}

// ---- Sidepanel answer persistence ----
const ANSWER_CACHE_KEY_PREFIX = "or_sidepanel_answer_";
let answerPersistTimeout = null;

function getAnswerStorage() {
  if (chrome?.storage?.session) {
    return chrome.storage.session;
  }
  return chrome?.storage?.local || null;
}

async function getCurrentTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id || "default";
  } catch (e) {
    console.warn("Failed to resolve current tab id:", e);
    return "default";
  }
}

async function getSidepanelThreadId() {
  const tabId = await getCurrentTabId();
  return `sidepanel_${tabId}`;
}

function scheduleAnswerPersist() {
  if (answerPersistTimeout) {
    clearTimeout(answerPersistTimeout);
  }
  answerPersistTimeout = setTimeout(() => {
    answerPersistTimeout = null;
    persistAnswers().catch((e) => {
      console.warn("Failed to persist answers:", e);
    });
  }, 200);
}

async function persistAnswers() {
  if (!answerEl) return;
  const html = answerEl.innerHTML || "";
  const metaText = metaEl?.textContent || "";
  if (chatStore && typeof chatStore.putThread === "function") {
    const threadId = await getSidepanelThreadId();
    if (!html.trim()) {
      if (typeof chatStore.deleteThread === "function") {
        await chatStore.deleteThread(threadId);
      }
      return;
    }
    await chatStore.putThread({
      id: threadId,
      projectId: SIDEPANEL_PROJECT_ID,
      title: "Sidepanel",
      html,
      metaText,
      updatedAt: Date.now()
    });
    return;
  }
  const storage = getAnswerStorage();
  if (!storage) return;
  const tabId = await getCurrentTabId();
  const key = `${ANSWER_CACHE_KEY_PREFIX}${tabId}`;
  if (!html.trim()) {
    if (typeof storage.remove === "function") {
      await storage.remove([key]);
    } else {
      await storage.set({ [key]: null });
    }
    return;
  }
  await storage.set({ [key]: { html, metaText } });
}

async function restorePersistedAnswers() {
  if (!answerEl) return;
  if (chatStore && typeof chatStore.getThread === "function") {
    const threadId = await getSidepanelThreadId();
    const payload = await chatStore.getThread(threadId);
    if (payload?.html) {
      answerEl.innerHTML = payload.html;
      if (payload.metaText) {
        metaEl.textContent = payload.metaText;
      }
      updateAnswerVisibility();
    } else {
      answerEl.innerHTML = "";
      updateAnswerVisibility();
    }
    return;
  }
  const storage = getAnswerStorage();
  if (!storage) return;
  const tabId = await getCurrentTabId();
  const key = `${ANSWER_CACHE_KEY_PREFIX}${tabId}`;
  const stored = await storage.get([key]);
  const payload = stored?.[key];
  if (payload?.html) {
    answerEl.innerHTML = payload.html;
    if (payload.metaText) {
      metaEl.textContent = payload.metaText;
    }
    updateAnswerVisibility();
  } else {
    answerEl.innerHTML = "";
    updateAnswerVisibility();
  }
}

function closeExportMenus() {
  document.querySelectorAll('.export-menu').forEach(menu => menu.classList.remove('open'));
}

function buildStreamErrorHtml(message) {
  const safeMessage = escapeHtml(message || 'Unknown error');
  return `
    <div class="error-content">
      <div class="error-text">${safeMessage}</div>
      <div class="error-actions">
        <button class="retry-btn" type="button">Retry</button>
      </div>
    </div>
  `;
}

function renderSourcesSummary(answerItem, sources) {
  const summary = answerItem?.querySelector('.answer-sources-summary');
  if (!summary) return;
  summary.innerHTML = '';

  if (!sources || sources.length === 0 || typeof getUniqueDomains !== 'function') {
    return;
  }

  const uniqueDomains = getUniqueDomains(sources);
  const stack = document.createElement('div');
  stack.className = 'sources-favicon-stack';

  uniqueDomains.slice(0, 5).forEach((domain, index) => {
    const favicon = document.createElement('img');
    favicon.src = domain.favicon;
    favicon.alt = domain.domain;
    favicon.style.zIndex = String(5 - index);
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" fill=\"%23888\"><circle cx=\"8\" cy=\"8\" r=\"8\"/></svg>';
    };
    stack.appendChild(favicon);
  });

  const count = document.createElement('span');
  count.className = 'sources-count';
  count.textContent = `${sources.length} source${sources.length !== 1 ? 's' : ''}`;

  summary.appendChild(stack);
  summary.appendChild(count);
}

function exportAnswer(answerItem, format) {
  if (!answerItem) return;
  const answerContent = answerItem.querySelector('.answer-content');
  const text = answerContent?.innerText || answerContent?.textContent || '';
  const messages = [{ role: 'assistant', content: text }];

  if (format === 'markdown' && typeof exportMarkdownFile === 'function') {
    exportMarkdownFile(messages, 'answer.md');
  } else if (format === 'docx' && typeof exportDocx === 'function') {
    exportDocx(messages, 'answer.docx');
  } else if (format === 'pdf' && typeof exportPdf === 'function') {
    const html = answerContent?.innerHTML || '';
    exportPdf(html, 'answer');
  }
}

answerEl.addEventListener("click", (e) => {
  const target = e.target;

  // Handle copy button clicks
  const copyBtn = target.closest('.copy-answer-btn');
  if (copyBtn) {
    e.preventDefault();
    e.stopPropagation();
    const answerItem = copyBtn.closest('.answer-item');
    if (answerItem) {
      const answerContent = answerItem.querySelector('.answer-content');
      if (answerContent) {
        const text = answerContent.innerText || answerContent.textContent;

        // Check if clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          console.error('Clipboard API not available');
          showToast('Clipboard not supported in this browser', 'error');
          return;
        }

        navigator.clipboard.writeText(text).then(() => {
          // Visual feedback
          const originalColor = copyBtn.style.color;
          copyBtn.style.color = 'var(--color-success)';
          copyBtn.setAttribute('aria-label', 'Copied to clipboard');
          setTimeout(() => {
            copyBtn.style.color = originalColor;
            copyBtn.setAttribute('aria-label', 'Copy answer to clipboard');
          }, UI_CONSTANTS.COPY_FEEDBACK_DURATION);
          showToast('Answer copied to clipboard', 'success');
        }).catch(err => {
          console.error('Failed to copy:', err);
          // More specific error messages
          if (err.name === 'NotAllowedError') {
            showToast('Permission denied. Please allow clipboard access.', 'error');
          } else if (err.name === 'SecurityError') {
            showToast('Cannot copy from insecure context', 'error');
          } else {
            showToast('Failed to copy to clipboard', 'error');
          }
        });
      }
    }
    return;
  }

  const exportBtn = target.closest('.export-btn');
  if (exportBtn) {
    e.preventDefault();
    e.stopPropagation();
    const menu = exportBtn.closest('.export-menu');
    if (menu) {
      const isOpen = menu.classList.contains('open');
      closeExportMenus();
      if (!isOpen) {
        menu.classList.add('open');
      }
    }
    return;
  }

  const exportOption = target.closest('.export-option');
  if (exportOption) {
    e.preventDefault();
    e.stopPropagation();
    const format = exportOption.getAttribute('data-format');
    const answerItem = exportOption.closest('.answer-item');
    exportAnswer(answerItem, format);
    closeExportMenus();
    return;
  }

  // Handle link clicks
  if (target && target.tagName === "A") {
    e.preventDefault();
    const href = target.getAttribute("href");
    if (href) {
      chrome.tabs.create({ url: href });
    }
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-menu')) {
    closeExportMenus();
  }
});

// ---- Input validation and sanitization ----
// Note: escapeHtml() and validateUrl() are now in utils.js

function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return "";
  // Trim and limit length
  const trimmed = prompt.trim();
  const maxLength = 10000; // Reasonable limit
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function getImageExtension(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

function getImageViewerBaseUrl() {
  if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
    return chrome.runtime.getURL("src/image-viewer/image-viewer.html");
  }
  return "";
}

function openImageInNewTab(dataUrl, imageId) {
  if (!dataUrl) return;
  const viewerBaseUrl = getImageViewerBaseUrl();
  const openUrl = typeof buildImageOpenUrl === "function"
    ? buildImageOpenUrl(dataUrl, imageId || "", viewerBaseUrl)
    : dataUrl;

  chrome.tabs.create({ url: openUrl }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      console.warn("Failed to open image:", chrome.runtime.lastError.message);
      if (typeof showToast === "function") {
        showToast("Unable to open image in a new tab.", "error");
      }
    }
  });
}

function downloadImage(dataUrl, imageId, mimeType) {
  if (!dataUrl) return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `wegweiser-image-${imageId}.${getImageExtension(mimeType)}`;
  link.click();
}

// ---- Balance handling ----
async function refreshBalance() {
  if (!balanceEl) return;

  balanceEl.textContent = "Loading…";
  try {
    const res = await chrome.runtime.sendMessage({ type: "get_balance" });
    if (!res?.ok) {
      balanceEl.textContent = res?.error || "Error";
      return;
    }

    if (res.supported === false) {
      balanceEl.textContent = "Not supported";
      return;
    }

    const value = res.balance;
    if (value == null || Number.isNaN(value)) {
      balanceEl.textContent = "Unknown";
    } else {
      balanceEl.textContent = `$${value.toFixed(4)}`;
    }
  } catch (e) {
    console.error("Error refreshing balance:", e);
    balanceEl.textContent = "Error";
  }
}

if (balanceRefreshBtn) {
  balanceRefreshBtn.addEventListener("click", refreshBalance);
}

async function generateImage(prompt) {
  askBtn.disabled = true;
  setPromptStreamingState(false);
  metaEl.textContent = "🖼️ Generating image...";

  showAnswerBox();

  const answerItem = document.createElement("div");
  answerItem.className = "answer-item";
  answerItem.innerHTML = `
    <div class="answer-meta">
      <span>${new Date().toLocaleTimeString()} - Image</span>
    </div>
    <div class="answer-content"></div>
  `;

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
    const parsed = parseCombinedModelIdSafe(selectedCombinedModelId || "");
    const provider = normalizeProviderSafe(parsed.provider || currentProvider);
    const modelId = parsed.modelId || "";

    const res = await chrome.runtime.sendMessage({
      type: "image_query",
      prompt,
      provider,
      model: modelId
    });

    if (!res?.ok) {
      const errorMessage = res?.error || "Failed to generate image.";
      if (answerContent && typeof buildImageCard === "function") {
        answerContent.innerHTML = "";
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
      await putImageCacheEntry({
        imageId,
        mimeType,
        dataUrl,
        createdAt: Date.now()
      });
    }

    let resolvedDataUrl = dataUrl;
    if (typeof getImageCacheEntry === "function") {
      const cached = await getImageCacheEntry(imageId);
      resolvedDataUrl = cached?.dataUrl || cached?.data || resolvedDataUrl;
    }

    if (answerContent && typeof buildImageCard === "function") {
      if (!resolvedDataUrl) {
        answerContent.innerHTML = "";
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
      answerContent.innerHTML = "";
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
      answerContent.innerHTML = "";
      answerContent.appendChild(buildImageCard({ state: "error" }));
    } else if (answerContent) {
      answerContent.textContent = e?.message || String(e);
    }
    metaEl.textContent = "❌ Failed to generate image.";
  } finally {
    askBtn.disabled = false;
  }
}

// ---- Ask function with real-time streaming ----
async function askQuestion() {
  const rawPrompt = promptEl.value;
  const prompt = sanitizePrompt(rawPrompt);

  if (!prompt) {
    metaEl.textContent = "Enter a prompt first.";
    return;
  }

  if (prompt.length >= 10000) {
    metaEl.textContent = "⚠️ Prompt truncated to 10,000 characters.";
  }

  // Disconnect any active port first
  if (activePort) {
    try {
      activePort.disconnect();
    } catch (e) {
      // Ignore errors
    }
    activePort = null;
  }

  if (imageModeEnabled) {
    if (typeof clearPromptAfterSend === "function") {
      clearPromptAfterSend(promptEl);
    } else {
      promptEl.value = "";
      promptEl.style.height = "auto";
    }
    await generateImage(prompt);
    return;
  }

  askBtn.disabled = true;
  setPromptStreamingState(true);

  // Step 1: Show preparation
  metaEl.textContent = "🔄 Preparing request...";

  // Move typing indicator to bottom of answer section
  showAnswerBox();
  answerEl.appendChild(typingIndicator);
  showTypingIndicator();
  answerSection.scrollTop = answerSection.scrollHeight;

  try {
    // Get current tab ID for conversation context
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id || 'default';

    // Get current context size for display
    const currentContextMsg = await chrome.runtime.sendMessage({
      type: "get_context_size",
      tabId
    });
    const contextSize = currentContextMsg?.contextSize || 0;
    const contextInfo = contextSize > 0 ? ` (with ${Math.floor(contextSize / 2)} previous Q&A)` : '';

    // Show "Thinking..." if reasoning is enabled
    if (reasoningEnabled) {
      metaEl.textContent = `💭 Thinking${contextInfo}...`;
    } else {
      metaEl.textContent = `📤 Streaming response${contextInfo}...`;
    }

    // Create answer item for streaming
    const answerItem = document.createElement("div");
    answerItem.className = "answer-item";
    const contextBadge = contextSize > 2 ? `<span class="answer-context-badge" title="${contextSize} messages in conversation context">🧠 ${Math.floor(contextSize / 2)} Q&A</span>` : '';

    answerItem.innerHTML = `
      <div class="answer-meta">
        <span>${new Date().toLocaleTimeString()} - Streaming...</span>
      </div>
      ${reasoningEnabled ? '<div class="reasoning-content" style="margin-bottom: 12px;" role="region" aria-label="Reasoning steps"></div>' : ''}
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
    `;

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
      wrapper.innerHTML = `
        <div style="padding: 12px; background: var(--color-bg-tertiary); border-left: 3px solid var(--color-topic-5); border-radius: 4px;">
          <div class="reasoning-header" style="font-size: 12px; font-weight: 600; color: var(--color-topic-5); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span>💭</span>
            <span>Thinking...</span>
          </div>
          <div class="reasoning-text" style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap;"></div>
        </div>
      `;
      const answerContentEl = answerItem.querySelector(".answer-content");
      if (answerContentEl) {
        answerContentEl.before(wrapper);
      } else {
        answerItem.appendChild(wrapper);
      }
      reasoningContent = wrapper;
    };

    // Setup reasoning display if enabled
    if (reasoningEnabled && reasoningContent) {
      reasoningContent.innerHTML = `
        <div style="padding: 12px; background: var(--color-bg-tertiary); border-left: 3px solid var(--color-topic-5); border-radius: 4px;">
          <div class="reasoning-header" style="font-size: 12px; font-weight: 600; color: var(--color-topic-5); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span>💭</span>
            <span>Thinking...</span>
          </div>
          <div class="reasoning-text" style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap;"></div>
        </div>
      `;
    }

    const streamContext = {
      prompt,
      tabId,
      contextSize,
      webSearch: webSearchEnabled,
      reasoning: reasoningEnabled,
      selectedCombinedModelId,
      currentProvider
    };
    lastStreamContext = streamContext;

    const resetAnswerForRetry = () => {
      answerContent.innerHTML = '';
      const metaSpan = answerMeta.querySelector('span');
      if (metaSpan) {
        metaSpan.textContent = `${new Date().toLocaleTimeString()} - Streaming...`;
      }
      const timeSpan = answerItem.querySelector(".answer-time");
      const tokensSpan = answerItem.querySelector(".answer-tokens");
      const tokenBar = answerItem.querySelector(".token-usage-fill");
      if (timeSpan) timeSpan.textContent = '--s';
      if (tokensSpan) tokensSpan.textContent = '-- tokens';
      if (tokenBar) {
        tokenBar.style.width = '0%';
        tokenBar.style.background = '';
      }
      const progressBar = answerItem.querySelector(".token-usage-bar");
      if (progressBar) {
        progressBar.setAttribute('aria-valuenow', '0');
      }
      const sourcesSummary = answerItem.querySelector(".answer-sources-summary");
      if (sourcesSummary) {
        sourcesSummary.innerHTML = '';
      }
      if (typeof removeReasoningBubbles === "function") {
        removeReasoningBubbles(answerItem);
      }
      if (streamContext.reasoning) {
        ensureReasoningSection();
        if (reasoningContent) {
          reasoningContent.innerHTML = `
            <div style="padding: 12px; background: var(--color-bg-tertiary); border-left: 3px solid var(--color-topic-5); border-radius: 4px;">
              <div class="reasoning-header" style="font-size: 12px; font-weight: 600; color: var(--color-topic-5); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>💭</span>
                <span>Thinking...</span>
              </div>
              <div class="reasoning-text" style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap;"></div>
            </div>
          `;
        }
      } else if (reasoningContent) {
        reasoningContent.remove();
        reasoningContent = null;
      }
    };

    const renderStreamError = (message, statusText) => {
      answerContent.innerHTML = buildStreamErrorHtml(message);
      const retryBtn = answerContent.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          if (activePort) return;
          retryBtn.disabled = true;
          resetAnswerForRetry();
          startStream({ retry: true });
        });
      }
      const metaSpan = answerMeta.querySelector('span');
      if (metaSpan) {
        metaSpan.textContent = `Error - ${new Date().toLocaleTimeString()}`;
      }
      metaEl.textContent = statusText || `❌ Error from ${getProviderLabelSafe(currentProvider)}.`;
      hideTypingIndicator();
      updateAnswerVisibility();
      answerSection.scrollTop = answerSection.scrollHeight;
    };

    const startStream = ({ retry = false } = {}) => {
      let reasoningText = reasoningContent?.querySelector(".reasoning-text");
      let reasoningHeader = reasoningContent?.querySelector(".reasoning-header");
      let fullAnswer = '';
      let hasCompleted = false;
      let hasError = false;
      let currentModel = '';
      let finalTokens = null;
      let finalContextSize = streamContext.contextSize;
      let hasReceivedReasoning = false;
      const reasoningStreamState = { inReasoning: false, carry: "" };
      const streamStartTime = Date.now();

      if (retry) {
        const contextInfo = streamContext.contextSize > 0 ? ` (with ${Math.floor(streamContext.contextSize / 2)} previous Q&A)` : '';
        metaEl.textContent = `🔁 Retrying${contextInfo}...`;
      }

      // Connect via Port for streaming
      const port = chrome.runtime.connect({ name: 'streaming' });
      activePort = port;
      askBtn.disabled = true;
      setPromptStreamingState(true);

      port.postMessage({
        type: 'start_stream',
        prompt: streamContext.prompt,
        webSearch: streamContext.webSearch,
        reasoning: streamContext.reasoning,
        tabId: streamContext.tabId,
        retry: retry === true
      });

      // Handle port disconnection (e.g., when stopped)
      port.onDisconnect.addListener(() => {
        activePort = null;
        setPromptStreamingState(false);
        askBtn.disabled = false;

        if (!hasCompleted && !hasError) {
          const fallbackMessage = typeof getStreamingFallbackMessage === 'function'
            ? getStreamingFallbackMessage(fullAnswer, hasReceivedReasoning)
            : null;
          if (fallbackMessage) {
            renderStreamError(fallbackMessage, "⚠️ Stream ended without an answer.");
          }
        }
      });

      port.onMessage.addListener((msg) => {
        console.log('[Port] Received message type:', msg.type, 'fullAnswer length:', fullAnswer.length);
        if (msg.type === 'reasoning' && msg.reasoning) {
          ensureReasoningSection();
          reasoningText = reasoningContent?.querySelector(".reasoning-text");
          reasoningHeader = reasoningContent?.querySelector(".reasoning-header");
          if (reasoningText) {
            // Stream reasoning in real-time
            hasReceivedReasoning = true;
            // Change "Thinking..." to "Reasoning:" once we receive content
            if (reasoningHeader && reasoningHeader.textContent.includes('Thinking')) {
              reasoningHeader.innerHTML = '<span>💭</span><span>Reasoning:</span>';
            }
            reasoningText.textContent += msg.reasoning;
            answerSection.scrollTop = answerSection.scrollHeight;
          }
        } else if (msg.type === 'content' && msg.content) {
          try {
            // Stream content in real-time
            let contentChunk = msg.content;
            let reasoningChunk = "";
            if (typeof extractReasoningFromStreamChunk === "function") {
              const parsed = extractReasoningFromStreamChunk(reasoningStreamState, contentChunk);
              contentChunk = parsed.content;
              reasoningChunk = parsed.reasoning;
            }

            if (reasoningChunk) {
              ensureReasoningSection();
              reasoningText = reasoningContent?.querySelector(".reasoning-text");
              reasoningHeader = reasoningContent?.querySelector(".reasoning-header");
              if (reasoningText) {
                hasReceivedReasoning = true;
                if (reasoningHeader && reasoningHeader.textContent.includes('Thinking')) {
                  reasoningHeader.innerHTML = '<span>💭</span><span>Reasoning:</span>';
                }
                reasoningText.textContent += reasoningChunk;
                answerSection.scrollTop = answerSection.scrollHeight;
              }
            }

            if (!contentChunk) {
              return;
            }

            fullAnswer += contentChunk;

            // Extract sources and render
            const { sources, cleanText } = extractSources(fullAnswer);
            // Note: applyMarkdownStyles handles escaping internally via markdownToHtml
            const renderedHTML = applyMarkdownStyles(cleanText);

            answerContent.innerHTML = renderedHTML;

            // Note: Sources are rendered in the completion handler, not during streaming
            // to avoid them being overwritten by subsequent innerHTML updates

            answerSection.scrollTop = answerSection.scrollHeight;
          } catch (e) {
            console.error('[UI] Error rendering content:', e);
            answerContent.innerHTML = `<div style="color: red;">Error rendering: ${e.message}</div>`;
          }
        } else if (msg.type === 'complete') {
          // Stream complete
          console.log('[Port] Completion received! fullAnswer length:', fullAnswer.length, 'tokens:', msg.tokens);
          hasCompleted = true;
          const elapsedTime = ((Date.now() - streamStartTime) / 1000).toFixed(2);
          const selectedModel = streamContext.selectedCombinedModelId ? modelMap.get(streamContext.selectedCombinedModelId) : null;
          currentModel = selectedModel ? getModelDisplayName(selectedModel) : (msg.model || 'default model');
          finalTokens = msg.tokens;
          finalContextSize = msg.contextSize;

          // Update meta and footer
          const metaSpan = answerMeta.querySelector('span');
          if (metaSpan) {
            metaSpan.textContent = `${new Date().toLocaleTimeString()} - ${currentModel}`;
          }
          const timeSpan = answerItem.querySelector(".answer-time");
          const tokensSpan = answerItem.querySelector(".answer-tokens");
          const tokenBar = answerItem.querySelector(".token-usage-fill");
          if (timeSpan) timeSpan.textContent = `${elapsedTime}s`;
          if (tokensSpan) tokensSpan.textContent = `${finalTokens || '—'} tokens`;

          // Update token usage bar using constants
          if (tokenBar && finalTokens) {
            const percentage = Math.min((finalTokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) * 100, 100);
            tokenBar.style.width = `${percentage}%`;

            // Update progress bar aria attributes
            const progressBar = answerItem.querySelector(".token-usage-bar");
            if (progressBar) {
              progressBar.setAttribute('aria-valuenow', Math.round(percentage));
            }

            // Color based on usage: green < 50%, yellow < 80%, red >= 80%
            if (percentage < 50) {
              tokenBar.style.background = 'linear-gradient(90deg, var(--color-success), #16a34a)';
            } else if (percentage < 80) {
              tokenBar.style.background = 'linear-gradient(90deg, var(--color-warning), #ca8a04)';
            } else {
              tokenBar.style.background = 'linear-gradient(90deg, var(--color-error), #dc2626)';
            }
          }

          // Update context badge
          if (finalContextSize > 2) {
            const badge = answerItem.querySelector(".answer-context-badge");
            if (badge) {
              badge.textContent = `🧠 ${Math.floor(finalContextSize / 2)} Q&A`;
              badge.title = `${finalContextSize} messages in conversation context`;
            }
          }

          if (typeof removeReasoningBubbles === "function") {
            removeReasoningBubbles(answerItem);
          }

          // Ensure answer content is visible (final render)
          if (fullAnswer) {
            const { sources, cleanText } = extractSources(fullAnswer);
            // Note: applyMarkdownStyles handles escaping internally
            answerContent.innerHTML = applyMarkdownStyles(cleanText);

            // Add sources indicator if any
            if (sources.length > 0) {
              // Make [number] references clickable
              makeSourceReferencesClickable(answerContent, sources);

              // Add compact sources indicator button
              const sourcesIndicator = createSourcesIndicator(sources, answerEl);
              if (sourcesIndicator) {
                answerContent.appendChild(sourcesIndicator);
              }
            }

            renderSourcesSummary(answerItem, sources);
          }

          // Update context viz
          if (contextViz && finalContextSize) {
            try {
              contextViz.update(finalContextSize, 'assistant');
            } catch (e) {
              console.error('[UI] Error updating context viz:', e);
            }
          }

          metaEl.textContent = `✅ Answer received using ${currentModel}.`;
          port.disconnect();
          activePort = null;
          setPromptStreamingState(false);
        } else if (msg.type === 'error') {
          // Handle error
          hasError = true;
          renderStreamError(msg.error, `❌ Error from ${getProviderLabelSafe(currentProvider)}.`);
          port.disconnect();
          activePort = null;
          setPromptStreamingState(false);
        }
      });
    };

    startStream();

    // Clear the prompt for next question
    if (typeof clearPromptAfterSend === "function") {
      clearPromptAfterSend(promptEl);
    } else {
      promptEl.value = "";
      promptEl.style.height = 'auto';
    }
    // Hide estimated cost
    estimatedCostEl.style.display = 'none';

    // Update balance
    await refreshBalance();
  } catch (e) {
    console.error("Error sending query:", e);
    hideTypingIndicator();
    const errorHtml = `<div class="answer-item error-item">
      <div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div>
      <div class="answer-content">${escapeHtml(e?.message || String(e))}</div>
    </div>`;
    answerEl.insertAdjacentHTML('beforeend', errorHtml);
    updateAnswerVisibility();
    metaEl.textContent = "❌ Failed to send request.";
    answerSection.scrollTop = answerSection.scrollHeight;
  } finally {
    if (!activePort) {
      askBtn.disabled = false;
      setPromptStreamingState(false);
    }
  }
}

// ---- Ask button ----
askBtn.addEventListener("click", askQuestion);

// ---- Stop button ----
stopBtn.addEventListener("click", () => {
  if (activePort) {
    activePort.disconnect();
    activePort = null;
    setPromptStreamingState(false);
    askBtn.disabled = false;
    metaEl.textContent = "⚠️ Generation stopped by user.";
    hideTypingIndicator();
    showToast('Generation stopped', 'info');
  }
});

// ---- Summarize Page button ----
const summarizeBtn = document.getElementById("summarizeBtn");
if (summarizeBtn) {
  summarizeBtn.addEventListener("click", async () => {
    // Track start time
    const startTime = Date.now();

    // Disable button during processing
    summarizeBtn.disabled = true;
    askBtn.disabled = true;

    // Step 1: Show preparation
    metaEl.textContent = "🔄 Extracting page content...";

    // Move typing indicator to bottom of answer section
    showAnswerBox();
    answerEl.appendChild(typingIndicator);
    showTypingIndicator();
    answerSection.scrollTop = answerSection.scrollHeight;

    try {
      // Get current tab ID
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        throw new Error("Could not get active tab");
      }

      // Step 2: Sending to provider
      metaEl.textContent = `📤 Sending to ${getProviderLabelSafe(currentProvider)} for summarization (this may take longer for large pages)...`;
      await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause for UX

      const res = await chrome.runtime.sendMessage({
        type: "summarize_page",
        tabId,
        webSearch: webSearchEnabled,
        reasoning: reasoningEnabled
      });

      // Step 3: Processing response
      metaEl.textContent = "⚙️ Processing response...";
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause for UX

      hideTypingIndicator();

      // Calculate elapsed time
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!res?.ok) {
        // Check if permission is needed
        if (res?.requiresPermission && res?.url) {
          metaEl.textContent = "🔐 Requesting permission to access page...";

          // Request permission
          const permResponse = await chrome.runtime.sendMessage({
            type: "request_permission",
            url: res.url
          });

          if (permResponse?.ok && permResponse?.granted) {
            // Permission granted, retry the summarization
            metaEl.textContent = "✅ Permission granted! Retrying...";
            toast.success("Permission granted! Retrying page summarization...");

            // Wait a bit for user feedback
            await new Promise(resolve => setTimeout(resolve, 500));

            // Retry the summarization
            showTypingIndicator();
            metaEl.textContent = `📤 Sending to ${getProviderLabelSafe(currentProvider)} for summarization...`;

            const retryRes = await chrome.runtime.sendMessage({
              type: "summarize_page",
              tabId,
              webSearch: webSearchEnabled,
              reasoning: reasoningEnabled
            });

            hideTypingIndicator();

            if (!retryRes?.ok) {
              const errorHtml = `<div class="answer-item error-item">
                <div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div>
                <div class="answer-content">${escapeHtml(retryRes?.error || "Unknown error")}</div>
              </div>`;
              answerEl.insertAdjacentHTML('beforeend', errorHtml);
              updateAnswerVisibility();
              metaEl.textContent = "❌ Error summarizing page.";
              answerSection.scrollTop = answerSection.scrollHeight;
              summarizeBtn.disabled = false;
              askBtn.disabled = false;
              return;
            }

            // Use the retry response for rendering
            res.ok = retryRes.ok;
            res.answer = retryRes.answer;
            res.model = retryRes.model;
            res.tokens = retryRes.tokens;
            res.contextSize = retryRes.contextSize;
          } else {
            // Permission denied
            const errorHtml = `<div class="answer-item error-item">
              <div class="answer-meta">Permission Denied - ${new Date().toLocaleTimeString()}</div>
              <div class="answer-content">You need to grant permission for this extension to access the page content. Please click "Summarize Page" again and allow access when prompted.</div>
            </div>`;
            answerEl.insertAdjacentHTML('beforeend', errorHtml);
            updateAnswerVisibility();
            metaEl.textContent = "❌ Permission denied.";
            toast.error("Permission denied. Click Summarize Page again to retry.");
            answerSection.scrollTop = answerSection.scrollHeight;
            summarizeBtn.disabled = false;
            askBtn.disabled = false;
            return;
          }
        } else {
          // Regular error
          const errorHtml = `<div class="answer-item error-item">
            <div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div>
            <div class="answer-content">${escapeHtml(res?.error || "Unknown error")}</div>
          </div>`;
          answerEl.insertAdjacentHTML('beforeend', errorHtml);
          updateAnswerVisibility();
          metaEl.textContent = "❌ Error summarizing page.";
          answerSection.scrollTop = answerSection.scrollHeight;
          summarizeBtn.disabled = false;
          askBtn.disabled = false;
          return;
        }
      }

      if (res?.ok) {
        // Step 4: Rendering answer
        metaEl.textContent = "✨ Rendering summary...";

        // Create new answer item
        const answerItem = document.createElement("div");
        answerItem.className = "answer-item";
        const contextBadge = res.contextSize > 2 ? `<span class="answer-context-badge" title="${res.contextSize} messages in conversation context">🧠 ${Math.floor(res.contextSize / 2)} Q&A</span>` : '';
        const summaryModel = selectedCombinedModelId ? getModelDisplayName(modelMap.get(selectedCombinedModelId)) : (res.model || "default model");
        answerItem.innerHTML = `
          <div class="answer-meta">
            <span>📄 Page Summary - ${new Date().toLocaleTimeString()} - ${summaryModel}</span>
          </div>
          <div class="answer-content"></div>
          <div class="answer-footer">
            <div class="answer-stats">
              <span class="answer-time">${elapsedTime}s</span>
              <span class="answer-tokens">${res.tokens || '—'} tokens</span>
              ${contextBadge}
            </div>
            <div class="token-usage-bar" role="progressbar" aria-valuenow="${res.tokens ? Math.round(Math.min((res.tokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) * 100, 100)) : 0}" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
              <div class="token-usage-fill" style="width: ${res.tokens ? Math.min((res.tokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) * 100, 100) : 0}%; background: ${res.tokens && (res.tokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) < 0.5 ? 'linear-gradient(90deg, var(--color-success), #16a34a)' : res.tokens && (res.tokens / UI_CONSTANTS.TOKEN_BAR_MAX_TOKENS) < 0.8 ? 'linear-gradient(90deg, var(--color-warning), #ca8a04)' : 'linear-gradient(90deg, var(--color-error), #dc2626)'};"></div>
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
        `;
        answerEl.appendChild(answerItem);

        const answerContent = answerItem.querySelector(".answer-content");

        // Extract sources and clean the answer text
        const fullAnswer = res.answer;
        const { sources, cleanText } = extractSources(fullAnswer);

        // Use optimized streaming render (applies markdown once at end)
        await renderStreamingText(answerContent, cleanText);

        updateAnswerVisibility();

        // Display context info in meta
        const contextInfo = res.contextSize > 2 ? ` (${Math.floor(res.contextSize / 2)} previous Q&A in context)` : '';
        metaEl.textContent = `✅ Page summarized using ${summaryModel}${contextInfo}.`;

        // Update context visualization
        if (contextViz && res.contextSize) {
          contextViz.update(res.contextSize, 'assistant');
        }

        // Display sources indicator and make [number] references clickable
        if (sources.length > 0) {
          // Make [number] references in the answer clickable
          makeSourceReferencesClickable(answerContent, sources);

          // Add sources indicator at the bottom
          const sourcesIndicator = createSourcesIndicator(sources, answerItem);
          if (sourcesIndicator) {
            answerItem.appendChild(sourcesIndicator);
          }
        }

        renderSourcesSummary(answerItem, sources);

        // Show success toast
        toast.success(`Page summarized using ${summaryModel}`);

        // Scroll to bottom to show newest answer
        answerSection.scrollTop = answerSection.scrollHeight;

        // Update balance
        await refreshBalance();
      }
    } catch (e) {
      console.error("Error summarizing page:", e);
      hideTypingIndicator();
      const errorHtml = `<div class="answer-item error-item">
        <div class="answer-meta">Error - ${new Date().toLocaleTimeString()}</div>
        <div class="answer-content">${escapeHtml(e?.message || String(e))}</div>
      </div>`;
      answerEl.insertAdjacentHTML('beforeend', errorHtml);
      updateAnswerVisibility();
      metaEl.textContent = "❌ Failed to summarize page.";
      answerSection.scrollTop = answerSection.scrollHeight;
    } finally {
      summarizeBtn.disabled = false;
      askBtn.disabled = false;
    }
  });
}

// ---- Auto-resize textarea ----
function autoResizeTextarea() {
  // Reset height to auto to get the correct scrollHeight
  promptEl.style.height = 'auto';
  // Set height to scrollHeight, using constants for limits
  const newHeight = Math.min(promptEl.scrollHeight, UI_CONSTANTS.TEXTAREA_MAX_HEIGHT);
  promptEl.style.height = newHeight + 'px';
}

// Update token estimation display
function updateTokenEstimation() {
  const text = promptEl.value.trim();
  if (text.length > 0) {
    const tokens = estimateTokens(text);
    estimatedCostEl.textContent = `~${tokens} tokens`;
    estimatedCostEl.style.display = 'block';
  } else {
    estimatedCostEl.style.display = 'none';
  }
}

// Create debounced version for performance
const debouncedTokenEstimation = typeof debounce === 'function'
  ? debounce(updateTokenEstimation, UI_CONSTANTS.DEBOUNCE_DELAY)
  : updateTokenEstimation;

// Auto-resize on input and show estimated cost
promptEl.addEventListener("input", () => {
  autoResizeTextarea(); // Always resize immediately for better UX
  debouncedTokenEstimation(); // Debounce token calculation
});

// ---- Keyboard shortcuts ----
promptEl.addEventListener("keydown", (e) => {
  // Ctrl/Cmd+Enter to send
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    askQuestion();
    return;
  }

  // Enter to send (Shift+Enter for new line)
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askQuestion();
  }
});

// Global keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + K to clear answers
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    const clearBtn = document.getElementById("clear-answer-btn");
    if (clearBtn && clearBtn.style.display !== "none") {
      clearBtn.click();
    }
  }

  // Escape to focus prompt input
  if (e.key === "Escape") {
    promptEl.focus();
  }

  // Ctrl/Cmd + / for help (show available shortcuts)
  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    e.preventDefault();
    metaEl.textContent = "⌨️ Shortcuts: Enter=Send | Shift+Enter=New Line | Ctrl+K=Clear | Esc=Focus Input";
    setTimeout(() => {
      metaEl.textContent = "";
    }, 5000);
  }
});

// ---- Model loading and selection ----
async function loadModels() {
  try {
    if (sidebarSetupRequired) {
      modelStatusEl.textContent = "Enable a provider to load models.";
      return;
    }
    modelStatusEl.textContent = "Loading models...";
    const res = await chrome.runtime.sendMessage({ type: "get_models" });

    if (!res?.ok) {
      modelStatusEl.textContent = res?.error || "Failed to load models";
      return;
    }

    combinedModels = res.models || [];
    modelMap = new Map(combinedModels.map((model) => [model.id, model]));

    const [localItems, syncItems] = await Promise.all([
      getLocalStorage(["or_recent_models", "or_recent_models_naga"]),
      chrome.storage.sync.get(["or_favorites", "or_favorites_naga"])
    ]);
    loadFavoritesAndRecents(localItems, syncItems);

    const resolvedModelInput = modelInput || document.getElementById("model-input");
    if (!resolvedModelInput) {
      modelStatusEl.textContent = "Model input unavailable.";
      return;
    }

    if (!modelDropdown) {
      modelDropdown = new ModelDropdownManager({
        inputElement: resolvedModelInput,
        containerType: 'sidebar',
        preferProvidedRecents: true,
        onModelSelect: async (modelId) => {
          const debugDropdown = Boolean(window.DEBUG_MODEL_DROPDOWN);
          const selectedModel = modelMap.get(modelId);
          const displayName = selectedModel ? getModelDisplayName(selectedModel) : modelId;
          const parsed = parseCombinedModelIdSafe(modelId);
          const provider = normalizeProviderSafe(parsed.provider);

          if (debugDropdown) {
            console.log('[ModelSelect]', {
              modelId,
              parsed,
              provider,
              displayName,
              modelExists: Boolean(selectedModel)
            });
          }

          if (modelInput) {
            modelInput.value = displayName;
          }

          try {
            const res = await chrome.runtime.sendMessage({
              type: "set_model",
              model: parsed.modelId,
              provider
            });

            if (debugDropdown) {
              console.log('[ModelSelect] response', res);
            }

          if (res?.ok) {
            selectedCombinedModelId = modelId;
            currentProvider = provider;
            modelStatusEl.textContent = `Using: ${displayName}`;
            await applyImageModeForModel();
            return true;
          }

            modelStatusEl.textContent = "Failed to set model";
            return false;
          } catch (e) {
            console.error("Error setting model:", e);
            if (debugDropdown) {
              console.log('[ModelSelect] error', e);
            }
            modelStatusEl.textContent = "Error setting model";
            return false;
          }
        },
        onToggleFavorite: async (modelId, isFavorite) => {
          const parsed = parseCombinedModelIdSafe(modelId);
          const provider = normalizeProviderSafe(parsed.provider);
          const rawId = parsed.modelId;

          if (!favoriteModelsByProvider[provider]) {
            favoriteModelsByProvider[provider] = new Set();
          }

          if (isFavorite) {
            favoriteModelsByProvider[provider].add(rawId);
          } else {
            favoriteModelsByProvider[provider].delete(rawId);
          }

          await chrome.storage.sync.set({
            [getProviderStorageKeySafe("or_favorites", provider)]: Array.from(favoriteModelsByProvider[provider])
          });
        },
        onAddRecent: async (modelId) => {
          const parsed = parseCombinedModelIdSafe(modelId);
          const provider = normalizeProviderSafe(parsed.provider);
          const rawId = parsed.modelId;

          const current = recentModelsByProvider[provider] || [];
          const next = [rawId, ...current.filter(id => id !== rawId)].slice(0, 5);
          recentModelsByProvider[provider] = next;

          await setLocalStorage({
            [getProviderStorageKeySafe("or_recent_models", provider)]: next
          });

          modelDropdown.setRecentlyUsed(buildCombinedRecentList());
        }
      });
    } else {
      modelDropdown.bindInput(resolvedModelInput);
    }

    modelDropdown.setModels(combinedModels);
    modelDropdown.setFavorites(buildCombinedFavoritesList());
    modelDropdown.setRecentlyUsed(buildCombinedRecentList());

    const cfgRes = await chrome.runtime.sendMessage({ type: "get_config" });
    if (cfgRes?.ok && cfgRes.config?.model) {
      const provider = normalizeProviderSafe(cfgRes.config.modelProvider || cfgRes.config.provider);
      const combinedId = buildCombinedModelIdSafe(provider, cfgRes.config.model);
      const selected = modelMap.get(combinedId);
      const displayName = selected ? getModelDisplayName(selected) : combinedId;

      currentProvider = provider;
      selectedCombinedModelId = combinedId;
      if (modelInput) {
        modelInput.value = displayName;
      }
      modelStatusEl.textContent = `Using: ${displayName}`;
      await applyImageModeForModel();
    } else {
      modelStatusEl.textContent = "Ready";
      await applyImageModeForModel();
    }
  } catch (e) {
    console.error("Error loading models:", e);
    modelStatusEl.textContent = "Error loading models";
    await applyImageModeForModel();
  }
}

// ---- Web Search and Reasoning toggles ----
async function loadToggleSettings() {
  try {
    const settings = await getLocalStorage([
      "or_web_search",
      "or_reasoning",
      "imageModeEnabled",
      "webSearchEnabled",
      "reasoningEnabled"
    ]);
    const legacyWebSearch = settings.webSearchEnabled;
    const legacyReasoning = settings.reasoningEnabled;
    webSearchEnabled = Boolean(
      settings.or_web_search !== undefined ? settings.or_web_search : legacyWebSearch
    );
    reasoningEnabled = Boolean(
      settings.or_reasoning !== undefined ? settings.or_reasoning : legacyReasoning
    );
    imageModeEnabled = settings.imageModeEnabled || false;

    if (
      (settings.or_web_search === undefined && legacyWebSearch !== undefined) ||
      (settings.or_reasoning === undefined && legacyReasoning !== undefined)
    ) {
      await setLocalStorage({
        or_web_search: webSearchEnabled,
        or_reasoning: reasoningEnabled
      });
    }

    if (webSearchEnabled) {
      webSearchToggle.classList.add("active");
    }
    webSearchToggle.setAttribute('aria-pressed', webSearchEnabled.toString());

    if (reasoningEnabled) {
      reasoningToggle.classList.add("active");
    }
    reasoningToggle.setAttribute('aria-pressed', reasoningEnabled.toString());

    if (imageToggle) {
      setImageToggleUi(imageModeEnabled, false);
      setImageToggleTitle("Enable Image Mode");
    }
  } catch (e) {
    console.error("Error loading toggle settings:", e);
  }
}

async function saveToggleSettings() {
  try {
    await setLocalStorage({
      or_web_search: webSearchEnabled,
      or_reasoning: reasoningEnabled,
      imageModeEnabled
    });
  } catch (e) {
    console.error("Error saving toggle settings:", e);
  }
}

webSearchToggle.addEventListener("click", async () => {
  webSearchEnabled = !webSearchEnabled;
  webSearchToggle.classList.toggle("active");
  webSearchToggle.setAttribute('aria-pressed', webSearchEnabled.toString());
  await saveToggleSettings();
});

reasoningToggle.addEventListener("click", async () => {
  reasoningEnabled = !reasoningEnabled;
  reasoningToggle.classList.toggle("active");
  reasoningToggle.setAttribute('aria-pressed', reasoningEnabled.toString());
  await saveToggleSettings();
});

if (imageToggle) {
  imageToggle.addEventListener("click", async () => {
    imageModeEnabled = !imageModeEnabled;
    imageToggle.classList.toggle("active");
    imageToggle.setAttribute('aria-pressed', imageModeEnabled.toString());
    await saveToggleSettings();
  });
}

// ---- Settings icon click ----
settingsIcon.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

if (setupOpenOptionsBtn) {
  setupOpenOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// ---- Projects button - open Projects page ----
const projectsBtn = document.getElementById('projects-btn');
if (projectsBtn) {
  const openProjectsPage = async () => {
    const stored = await getLocalStorage(["or_collapse_on_projects"]);
    const collapseOnProjects = stored.or_collapse_on_projects !== false;
    const projectsUrl = chrome.runtime.getURL('src/projects/projects.html');
    const tabs = await chrome.tabs.query({ url: projectsUrl });

    if (tabs.length > 0) {
      // Focus existing tab
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Open new tab
      await chrome.tabs.create({ url: projectsUrl });
    }

    if (collapseOnProjects) {
      try {
        await chrome.runtime.sendMessage({ type: "close_sidepanel" });
      } catch (e) {
        // ignore and try local close below
      }
      try {
        window.close();
      } catch (e) {
        // ignore window close errors
      }
    }
  };

  projectsBtn.addEventListener('click', openProjectsPage);
  projectsBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProjectsPage();
    }
  });
}

// ---- Clear answer button functionality ----
const clearAnswerBtn = document.getElementById("clear-answer-btn");
let pendingClearTimeout = null;
let savedAnswersHtml = null;

if (clearAnswerBtn) {
  clearAnswerBtn.addEventListener("click", async () => {
    // Store current state for potential undo
    savedAnswersHtml = answerEl.innerHTML;

    // Clear UI immediately
    answerEl.innerHTML = "";
    updateAnswerVisibility();
    metaEl.textContent = "Answers cleared.";
    scheduleAnswerPersist();

    // Cancel any previous pending clear
    if (pendingClearTimeout) {
      clearTimeout(pendingClearTimeout);
    }

    // Show undo toast
    showToast('Conversation cleared', 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          // Cancel the pending clear
          if (pendingClearTimeout) {
            clearTimeout(pendingClearTimeout);
            pendingClearTimeout = null;
          }
          // Restore the saved answers
          if (savedAnswersHtml) {
            answerEl.innerHTML = savedAnswersHtml;
            updateAnswerVisibility();
            metaEl.textContent = "Answers restored.";
            savedAnswersHtml = null;
            scheduleAnswerPersist();
          }
        }
      }
    });

    // Schedule actual context clear after 5 seconds
    pendingClearTimeout = setTimeout(async () => {
      pendingClearTimeout = null;
      savedAnswersHtml = null;

      // Clear conversation context in background
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id || 'default';
        await chrome.runtime.sendMessage({
          type: "clear_context",
          tabId
        });

        // Reset context visualization
        if (contextViz) {
          contextViz.update(0, 'user');
        }
      } catch (e) {
        console.error("Error clearing context:", e);
      }
    }, 5000);
  });
}

// ---- Typing indicator ----
function showTypingIndicator() {
  typingIndicator.classList.add("active");
}

function hideTypingIndicator() {
  typingIndicator.classList.remove("active");
}

// ---- Initial load ----
document.addEventListener("DOMContentLoaded", async () => {
  // Hide answer box initially if empty
  updateAnswerVisibility();
  await restorePersistedAnswers();

  if (answerEl && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      scheduleAnswerPersist();
    });
    observer.observe(answerEl, { childList: true, subtree: true, characterData: true });
  }

  if (typeof cleanupImageCache === "function") {
    cleanupImageCache().catch((e) => {
      console.warn("Failed to cleanup image cache:", e);
    });
  }

  // Load toggle settings
  loadToggleSettings();

  const providerReady = await refreshSidebarSetupState();
  await loadProviderSetting();
  if (providerReady) {
    refreshBalance();
    loadModels();
  } else if (balanceEl) {
    balanceEl.textContent = "–";
  }

  // Initialize context visualization
  const contextVizContainer = document.getElementById('context-viz-section');
  if (contextVizContainer) {
    contextViz = new ContextVisualization(contextVizContainer);
    await refreshContextVisualization();
  }
});

// ---- Provider update listener ----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "provider_settings_updated") {
    (async () => {
      const providerReady = await refreshSidebarSetupState();
      await loadProviderSetting();
      if (providerReady) {
        await loadModels();
        await refreshBalance();
      } else if (balanceEl) {
        balanceEl.textContent = "–";
      }
    })();
  }
  if (msg?.type === "models_updated") {
    loadModels();
  }
  if (msg?.type === "favorites_updated") {
    refreshFavoritesOnly();
  }
});
