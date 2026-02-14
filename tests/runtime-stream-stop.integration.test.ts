export {};

const { stopActiveStream } = require("../src/sidepanel/sidepanel-stream-controller-utils.js");
const { stopStreaming } = require("../src/projects/projects-send-controller-utils.js");

describe("runtime stream stop integration", () => {
  test("sidepanel stop disconnects active stream and is idempotent", () => {
    const disconnect = jest.fn();
    const state = { activePort: { disconnect } };
    const askBtn = { disabled: true };
    const metaEl = { textContent: "" };
    const showToast = jest.fn();

    const first = stopActiveStream({
      state,
      setPromptStreamingState: jest.fn(),
      askBtn,
      metaEl,
      hideTypingIndicator: jest.fn(),
      showToast
    });
    const second = stopActiveStream({
      state,
      setPromptStreamingState: jest.fn(),
      askBtn,
      metaEl,
      hideTypingIndicator: jest.fn(),
      showToast
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(state.activePort).toBeNull();
    expect(askBtn.disabled).toBe(false);
    expect(metaEl.textContent).toContain("Generation stopped");
    expect(showToast).toHaveBeenCalledTimes(1);
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

  test("projects stopStreaming is idempotent and disconnects once", () => {
    const disconnect = jest.fn();
    let streamPort: any = { disconnect };

    const deps = {
      getStreamPort: () => streamPort,
      setStreamPort: (value: any) => { streamPort = value; },
      setIsStreaming: jest.fn(),
      setSendStreamingState: jest.fn(),
      elements: { sendBtn: {} },
      setChatStreamingState: jest.fn(),
      showToast: jest.fn()
    };

    stopStreaming(deps);
    stopStreaming(deps);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(deps.setSendStreamingState).toHaveBeenCalledTimes(2);
    expect(deps.showToast).toHaveBeenCalledTimes(2);
  });
});
