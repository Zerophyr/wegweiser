(() => {

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
// Keep key names in sidepanel.js for storage-key regression tests.
const SIDEPANEL_TOGGLE_STORAGE_KEYS = ["or_web_search", "or_reasoning", "imageModeEnabled"];
const chatStore = (typeof window !== "undefined" && window.chatStore) ? window.chatStore : null;
const sidepanelModuleResolver = (typeof window !== "undefined" && window.sidepanelModuleResolver)
  || (typeof require === "function" ? require("./sidepanel-module-resolver.js") : null);
const resolveSidepanelModuleSafe = sidepanelModuleResolver?.resolveSidepanelModule
  || ((windowKey) => ((typeof window !== "undefined" && window && window[windowKey]) ? window[windowKey] : {}));
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

let webSearchEnabled = false;
let reasoningEnabled = false;
let imageModeEnabled = false;

let currentProvider = "openrouter";
let combinedModels = [];
let modelMap = new Map();
let favoriteModelsByProvider = {
  openrouter: new Set()
};
let recentModelsByProvider = {
  openrouter: []
};
let selectedCombinedModelId = null;
let sidebarSetupRequired = false;
let lastStreamContext = null;

const sidepanelProviderModule = resolveSidepanelModuleSafe("sidepanelProviderUtils", "./sidepanel-provider.js");
const {
  normalizeProviderSafe: normalizeProviderSafeFromProvider,
  getProviderLabelSafe: getProviderLabelSafeFromProvider,
  getProviderStorageKeySafe: getProviderStorageKeySafeFromProvider,
  buildCombinedModelIdSafe: buildCombinedModelIdSafeFromProvider,
  parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
  getModelDisplayName: getModelDisplayNameFromProvider
} = sidepanelProviderModule;
const sidepanelStreamModule = resolveSidepanelModuleSafe("sidepanelStreamUtils", "./sidepanel-stream-utils.js");
const {
  buildStreamErrorHtml: buildStreamErrorHtmlSafe,
  sanitizePrompt: sanitizePromptSafe,
  getImageExtension: getImageExtensionFromUtils,
  getImageViewerBaseUrl: getImageViewerBaseUrlFromUtils
} = sidepanelStreamModule;
const sidepanelAnswerStoreModule = resolveSidepanelModuleSafe("sidepanelAnswerStoreUtils", "./sidepanel-answer-store-utils.js");
const { ANSWER_CACHE_KEY_PREFIX: ANSWER_CACHE_KEY_PREFIX_SAFE, getAnswerStorage: getAnswerStorageSafe, getCurrentTabId: getCurrentTabIdSafe, getSidepanelThreadId: getSidepanelThreadIdSafe, buildAnswerCacheKey: buildAnswerCacheKeySafe } = sidepanelAnswerStoreModule;
const sidepanelAnswerUiModule = resolveSidepanelModuleSafe("sidepanelAnswerUiUtils", "./sidepanel-answer-ui-utils.js");
const { hasAnswerContent: hasAnswerContentSafe, buildSourcesCountLabel: buildSourcesCountLabelSafe } = sidepanelAnswerUiModule;
const sidepanelExportModule = resolveSidepanelModuleSafe("sidepanelExportUtils", "./sidepanel-export-utils.js");
const { closeExportMenus: closeExportMenusSafe, getExportPayload: getExportPayloadSafe } = sidepanelExportModule;
const sidepanelSourcesSummaryModule = resolveSidepanelModuleSafe("sidepanelSourcesSummaryUtils", "./sidepanel-sources-summary-utils.js");
const { renderSourcesSummaryToElement: renderSourcesSummaryToElementSafe } = sidepanelSourcesSummaryModule;
const sidepanelPromptControllerModule = resolveSidepanelModuleSafe("sidepanelPromptControllerUtils", "./sidepanel-prompt-controller-utils.js");
const sidepanelModelControllerModule = resolveSidepanelModuleSafe("sidepanelModelControllerUtils", "./sidepanel-model-controller-utils.js");

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

const buildCombinedFavoritesList = () => sidepanelProviderModule.buildCombinedFavoritesList(favoriteModelsByProvider);
const buildCombinedRecentList = () => sidepanelProviderModule.buildCombinedRecentList(recentModelsByProvider);

function loadFavoritesAndRecents(localItems, syncItems) {
  favoriteModelsByProvider = {
    openrouter: new Set(syncItems.or_favorites || [])
  };

  recentModelsByProvider = {
    openrouter: localItems.or_recent_models || []
  };
}

async function refreshFavoritesOnly() {
  try {
    const syncItems = await chrome.storage.sync.get(["or_favorites"]);
    favoriteModelsByProvider = {
      openrouter: new Set(syncItems.or_favorites || [])
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
    currentProvider = normalizeProviderSafeFromProvider(stored.or_model_provider || stored.or_provider);
  } catch (e) {
    console.warn("Failed to load provider setting:", e);
  }
}

// setup panel
function isProviderReady(localItems) {
  const openrouterKey = typeof localItems.or_api_key === "string" ? localItems.or_api_key.trim() : "";
  return Boolean(openrouterKey);
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
    modelStatusEl.textContent = "Add your OpenRouter API key in Options to load models.";
  }
}

async function refreshSidebarSetupState() {
  const localItems = await getLocalStorage([
    "or_api_key"
  ]);
  const ready = isProviderReady(localItems);
  updateSetupPanelVisibility(ready);
  return ready;
}
let modelDropdown = null;

let contextViz = null;

let activePort = null;
const sidepanelControllerState = {
  get webSearchEnabled() { return webSearchEnabled; },
  set webSearchEnabled(value) { webSearchEnabled = Boolean(value); },
  get reasoningEnabled() { return reasoningEnabled; },
  set reasoningEnabled(value) { reasoningEnabled = Boolean(value); },
  get imageModeEnabled() { return imageModeEnabled; },
  set imageModeEnabled(value) { imageModeEnabled = Boolean(value); },
  get currentProvider() { return currentProvider; },
  set currentProvider(value) { currentProvider = normalizeProviderSafeFromProvider(value); },
  get combinedModels() { return combinedModels; },
  set combinedModels(value) { combinedModels = Array.isArray(value) ? value : []; },
  get modelMap() { return modelMap; },
  set modelMap(value) { modelMap = value instanceof Map ? value : new Map(); },
  get favoriteModelsByProvider() { return favoriteModelsByProvider; },
  set favoriteModelsByProvider(value) { favoriteModelsByProvider = value || favoriteModelsByProvider; },
  get recentModelsByProvider() { return recentModelsByProvider; },
  set recentModelsByProvider(value) { recentModelsByProvider = value || recentModelsByProvider; },
  get selectedCombinedModelId() { return selectedCombinedModelId; },
  set selectedCombinedModelId(value) { selectedCombinedModelId = value || null; },
  get sidebarSetupRequired() { return sidebarSetupRequired; },
  set sidebarSetupRequired(value) { sidebarSetupRequired = Boolean(value); },
  get lastStreamContext() { return lastStreamContext; },
  set lastStreamContext(value) { lastStreamContext = value || null; },
  get activePort() { return activePort; },
  set activePort(value) { activePort = value || null; }
};

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

// Token estimation using constants
function estimateTokens(text) {
  return Math.ceil(text.length / UI_CONSTANTS.CHARS_PER_TOKEN);
}

function updateAnswerVisibility() {
  const clearBtn = document.getElementById("clear-answer-btn");
  if (!hasAnswerContentSafe(answerEl.innerHTML)) {
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

let answerPersistTimeout = null;

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
    const threadId = await getSidepanelThreadIdSafe();
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
  const storage = getAnswerStorageSafe();
  if (!storage) return;
  const tabId = await getCurrentTabIdSafe();
  const key = buildAnswerCacheKeySafe(tabId);
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
    const threadId = await getSidepanelThreadIdSafe();
    const payload = await chatStore.getThread(threadId);
    if (payload?.html) {
      if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
        window.safeHtml.setSanitizedHtml(answerEl, payload.html);
      } else {
        answerEl.innerHTML = payload.html;
      }
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
  const storage = getAnswerStorageSafe();
  if (!storage) return;
  const tabId = await getCurrentTabIdSafe();
  const key = buildAnswerCacheKeySafe(tabId);
  const stored = await storage.get([key]);
  const payload = stored?.[key];
  if (payload?.html) {
    if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
      window.safeHtml.setSanitizedHtml(answerEl, payload.html);
    } else {
      answerEl.innerHTML = payload.html;
    }
    if (payload.metaText) {
      metaEl.textContent = payload.metaText;
    }
    updateAnswerVisibility();
  } else {
    answerEl.innerHTML = "";
    updateAnswerVisibility();
  }
}

function renderSourcesSummary(answerItem, sources) {
  const summary = answerItem?.querySelector('.answer-sources-summary');
  renderSourcesSummaryToElementSafe(summary, sources, getUniqueDomains, buildSourcesCountLabelSafe);
}

function exportAnswer(answerItem, format) {
  if (!answerItem) return;
  const payload = getExportPayloadSafe(answerItem);
  const messages = payload.messages;

  if (format === 'markdown' && typeof exportMarkdownFile === 'function') {
    exportMarkdownFile(messages, 'answer.md');
  } else if (format === 'docx' && typeof exportDocx === 'function') {
    exportDocx(messages, 'answer.docx');
  } else if (format === 'pdf' && typeof exportPdf === 'function') {
    exportPdf(payload.html, 'answer');
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
      closeExportMenusSafe();
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
    closeExportMenusSafe();
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
    closeExportMenusSafe();
  }
});

// Note: escapeHtml() and validateUrl() are now in utils.js

function openImageInNewTab(dataUrl, imageId) {
  if (!dataUrl) return;
  const viewerBaseUrl = getImageViewerBaseUrlFromUtils();
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
  link.download = `wegweiser-image-${imageId}.${getImageExtensionFromUtils(mimeType)}`;
  link.click();
}

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

function buildSidepanelPromptDeps() {
  return {
    state: sidepanelControllerState,
    promptEl,
    askBtn,
    setPromptStreamingState,
    metaEl,
    showAnswerBox,
    answerEl,
    updateAnswerVisibility,
    answerSection,
    parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
    normalizeProviderSafe: normalizeProviderSafeFromProvider,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    buildImageCard: (typeof buildImageCard === "function") ? buildImageCard : null,
    putImageCacheEntry: (typeof putImageCacheEntry === "function") ? putImageCacheEntry : null,
    getImageCacheEntry: (typeof getImageCacheEntry === "function") ? getImageCacheEntry : null,
    openImageInNewTab,
    downloadImage,
    refreshBalance,
    sanitizePrompt: sanitizePromptSafe,
    clearPromptAfterSend: (typeof clearPromptAfterSend === "function") ? clearPromptAfterSend : null,
    generateImageImpl: (prompt) => generateImage(prompt),
    typingIndicator,
    showTypingIndicator,
    queryActiveTab: () => chrome.tabs.query({ active: true, currentWindow: true }),
    getProviderLabelSafe: getProviderLabelSafeFromProvider,
    hideTypingIndicator,
    buildStreamErrorHtml: buildStreamErrorHtmlSafe,
    getStreamingFallbackMessage: (typeof getStreamingFallbackMessage === "function") ? getStreamingFallbackMessage : null,
    extractReasoningFromStreamChunk: (typeof extractReasoningFromStreamChunk === "function") ? extractReasoningFromStreamChunk : null,
    extractSources,
    applyMarkdownStyles,
    safeHtmlSetter: (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function")
      ? window.safeHtml.setSanitizedHtml
      : null,
    modelMap,
    getModelDisplayName: getModelDisplayNameFromProvider,
    UI_CONSTANTS,
    removeReasoningBubbles: (typeof removeReasoningBubbles === "function") ? removeReasoningBubbles : null,
    makeSourceReferencesClickable,
    createSourcesIndicator,
    renderSourcesSummary,
    contextViz,
    escapeHtml,
    estimatedCostEl
  };
}

async function generateImage(prompt) {
  return sidepanelPromptControllerModule.generateImage(buildSidepanelPromptDeps(), prompt);
}

async function askQuestion() {
  try {
    return await sidepanelPromptControllerModule.askQuestion(buildSidepanelPromptDeps());
  } finally {
    if (!activePort) {
      askBtn.disabled = false;
      setPromptStreamingState(false);
    }
  }
}

askBtn.addEventListener("click", askQuestion);

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
      metaEl.textContent = `📤 Sending to ${getProviderLabelSafeFromProvider(currentProvider)} for summarization (this may take longer for large pages)...`;
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
            metaEl.textContent = `📤 Sending to ${getProviderLabelSafeFromProvider(currentProvider)} for summarization...`;

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
        const summaryModel = selectedCombinedModelId ? getModelDisplayNameFromProvider(modelMap.get(selectedCombinedModelId)) : (res.model || "default model");
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

async function loadModels() {
  return sidepanelModelControllerModule.loadModels({
    state: sidepanelControllerState,
    modelStatusEl,
    sendRuntimeMessage: (payload) => chrome.runtime.sendMessage(payload),
    getLocalStorage,
    loadFavoritesAndRecents,
    modelInput,
    modelDropdownRef: () => modelDropdown,
    ModelDropdownManager,
    parseCombinedModelIdSafe: parseCombinedModelIdSafeFromProvider,
    normalizeProviderSafe: normalizeProviderSafeFromProvider,
    getModelDisplayName: getModelDisplayNameFromProvider,
    setLocalStorage,
    getProviderStorageKeySafe: getProviderStorageKeySafeFromProvider,
    buildCombinedRecentList,
    buildCombinedFavoritesList,
    setModelDropdown: (value) => { modelDropdown = value; },
    applyImageModeForModel,
    buildCombinedModelIdSafe: buildCombinedModelIdSafeFromProvider
  });
}

async function loadToggleSettings() {
  return sidepanelModelControllerModule.loadToggleSettings({
    state: sidepanelControllerState,
    getLocalStorage,
    setLocalStorage,
    webSearchToggle,
    reasoningToggle,
    imageToggle,
    setImageToggleUi,
    setImageToggleTitle
  });
}

async function saveToggleSettings() {
  return sidepanelModelControllerModule.saveToggleSettings({
    state: sidepanelControllerState,
    setLocalStorage
  });
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

settingsIcon.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

if (setupOpenOptionsBtn) {
  setupOpenOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

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

function showTypingIndicator() {
  typingIndicator.classList.add("active");
}

function hideTypingIndicator() {
  typingIndicator.classList.remove("active");
}

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
})();
