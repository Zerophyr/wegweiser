const {
  stopStreaming,
  renderStreamError,
  sendMessage,
  streamMessage
} = require("../src/projects/projects-send-controller-utils.js");
export {};

describe("projects-send-controller-utils", () => {
  test("sendMessage keeps streaming state when an older stream settles after a newer one starts", async () => {
    const deferred = () => {
      let resolve: () => void = () => {};
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    };

    const firstStream = deferred();
    const secondStream = deferred();

    const threadMessages: any[] = [];
    const chatMessages = document.createElement("div");
    const chatInput: any = { value: "first prompt", style: { height: "44px" } };

    let isStreaming = false;
    let streamPort: any = null;
    let streamCall = 0;

    const deps: any = {
      elements: {
        chatInput,
        chatMessages,
        sendBtn: {}
      },
      currentThreadId: () => "thread_1",
      currentProjectId: () => "project_1",
      getIsStreaming: () => isStreaming,
      getProject: async () => ({ customInstructions: "", model: "openai/gpt-4o-mini", modelProvider: "openrouter" }),
      getImageModeEnabled: () => false,
      addMessageToThread: async (_threadId: string, message: any) => {
        threadMessages.push(message);
      },
      clearChatInput: (input: any) => { input.value = ""; },
      getThread: async () => ({ messages: [...threadMessages], summary: "" }),
      maybeSummarizeBeforeStreaming: async (thread: any) => thread,
      summarizationDeps: {},
      renderChatMessages: jest.fn(),
      buildStreamContext: jest.fn(() => ({ webSearch: false, reasoning: false })),
      currentProvider: () => "openrouter",
      setLastStreamContext: jest.fn(),
      createStreamingAssistantMessage: () => ({ messageDiv: document.createElement("div"), content: document.createElement("div") }),
      getTokenBarStyle: jest.fn(),
      setSendStreamingState: jest.fn(),
      setChatStreamingState: jest.fn(),
      setIsStreaming: (value: boolean) => { isStreaming = value; },
      getStreamPort: () => streamPort,
      streamMessage: jest.fn(() => {
        streamCall += 1;
        if (streamCall === 1) {
          streamPort = { id: "port-1" };
          return firstStream.promise;
        }
        streamPort = { id: "port-2" };
        return secondStream.promise;
      }),
      showToast: jest.fn(),
      renderThreadList: jest.fn()
    };

    const firstSend = sendMessage(deps);

    // Simulate user stop before first stream settles, then start a new stream.
    isStreaming = false;
    streamPort = null;
    chatInput.value = "second prompt";

    const secondSend = sendMessage(deps);

    firstStream.resolve();
    await firstSend;

    expect(streamPort).toEqual({ id: "port-2" });
    expect(isStreaming).toBe(true);

    streamPort = null;
    secondStream.resolve();
    await secondSend;

    expect(isStreaming).toBe(false);
  });

  test("stopStreaming disconnects active port and resets state", () => {
    const disconnect = jest.fn();
    let streamPort = { disconnect };
    let isStreaming = true;
    const setSendStreamingState = jest.fn();
    const showToast = jest.fn();

    stopStreaming({
      getStreamPort: () => streamPort,
      setStreamPort: (value: any) => { streamPort = value; },
      setIsStreaming: (value: any) => { isStreaming = value; },
      setSendStreamingState,
      elements: { sendBtn: {} },
      setChatStreamingState: jest.fn(),
      showToast
    });

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(streamPort).toBeNull();
    expect(isStreaming).toBe(false);
    expect(setSendStreamingState).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Generation stopped", "info");
  });



  test("streamMessage uses provided renderStreamError callback on stream errors", async () => {
    let messageListener: any = null;
    const renderStreamErrorSpy = jest.fn();
    const setStreamPort = jest.fn();

    const port = {
      onMessage: {
        addListener: (fn: any) => { messageListener = fn; }
      },
      onDisconnect: {
        addListener: jest.fn()
      },
      postMessage: jest.fn(() => {
        if (messageListener) {
          messageListener({ type: "error", error: "boom" });
        }
      }),
      disconnect: jest.fn()
    };

    await expect(streamMessage({
      createPort: () => port,
      setStreamPort,
      createStreamChunkState: () => ({ assistantBubble: null, messageDiv: {}, fullContent: "" }),
      createReasoningAppender: () => null,
      safeHtmlSetter: null,
      applyContentChunk: () => false,
      applyReasoningChunk: () => false,
      buildStreamMessages: () => [],
      resolveStreamToggles: () => ({ webSearch: false, reasoning: false }),
      buildStartStreamPayload: () => ({ type: "start_stream" }),
      elements: { chatMessages: {}, sendBtn: {} },
      disconnectStreamPort: () => null,
      setIsStreaming: jest.fn(),
      renderStreamError: renderStreamErrorSpy,
      lastStreamContext: () => null,
      getIsStreaming: () => false,
      currentProvider: () => "openrouter",
      currentThreadId: () => "thread-1"
    }, "hello", { id: "project-1" }, { messages: [] }, { content: {}, metaText: null }, Date.now(), {})).rejects.toThrow("boom");

    expect(renderStreamErrorSpy).toHaveBeenCalledWith({ content: {}, metaText: null }, "boom", null);
    expect(setStreamPort).toHaveBeenCalled();
  });
  test("renderStreamError fallback writes HTML", () => {
    const content = document.createElement("div");
    renderStreamError({
      renderStreamErrorRuntime: null,
      getStreamErrorHtml: (msg: any) => `ERR:${msg}`,
      safeHtmlSetter: null,
      getRetryInProgress: () => false,
      getIsStreaming: () => false,
      retryStreamFromContext: jest.fn()
    }, { content }, "oops", null);

    expect(content.innerHTML).toBe("ERR:oops");
  });
});
