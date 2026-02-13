// sidepanel-answer-store-utils.js - Helpers for sidepanel answer persistence keys/storage

const ANSWER_CACHE_KEY_PREFIX = "or_sidepanel_answer_";

function getAnswerStorage(chromeApi) {
  const api = chromeApi || (typeof chrome !== "undefined" ? chrome : null);
  if (api?.storage?.session) {
    return api.storage.session;
  }
  return api?.storage?.local || null;
}

async function getCurrentTabId(tabsApi) {
  const api = tabsApi || (typeof chrome !== "undefined" ? chrome.tabs : null);
  try {
    const tabs = await api.query({ active: true, currentWindow: true });
    return tabs[0]?.id || "default";
  } catch (e) {
    console.warn("Failed to resolve current tab id:", e);
    return "default";
  }
}

async function getSidepanelThreadId(tabsApi) {
  const tabId = await getCurrentTabId(tabsApi);
  return `sidepanel_${tabId}`;
}

function buildAnswerCacheKey(tabId) {
  return `${ANSWER_CACHE_KEY_PREFIX}${tabId}`;
}

const sidepanelAnswerStoreUtils = {
  ANSWER_CACHE_KEY_PREFIX,
  getAnswerStorage,
  getCurrentTabId,
  getSidepanelThreadId,
  buildAnswerCacheKey
};

if (typeof window !== "undefined") {
  window.sidepanelAnswerStoreUtils = sidepanelAnswerStoreUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelAnswerStoreUtils;
}
