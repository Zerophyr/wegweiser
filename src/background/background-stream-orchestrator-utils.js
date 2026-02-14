// background-stream-orchestrator-utils.js - OpenRouter streaming orchestration

export function createStreamOpenRouterResponse(deps) {
  return async function streamOpenRouterResponse(prompt, webSearch, reasoning, tabId, port, isDisconnectedFn, customMessages = null, customModel = null, customProvider = null, retry = false) {
    const cfg = await deps.loadConfig();
    const providerId = deps.normalizeProviderId(customProvider || cfg.modelProvider);
    const apiKey = await deps.getApiKeyForProvider(providerId);
    if (!apiKey) {
      throw new Error(deps.errorMessages.NO_API_KEY);
    }
    await deps.ensureContextLoaded();
    const providerConfig = deps.getProviderConfig(providerId);
    const streamStartedAt = Date.now();

    const safeSendMessage = deps.createSafePortSender(port, isDisconnectedFn, console);

    let context;
    const isProjectsMode = customMessages !== null;

    if (isProjectsMode) {
      context = [...customMessages];
      const last = context[context.length - 1];
      const shouldAppend = !retry || !(last && last.role === "user" && last.content === prompt);
      if (shouldAppend) {
        context.push({ role: "user", content: prompt });
      }
    } else {
      context = deps.conversationContexts.get(tabId) || [];
      const last = context[context.length - 1];
      const shouldAppend = !retry || !(last && last.role === "user" && last.content === prompt);
      if (shouldAppend) {
        context.push({ role: "user", content: prompt });
      }

      if (context.length > deps.defaults.MAX_CONTEXT_MESSAGES) {
        context.splice(0, context.length - deps.defaults.MAX_CONTEXT_MESSAGES);
      }
      deps.conversationContexts.set(tabId, context);
      await deps.persistContextForTab(tabId);
    }

    let modelName = customModel || cfg.model || deps.defaults.MODEL;
    if (providerConfig.supportsWebSearch && webSearch && !modelName.endsWith(":online")) {
      modelName = `${modelName}:online`;
    }

    const requestBody = deps.buildStreamRequestBody({
      modelName,
      context,
      providerId: providerConfig.id,
      webSearch,
      reasoning
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), deps.apiConfig.TIMEOUT);

    deps.debugLogger.log({
      type: "stream_start",
      provider: providerConfig.id,
      model: modelName,
      tabId: tabId || null,
      projectsMode: isProjectsMode,
      promptChars: typeof prompt === "string" ? prompt.length : 0,
      messageCount: Array.isArray(context) ? context.length : 0,
      webSearch: Boolean(webSearch),
      reasoning: Boolean(reasoning),
      startedAt: new Date(streamStartedAt).toISOString()
    });

    let res;
    try {
      res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: deps.buildAuthHeaders(apiKey, providerConfig),
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch (e) {
      deps.debugLogger.log({
        type: "stream_error",
        stage: "fetch",
        message: e?.message || String(e),
        elapsedMs: Date.now() - streamStartedAt
      });
      throw e;
    }

    clearTimeout(timeoutId);

    deps.debugLogger.log({
      type: "stream_response",
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type") || null,
      elapsedMs: Date.now() - streamStartedAt
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      deps.debugLogger.log({
        type: "stream_error",
        stage: "response",
        status: res.status,
        message: data?.error?.message || deps.errorMessages.API_ERROR,
        elapsedMs: Date.now() - streamStartedAt
      });
      throw new Error(data?.error?.message || deps.errorMessages.API_ERROR);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let tokens = null;
    let firstChunkLogged = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        deps.debugLogger.log({
          type: "stream_reader_done",
          elapsedMs: Date.now() - streamStartedAt,
          contentLength: fullContent.length
        });
        break;
      }

      if (isDisconnectedFn && isDisconnectedFn()) {
        deps.debugLogger.log({
          type: "stream_port_disconnected",
          elapsedMs: Date.now() - streamStartedAt
        });
        break;
      }

      if (deps.debugLogger.isEnabled() && !firstChunkLogged) {
        firstChunkLogged = true;
        deps.debugLogger.log({
          type: "stream_first_chunk",
          elapsedMs: Date.now() - streamStartedAt
        });
      }

      const split = deps.splitSseLines(buffer, decoder.decode(value, { stream: true }));
      const lines = split.lines;
      buffer = split.buffer;

      for (const line of lines) {
        if (line.trim() === "") continue;
        const parsed = deps.parseSseDataLine(line);
        if (parsed.done) {
          deps.debugLogger.log({
            type: "stream_done_signal",
            elapsedMs: Date.now() - streamStartedAt
          });
          continue;
        }
        if (!parsed.chunk && !parsed.error) continue;
        if (parsed.error) {
          deps.debugLogger.log({
            type: "stream_parse_error",
            message: parsed.error?.message || String(parsed.error),
            elapsedMs: Date.now() - streamStartedAt
          });
          continue;
        }

        try {
          const chunk = parsed.chunk;
          const delta = chunk?.choices?.[0]?.delta;

          if (deps.debugLogger.isEnabled()) {
            const stats = deps.getStreamDeltaStats(delta, chunk);
            deps.debugLogger.log({
              type: "stream_chunk",
              deltaKeys: delta ? Object.keys(delta) : [],
              contentLength: stats.contentLength,
              reasoningLength: stats.reasoningLength,
              hasUsage: stats.hasUsage,
              totalTokens: stats.totalTokens,
              elapsedMs: Date.now() - streamStartedAt
            });
          }

          if (delta?.content) {
            fullContent += delta.content;
            const sent = safeSendMessage({ type: "content", content: delta.content });
            if (!sent) break;
          }

          const reasoningText = deps.getReasoningText(delta);
          if (reasoningText) {
            const sent = safeSendMessage({ type: "reasoning", reasoning: reasoningText });
            if (!sent) break;
          }

          if (chunk.usage) {
            tokens = chunk.usage.total_tokens;
          }
        } catch (e) {
          deps.debugLogger.log({
            type: "stream_parse_error",
            message: e?.message || String(e),
            elapsedMs: Date.now() - streamStartedAt
          });
        }
      }
    }

    if (!fullContent || fullContent.length === 0) {
      deps.debugLogger.log({
        type: "stream_no_content",
        elapsedMs: Date.now() - streamStartedAt,
        tokens
      });
      safeSendMessage({
        type: "error",
        error: "No response content received from the model. The model may have only produced reasoning without a final answer. Please try again."
      });
      return;
    }

    if (!isProjectsMode) {
      context.push({ role: "assistant", content: fullContent });

      if (context.length > deps.defaults.MAX_CONTEXT_MESSAGES) {
        context.splice(0, context.length - deps.defaults.MAX_CONTEXT_MESSAGES);
      }

      deps.conversationContexts.set(tabId, context);
      await deps.persistContextForTab(tabId);
      await deps.addHistoryEntry(prompt, fullContent);
    }

    safeSendMessage({
      type: "complete",
      tokens,
      contextSize: context.length,
      model: customModel || cfg.model
    });

    deps.debugLogger.log({
      type: "stream_complete",
      elapsedMs: Date.now() - streamStartedAt,
      contentLength: fullContent.length,
      tokens
    });
  };
}
