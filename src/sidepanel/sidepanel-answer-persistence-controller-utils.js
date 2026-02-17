// sidepanel-answer-persistence-controller-utils.js - answer persistence orchestration for sidepanel

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

function createAnswerPersistenceController(deps = {}) {
  let answerPersistTimeout = null;

  function setAnswerHtmlSafe(html) {
    setSafeHtml(deps.answerEl, html || "");
  }

  function clearAnswerHtml() {
    if (!deps.answerEl) return;
    deps.answerEl.replaceChildren();
  }

  async function persistAnswers() {
    if (!deps.answerEl) return;
    const html = deps.answerEl.innerHTML || "";
    const metaText = deps.metaEl?.textContent || "";

    if (deps.chatStore && typeof deps.chatStore.putThread === "function") {
      const threadId = await deps.getSidepanelThreadId();
      if (!html.trim()) {
        if (typeof deps.chatStore.deleteThread === "function") {
          await deps.chatStore.deleteThread(threadId);
        }
        return;
      }
      await deps.chatStore.putThread({
        id: threadId,
        projectId: deps.sidepanelProjectId || "__sidepanel__",
        title: "Sidepanel",
        html,
        metaText,
        updatedAt: Date.now()
      });
      return;
    }

    const storage = deps.getAnswerStorage();
    if (!storage) return;
    const tabId = await deps.getCurrentTabId();
    const key = deps.buildAnswerCacheKey(tabId);
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

  function scheduleAnswerPersist() {
    if (answerPersistTimeout) {
      clearTimeout(answerPersistTimeout);
    }
    answerPersistTimeout = setTimeout(() => {
      answerPersistTimeout = null;
      persistAnswers().catch((e) => {
        if (typeof deps.logWarn === "function") {
          deps.logWarn("Failed to persist answers:", e);
        }
      });
    }, 200);
  }

  async function restorePersistedAnswers() {
    if (!deps.answerEl) return;

    if (deps.chatStore && typeof deps.chatStore.getThread === "function") {
      const threadId = await deps.getSidepanelThreadId();
      const payload = await deps.chatStore.getThread(threadId);
      if (payload?.html) {
        setAnswerHtmlSafe(payload.html);
        if (payload.metaText) {
          deps.metaEl.textContent = payload.metaText;
        }
        deps.updateAnswerVisibility?.();
      } else {
        clearAnswerHtml();
        deps.updateAnswerVisibility?.();
      }
      return;
    }

    const storage = deps.getAnswerStorage();
    if (!storage) return;
    const tabId = await deps.getCurrentTabId();
    const key = deps.buildAnswerCacheKey(tabId);
    const stored = await storage.get([key]);
    const payload = stored?.[key];

    if (payload?.html) {
      setAnswerHtmlSafe(payload.html);
      if (payload.metaText) {
        deps.metaEl.textContent = payload.metaText;
      }
      deps.updateAnswerVisibility?.();
    } else {
      clearAnswerHtml();
      deps.updateAnswerVisibility?.();
    }
  }

  function registerAnswerObserver() {
    if (!deps.answerEl || typeof MutationObserver === "undefined") return null;
    const observer = new MutationObserver(() => {
      scheduleAnswerPersist();
    });
    observer.observe(deps.answerEl, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  return {
    setAnswerHtmlSafe,
    clearAnswerHtml,
    scheduleAnswerPersist,
    persistAnswers,
    restorePersistedAnswers,
    registerAnswerObserver
  };
}

const sidepanelAnswerPersistenceControllerUtils = {
  createAnswerPersistenceController
};

if (typeof window !== "undefined") {
  window.sidepanelAnswerPersistenceControllerUtils = sidepanelAnswerPersistenceControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelAnswerPersistenceControllerUtils;
}
