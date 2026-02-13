const {
  stopStreaming,
  renderStreamError
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
