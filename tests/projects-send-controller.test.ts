const {
  stopStreaming,
  renderStreamError,
  streamMessage
} = require("../src/projects/projects-send-controller-utils.js");
export {};

describe("projects-send-controller-utils", () => {
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
    const content = { innerHTML: "" };
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
