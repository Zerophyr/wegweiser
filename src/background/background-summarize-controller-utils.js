// background-summarize-controller-utils.js - Summarize page orchestration

function createBackgroundSummarizeController(rawDeps) {
  const deps = rawDeps || {};

  const chromeApi = deps.chromeApi || chrome;
  const callOpenRouter = deps.callOpenRouter || (async () => ({ answer: "", tokens: null }));
  const addHistoryEntry = deps.addHistoryEntry || (async () => {});
  const loadConfig = deps.loadConfig || (async () => ({ model: "" }));
  const conversationContexts = deps.conversationContexts || new Map();
  const maxChunkSize = Number.isFinite(deps.maxChunkSize) ? deps.maxChunkSize : 12000;
  const logger = deps.logger || console;

  async function handleSummarizePageMessage(msg, sendResponse) {
    try {
      const tabId = msg.tabId;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tab ID provided" });
        return;
      }

      const tab = await chromeApi.tabs.get(tabId);
      const url = tab.url;
      const hasPermission = await chromeApi.permissions.contains({ origins: [url] });
      if (!hasPermission) {
        sendResponse({ ok: false, error: "PERMISSION_NEEDED", requiresPermission: true, url });
        return;
      }

      const extractPageContent = () => {
        const article = document.querySelector("article");
        if (article) {
          return { title: document.title, content: article.innerText, url: window.location.href };
        }
        const mainContent = document.querySelector("main")
          || document.querySelector('[role="main"]')
          || document.body;
        const clone = mainContent.cloneNode(true);
        clone.querySelectorAll('script, style, nav, footer, aside, header, .ad, .advertisement, [role="navigation"], [role="complementary"]')
          .forEach((el) => el.remove());
        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || "",
          content: clone.innerText,
          url: window.location.href
        };
      };

      const results = await chromeApi.scripting.executeScript({
        target: { tabId },
        func: extractPageContent
      });
      const pageData = results[0].result;
      const content = pageData.content.trim();
      let finalAnswer;
      let finalTokens = null;

      if (content.length <= maxChunkSize) {
        let prompt = `Please provide a concise summary of the following webpage:\n\nTitle: ${pageData.title}\nURL: ${pageData.url}\n`;
        if (pageData.description) prompt += `\nDescription: ${pageData.description}\n`;
        prompt += `\nContent:\n${content}`;
        const result = await callOpenRouter(prompt, msg.webSearch, msg.reasoning, tabId);
        finalAnswer = result.answer;
        finalTokens = result.tokens;
        await addHistoryEntry(prompt, finalAnswer);
      } else {
        const chunks = [];
        for (let i = 0; i < content.length; i += maxChunkSize) {
          chunks.push(content.substring(i, i + maxChunkSize));
        }

        const chunkSummaries = [];
        let totalTokens = 0;

        for (let i = 0; i < chunks.length; i += 1) {
          const chunkPrompt = `Please provide a concise summary of this section (part ${i + 1} of ${chunks.length}) from the webpage "${pageData.title}":\n\n${chunks[i]}`;
          const chunkResult = await callOpenRouter(chunkPrompt, msg.webSearch, msg.reasoning, tabId);
          chunkSummaries.push(chunkResult.answer);
          if (chunkResult.tokens) totalTokens += chunkResult.tokens;
        }

        const combinedPrompt = `Please provide a comprehensive summary by combining these section summaries from the webpage "${pageData.title}" (${pageData.url}):\n\n${chunkSummaries.map((summary, index) => `Section ${index + 1}:\n${summary}`).join("\n\n---\n\n")}`;
        const finalResult = await callOpenRouter(combinedPrompt, msg.webSearch, msg.reasoning, tabId);
        finalAnswer = finalResult.answer;
        if (finalResult.tokens) totalTokens += finalResult.tokens;
        finalTokens = totalTokens;

        await addHistoryEntry(`[Chunked Summary - ${chunks.length} parts] ${pageData.title}\n${pageData.url}`, finalAnswer);
      }

      const contextSize = conversationContexts.has(tabId)
        ? conversationContexts.get(tabId).length
        : 0;

      sendResponse({
        ok: true,
        answer: finalAnswer,
        model: (await loadConfig()).model,
        tokens: finalTokens,
        contextSize
      });
    } catch (e) {
      logger.error("Summarize page error:", e);
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  }

  return {
    handleSummarizePageMessage
  };
}

const backgroundSummarizeControllerUtils = {
  createBackgroundSummarizeController
};

if (typeof window !== "undefined") {
  window.backgroundSummarizeControllerUtils = backgroundSummarizeControllerUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundSummarizeControllerUtils = backgroundSummarizeControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundSummarizeControllerUtils;
}
