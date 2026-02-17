export {};

const { askQuestion } = require("../src/sidepanel/sidepanel-prompt-controller-utils.js");
const { stopActiveStream } = require("../src/sidepanel/sidepanel-stream-controller-utils.js");
const { streamMessage, stopStreaming } = require("../src/projects/projects-send-controller-utils.js");

function createMockPort() {
  const messageListeners: Array<(msg: any) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  return {
    onMessage: {
      addListener: (fn: (msg: any) => void) => {
        messageListeners.push(fn);
      }
    },
    onDisconnect: {
      addListener: (fn: () => void) => {
        disconnectListeners.push(fn);
      }
    },
    postMessage: jest.fn(),
    disconnect: jest.fn(() => {
      disconnectListeners.slice().forEach((fn) => fn());
    }),
    emitMessage: (msg: any) => {
      messageListeners.slice().forEach((fn) => fn(msg));
    }
  };
}

describe("runtime stream stop integration", () => {
  test("sidepanel stop disconnects active stream and suppresses fallback error on disconnect", async () => {
    const originalChrome = (global as any).chrome;
    const port = createMockPort();
    (global as any).chrome = {
      runtime: {
        connect: () => port
      }
    };

    const answerEl = document.createElement("div");
    const answerSection = document.createElement("div");
    const promptEl: any = { value: "hello", style: { height: "44px" } };
    const askBtn: any = { disabled: false };
    const metaEl: any = { textContent: "" };
    const typingIndicator = document.createElement("div");
    const estimatedCostEl: any = { style: { display: "block" } };

    const getStreamingFallbackMessage = jest.fn(() => "fallback message");
    const buildStreamErrorHtml = jest.fn((message: string) => `<div class=\"err\">${message}</div>`);

    const state: any = {
      activePort: null,
      streamStopRequested: false,
      streamStoppedByUser: false,
      imageModeEnabled: false,
      reasoningEnabled: false,
      webSearchEnabled: false,
      selectedCombinedModelId: null,
      currentProvider: "openrouter",
      lastStreamContext: null
    };

    await askQuestion({
      state,
      promptEl,
      sanitizePrompt: (value: string) => value.trim(),
      metaEl,
      clearPromptAfterSend: (el: any) => { el.value = ""; },
      generateImageImpl: jest.fn(),
      askBtn,
      setPromptStreamingState: jest.fn(),
      showAnswerBox: jest.fn(),
      answerEl,
      typingIndicator,
      showTypingIndicator: jest.fn(),
      answerSection,
      queryActiveTab: async () => [{ id: 1 }],
      sendRuntimeMessage: async (payload: any) => {
        if (payload?.type === "get_context_size") {
          return { contextSize: 0 };
        }
        return { ok: true };
      },
      getProviderLabelSafe: () => "OpenRouter",
      updateAnswerVisibility: jest.fn(),
      hideTypingIndicator: jest.fn(),
      buildStreamErrorHtml,
      getStreamingFallbackMessage,
      extractReasoningFromStreamChunk: null,
      extractSources: (content: string) => ({ sources: [], cleanText: content }),
      applyMarkdownStyles: (value: string) => value,
      safeHtmlSetter: null,
      modelMap: new Map(),
      getModelDisplayName: () => "default model",
      UI_CONSTANTS: { TOKEN_BAR_MAX_TOKENS: 4000 },
      removeReasoningBubbles: jest.fn(),
      makeSourceReferencesClickable: jest.fn(),
      createSourcesIndicator: jest.fn(),
      renderSourcesSummary: jest.fn(),
      contextViz: null,
      escapeHtml: (value: string) => value,
      estimatedCostEl,
      refreshBalance: jest.fn().mockResolvedValue(undefined)
    });

    const stopped = stopActiveStream({
      state,
      setPromptStreamingState: jest.fn(),
      askBtn,
      metaEl,
      hideTypingIndicator: jest.fn(),
      showToast: jest.fn()
    });

    expect(stopped).toBe(true);
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    expect(getStreamingFallbackMessage).not.toHaveBeenCalled();
    expect(buildStreamErrorHtml).not.toHaveBeenCalled();

    (global as any).chrome = originalChrome;
  });

  test("sidepanel stop is no-op without active stream", () => {
    const showToast = jest.fn();
    const stopped = stopActiveStream({
      state: { activePort: null },
      showToast
    });

    expect(stopped).toBe(false);
    expect(showToast).not.toHaveBeenCalled();
  });


  test("sidepanel stop is idempotent on rapid double-click", () => {
    const disconnect = jest.fn();
    const state: any = {
      activePort: { disconnect },
      streamStopRequested: false,
      streamStoppedByUser: false
    };
    const showToast = jest.fn();

    const first = stopActiveStream({
      state,
      setPromptStreamingState: jest.fn(),
      askBtn: { disabled: true },
      metaEl: { textContent: "" },
      hideTypingIndicator: jest.fn(),
      showToast
    });
    const second = stopActiveStream({
      state,
      setPromptStreamingState: jest.fn(),
      askBtn: { disabled: true },
      metaEl: { textContent: "" },
      hideTypingIndicator: jest.fn(),
      showToast
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  test("projects stream promise resolves when stream disconnects during stop", async () => {
    const disconnect = jest.fn();
    const messageListeners: Array<(msg: any) => void> = [];
    const disconnectListeners: Array<() => void> = [];
    const port: any = {
      onMessage: {
        addListener: (fn: (msg: any) => void) => {
          messageListeners.push(fn);
        }
      },
      onDisconnect: {
        addListener: (fn: () => void) => {
          disconnectListeners.push(fn);
        }
      },
      postMessage: jest.fn(),
      disconnect: jest.fn(() => {
        disconnect();
        disconnectListeners.slice().forEach((fn) => fn());
      })
    };

    let streamPort: any = null;
    let isStreaming = true;

    const deps: any = {
      createPort: () => port,
      setStreamPort: (value: any) => { streamPort = value; },
      createStreamChunkState: () => ({ assistantBubble: null, messageDiv: document.createElement("div"), fullContent: "" }),
      createReasoningAppender: jest.fn(),
      safeHtmlSetter: null,
      applyContentChunk: jest.fn(() => false),
      applyReasoningChunk: jest.fn(() => false),
      extractReasoningFromStreamChunk: null,
      renderAssistantContent: jest.fn(),
      elements: { chatMessages: document.createElement("div"), sendBtn: {} },
      buildStreamMeta: jest.fn(),
      buildModelDisplayName: jest.fn(),
      currentProvider: () => "openrouter",
      addMessageToThread: jest.fn(),
      buildAssistantMessage: jest.fn(),
      currentThreadId: () => "thread_1",
      getThread: jest.fn(),
      updateProjectsContextButton: jest.fn(),
      currentProjectData: jest.fn(),
      updateAssistantFooter: jest.fn(),
      getTokenBarStyle: jest.fn(),
      getSourcesData: jest.fn(() => ({ sources: [], cleanText: "" })),
      renderChatSourcesSummary: jest.fn(),
      removeReasoningBubbles: jest.fn(),
      disconnectStreamPort: (value: any) => {
        if (value) value.disconnect();
        return null;
      },
      makeSourceReferencesClickable: jest.fn(),
      createSourcesIndicator: jest.fn(),
      resolveStreamToggles: jest.fn(() => ({ webSearch: false, reasoning: false })),
      buildStreamMessages: jest.fn(() => []),
      buildStartStreamPayload: jest.fn(() => ({ type: "start_stream" })),
      setIsStreaming: (value: boolean) => { isStreaming = value; },
      getIsStreaming: () => isStreaming,
      setSendStreamingState: jest.fn(),
      setChatStreamingState: jest.fn(),
      showToast: jest.fn(),
      getStreamPort: () => streamPort,
      retryStreamFromContext: jest.fn(),
      getStreamErrorHtml: jest.fn(),
      renderStreamErrorRuntime: jest.fn(),
      lastStreamContext: jest.fn()
    };

    streamPort = port;

    const promise = streamMessage(deps, "prompt", { customInstructions: "" }, { messages: [], summary: "" }, {}, Date.now(), { webSearch: false, reasoning: false });
    stopStreaming(deps);
    await expect(promise).resolves.toBeUndefined();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(deps.showToast).toHaveBeenCalledTimes(1);
    expect(streamPort).toBeNull();
  });

  test("projects stopStreaming is idempotent and returns false when already idle", () => {
    let streamPort: any = { disconnect: jest.fn() };

    const deps: any = {
      getStreamPort: () => streamPort,
      setStreamPort: (value: any) => { streamPort = value; },
      setIsStreaming: jest.fn(),
      getIsStreaming: () => Boolean(streamPort),
      setSendStreamingState: jest.fn(),
      elements: { sendBtn: {} },
      setChatStreamingState: jest.fn(),
      showToast: jest.fn()
    };

    const first = stopStreaming(deps);
    const second = stopStreaming(deps);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(deps.showToast).toHaveBeenCalledTimes(1);
  });
});
