// background-query-controller-utils.js - Query orchestration for non-stream requests

function createBackgroundQueryController(rawDeps) {
  const deps = rawDeps || {};

  const loadConfig = deps.loadConfig || (async () => ({}));
  const normalizeProviderId = deps.normalizeProviderId || ((providerId) => providerId || "openrouter");
  const getApiKeyForProvider = deps.getApiKeyForProvider || (async () => "");
  const ensureContextLoaded = deps.ensureContextLoaded || (async () => {});
  const getProviderConfig = deps.getProviderConfig || (() => ({ id: "openrouter", baseUrl: "" }));
  const buildAuthHeaders = deps.buildAuthHeaders || (() => ({}));
  const conversationContexts = deps.conversationContexts || new Map();
  const defaults = deps.defaults || { MAX_CONTEXT_MESSAGES: 16, MODEL: "openai/gpt-4o-mini" };
  const persistContextForTab = deps.persistContextForTab || (async () => {});
  const apiConfig = deps.apiConfig || { MAX_RETRIES: 3, RETRY_DELAY: 1000, TIMEOUT: 120000 };
  const errorMessages = deps.errorMessages || {
    NO_API_KEY: "No API key",
    RATE_LIMIT: "Rate limit exceeded",
    API_ERROR: "API error",
    INVALID_RESPONSE: "Invalid response",
    TIMEOUT: "Request timed out"
  };
  const debugLogger = deps.debugLogger || { log: () => {} };
  const fetchFn = deps.fetchFn || fetch;
  const setTimeoutFn = deps.setTimeoutFn || setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn || clearTimeout;
  const sleep = deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger = deps.logger || console;
  const now = deps.now || Date.now;

  async function callOpenRouter(prompt, webSearch = false, reasoning = false, tabId = "default") {
    const cfg = await loadConfig();
    if (!cfg.apiKey) {
      throw new Error(errorMessages.NO_API_KEY);
    }
    await ensureContextLoaded();
    const providerConfig = getProviderConfig(cfg.modelProvider);

    if (!conversationContexts.has(tabId)) {
      conversationContexts.set(tabId, []);
    }
    const context = conversationContexts.get(tabId);

    context.push({ role: "user", content: prompt });

    if (context.length > defaults.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - defaults.MAX_CONTEXT_MESSAGES);
    }

    logger.log(`[Context] Tab ${tabId}: ${context.length} messages in context`);
    await persistContextForTab(tabId);

    let modelName = cfg.model;
    if (providerConfig.supportsWebSearch && webSearch && !modelName.endsWith(":online")) {
      modelName = `${modelName}:online`;
    }

    const requestBody = {
      model: modelName,
      messages: [...context]
    };

    if (reasoning && providerConfig.id === "openrouter") {
      requestBody.reasoning = {
        enabled: true,
        effort: "medium"
      };
      logger.log("[Reasoning] Reasoning parameter added to request:", requestBody.reasoning);
    }

    let lastError;
    for (let attempt = 0; attempt < apiConfig.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeoutFn(() => controller.abort(), apiConfig.TIMEOUT);

        const res = await fetchFn(`${providerConfig.baseUrl}/chat/completions`, {
          method: "POST",
          headers: buildAuthHeaders(cfg.apiKey, providerConfig),
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeoutFn(timeoutId);

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 429) {
            throw new Error(errorMessages.RATE_LIMIT);
          } else if (res.status >= 500) {
            throw new Error(data?.error?.message || errorMessages.API_ERROR);
          } else {
            throw new Error(data?.error?.message || errorMessages.INVALID_RESPONSE);
          }
        }

        const content = data.choices?.[0]?.message?.content || "(No content returned)";
        const tokens = data.usage?.total_tokens || null;

        context.push({ role: "assistant", content });

        if (context.length > defaults.MAX_CONTEXT_MESSAGES) {
          context.splice(0, context.length - defaults.MAX_CONTEXT_MESSAGES);
        }

        logger.log(`[Context] Tab ${tabId}: ${context.length} messages after response`);
        await persistContextForTab(tabId);

        return {
          answer: content,
          tokens,
          contextSize: context.length,
          reasoning: null
        };
      } catch (error) {
        lastError = error;

        if (error?.name === "AbortError") {
          throw new Error(errorMessages.TIMEOUT);
        }
        if (String(error?.message || "").includes("API key") || String(error?.message || "").includes("Rate limit")) {
          throw error;
        }

        if (attempt < apiConfig.MAX_RETRIES - 1) {
          const delay = apiConfig.RETRY_DELAY * Math.pow(2, attempt);
          logger.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await sleep(delay);
        }
      }
    }

    throw lastError || new Error(errorMessages.API_ERROR);
  }

  async function callOpenRouterWithMessages(messages, customModel = null, customProvider = null) {
    const cfg = await loadConfig();
    const providerId = normalizeProviderId(customProvider || cfg.modelProvider);
    const apiKey = await getApiKeyForProvider(providerId);
    if (!apiKey) {
      throw new Error(errorMessages.NO_API_KEY);
    }
    const providerConfig = getProviderConfig(providerId);
    const summaryStartedAt = now();

    const requestBody = {
      model: customModel || cfg.model || defaults.MODEL,
      messages: Array.isArray(messages) ? messages : []
    };

    debugLogger.log({
      type: "summary_start",
      provider: providerConfig.id,
      model: requestBody.model,
      messageCount: requestBody.messages.length,
      hasApiKey: Boolean(apiKey)
    });

    let lastError;
    for (let attempt = 0; attempt < apiConfig.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeoutFn(() => controller.abort(), apiConfig.TIMEOUT);

        const res = await fetchFn(`${providerConfig.baseUrl}/chat/completions`, {
          method: "POST",
          headers: buildAuthHeaders(apiKey, providerConfig),
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeoutFn(timeoutId);

        const data = await res.json();

        debugLogger.log({
          type: "summary_response",
          provider: providerConfig.id,
          status: res.status,
          ok: res.ok,
          summaryLength: typeof data?.choices?.[0]?.message?.content === "string"
            ? data.choices[0].message.content.length
            : 0,
          tokens: data?.usage?.total_tokens || null,
          elapsedMs: now() - summaryStartedAt
        });

        if (!res.ok) {
          if (res.status === 429) {
            throw new Error(errorMessages.RATE_LIMIT);
          } else if (res.status >= 500) {
            throw new Error(data?.error?.message || errorMessages.API_ERROR);
          } else {
            throw new Error(data?.error?.message || errorMessages.INVALID_RESPONSE);
          }
        }

        const content = data.choices?.[0]?.message?.content || "(No content returned)";
        const tokens = data.usage?.total_tokens || null;

        return { answer: content, tokens };
      } catch (error) {
        lastError = error;

        debugLogger.log({
          type: "summary_error",
          provider: providerConfig.id,
          error: error?.message || String(error),
          elapsedMs: now() - summaryStartedAt
        });

        if (error?.name === "AbortError") {
          throw new Error(errorMessages.TIMEOUT);
        }
        if (String(error?.message || "").includes("API key") || String(error?.message || "").includes("Rate limit")) {
          throw error;
        }

        if (attempt < apiConfig.MAX_RETRIES - 1) {
          const delay = apiConfig.RETRY_DELAY * Math.pow(2, attempt);
          logger.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await sleep(delay);
        }
      }
    }

    throw lastError || new Error(errorMessages.API_ERROR);
  }

  return {
    callOpenRouter,
    callOpenRouterWithMessages
  };
}

const backgroundQueryControllerUtils = {
  createBackgroundQueryController
};

if (typeof window !== "undefined") {
  window.backgroundQueryControllerUtils = backgroundQueryControllerUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundQueryControllerUtils = backgroundQueryControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundQueryControllerUtils;
}
