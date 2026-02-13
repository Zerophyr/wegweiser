// background-message-router-utils.js - runtime message routing registration

export function registerBackgroundMessageRouter(chromeApi, deps) {
  chromeApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === deps.MESSAGE_TYPES.DEBUG_SET_ENABLED) {
      (async () => {
        try {
          const enabled = await deps.setDebugStreamEnabledState(
            deps.debugStreamState,
            msg.enabled,
            deps.setLocalStorage,
            deps.STORAGE_KEYS.DEBUG_STREAM
          );
          sendResponse({ ok: true, enabled });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.DEBUG_GET_STREAM_LOG) {
      sendResponse({ ok: true, ...deps.getDebugSnapshot(deps.debugStreamState, deps.buildDebugLogMeta) });
      return false;
    }

    if (msg?.type === deps.MESSAGE_TYPES.DEBUG_CLEAR_STREAM_LOG) {
      deps.clearDebugEntries(deps.debugStreamState);
      sendResponse({ ok: true });
      return false;
    }

    if (msg?.type === deps.MESSAGE_TYPES.CLOSE_SIDEPANEL) {
      (async () => {
        try {
          let tabId = sender?.tab?.id || msg?.tabId || null;
          if (!tabId && chromeApi.tabs && typeof chromeApi.tabs.query === "function") {
            const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
            tabId = tabs?.[0]?.id || null;
          }
          if (!tabId || !chromeApi.sidePanel || typeof chromeApi.sidePanel.close !== "function") {
            sendResponse({ ok: false, error: "Side panel close not available" });
            return;
          }
          await chromeApi.sidePanel.close({ tabId });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.OPENROUTER_QUERY) {
      (async () => {
        try {
          const cfg = await deps.loadConfig();
          const tabId = msg.tabId || "default";
          const result = await deps.callOpenRouter(msg.prompt, msg.webSearch, msg.reasoning, tabId);
          await deps.addHistoryEntry(msg.prompt, result.answer);
          sendResponse({
            ok: true,
            answer: result.answer,
            model: cfg.model,
            tokens: result.tokens,
            contextSize: result.contextSize,
            reasoning: result.reasoning
          });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.IMAGE_QUERY) {
      (async () => {
        try {
          const result = await deps.callImageGeneration(msg.prompt, msg.provider || null, msg.model || null);
          sendResponse({ ok: true, image: result });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.CLEAR_CONTEXT) {
      (async () => {
        try {
          await deps.ensureContextLoaded();
          const tabId = msg.tabId || "default";
          deps.conversationContexts.delete(tabId);
          await deps.removeContextForTab(tabId);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.SUMMARIZE_THREAD) {
      (async () => {
        try {
          const result = await deps.callOpenRouterWithMessages(msg.messages || [], msg.model || null, msg.provider || null);
          sendResponse({ ok: true, summary: result.answer, tokens: result.tokens });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === "get_context_size") {
      (async () => {
        try {
          await deps.ensureContextLoaded();
          const tabId = msg.tabId || "default";
          const contextSize = deps.conversationContexts.has(tabId) ? deps.conversationContexts.get(tabId).length : 0;
          sendResponse({ ok: true, contextSize });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.GET_BALANCE) {
      (async () => {
        try {
          const result = await deps.getProviderBalance();
          sendResponse({ ok: true, balance: result.balance, supported: result.supported });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === "get_history") {
      (async () => {
        try {
          const history = await deps.loadHistory();
          sendResponse({ ok: true, history });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === "delete_history_item" && msg.id) {
      (async () => {
        try {
          const history = await deps.loadHistory();
          const filtered = history.filter((h) => h.id !== msg.id);
          await deps.saveHistory(filtered);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === "get_config") {
      (async () => {
        try {
          const cfg = await deps.loadConfig();
          sendResponse({ ok: true, config: cfg });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === "set_model" && msg.model) {
      (async () => {
        try {
          const provider = deps.normalizeProviderId(msg.provider || deps.cachedConfig.modelProvider || deps.cachedConfig.provider);
          const keyItems = await deps.getLocalStorage([deps.STORAGE_KEYS.API_KEY]);
          await deps.setLocalStorage({
            [deps.STORAGE_KEYS.MODEL]: msg.model,
            [deps.STORAGE_KEYS.MODEL_PROVIDER]: provider
          });
          deps.cachedConfig.model = msg.model;
          deps.cachedConfig.modelProvider = provider;
          deps.cachedConfig.apiKey = keyItems[deps.STORAGE_KEYS.API_KEY] || "";
          deps.setLastConfigLoadAt(Date.now());
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === "get_context" && msg.tabId) {
      (async () => {
        try {
          await deps.ensureContextLoaded();
          const context = deps.conversationContexts.get(msg.tabId) || [];
          sendResponse({ ok: true, context });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.GET_MODELS || msg?.type === "get_models") {
      (async () => {
        try {
          const keys = await deps.getLocalStorage([
            deps.STORAGE_KEYS.API_KEY
          ]);
          const apiKey = keys[deps.STORAGE_KEYS.API_KEY] || "";

          if (!apiKey) {
            sendResponse({ ok: true, models: [], reason: "no_enabled_providers" });
            return;
          }

          const models = await deps.getProviderModels("openrouter", apiKey);
          const combinedModels = models.map((model) => {
            const displayName = deps.buildModelDisplayName("openrouter", model.id);
            return {
              id: deps.buildCombinedModelId("openrouter", model.id),
              rawId: model.id,
              provider: "openrouter",
              displayName,
              name: displayName,
              vendorLabel: model.vendorLabel,
              supportsChat: Boolean(model.supportsChat),
              supportsImages: Boolean(model.supportsImages),
              outputsImage: Boolean(model.outputsImage),
              isImageOnly: Boolean(model.isImageOnly),
              supportedParameters: model.supportedParameters || null
            };
          });

          sendResponse({ ok: true, models: combinedModels });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.SET_PROVIDER) {
      (async () => {
        try {
          const provider = deps.normalizeProviderId(msg.provider);
          await deps.setLocalStorage({ [deps.STORAGE_KEYS.PROVIDER]: provider });
          const { modelsKey, timeKey } = deps.getModelsCacheKeys(provider);
          await chromeApi.storage.local.remove([modelsKey, timeKey]);
          deps.cachedConfig.provider = provider;
          deps.cachedConfig.modelProvider = provider;
          deps.cachedConfig.apiKey = null;
          deps.cachedConfig.model = deps.DEFAULTS.MODEL;
          deps.setLastConfigLoadAt(0);
          delete deps.lastBalanceByProvider[provider];
          delete deps.lastBalanceAtByProvider[provider];
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.REQUEST_PERMISSION) {
      (async () => {
        try {
          const url = msg.url;
          if (!url) {
            sendResponse({ ok: false, error: "No URL provided" });
            return;
          }
          const urlObj = new URL(url);
          const origin = `${urlObj.protocol}//${urlObj.host}/*`;
          const granted = await chromeApi.permissions.request({ origins: [origin] });
          sendResponse({ ok: true, granted });
        } catch (e) {
          console.error("Permission request error:", e);
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg?.type === deps.MESSAGE_TYPES.SUMMARIZE_PAGE) {
      deps.handleSummarizePage(msg, sendResponse);
      return true;
    }

    return false;
  });
}
