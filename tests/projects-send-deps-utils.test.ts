export {};

const {
  buildRenderStreamErrorDeps,
  buildRetryStreamFromContextDeps,
  buildSendImageMessageDeps,
  buildSendMessageDeps,
  buildStreamMessageDeps,
  buildStopStreamingDeps
} = require("../src/projects/projects-send-deps-utils.js");

describe("projects-send-deps-utils", () => {
  test("builders keep expected keys for render and retry deps", () => {
    const renderDeps = buildRenderStreamErrorDeps({
      renderStreamErrorRuntime: jest.fn(),
      getStreamErrorHtml: jest.fn(),
      safeHtmlSetter: jest.fn(),
      getRetryInProgress: jest.fn(),
      getIsStreaming: jest.fn(),
      retryStreamFromContext: jest.fn()
    });

    expect(Object.keys(renderDeps).sort()).toEqual([
      "getIsStreaming",
      "getRetryInProgress",
      "getStreamErrorHtml",
      "renderStreamErrorRuntime",
      "retryStreamFromContext",
      "safeHtmlSetter"
    ]);

    const retryDeps = buildRetryStreamFromContextDeps({
      retryStreamFromContextRuntime: jest.fn(),
      setRetryInProgress: jest.fn(),
      setIsStreaming: jest.fn(),
      setChatStreamingState: jest.fn(),
      streamMessage: jest.fn()
    });

    expect(retryDeps.retryStreamFromContextRuntime).toBeDefined();
    expect(retryDeps.setRetryInProgress).toBeDefined();
    expect(retryDeps.streamMessage).toBeDefined();
  });

  test("builders keep expected keys for send/stream/stop deps", () => {
    const sendImageDeps = buildSendImageMessageDeps({
      currentThreadId: jest.fn(),
      renderThreadList: jest.fn()
    });
    expect(sendImageDeps.currentThreadId).toBeDefined();
    expect(sendImageDeps.renderThreadList).toBeDefined();

    const sendDeps = buildSendMessageDeps({
      elements: {},
      summarizationDeps: {},
      streamMessage: jest.fn()
    });
    expect(sendDeps.elements).toEqual({});
    expect(sendDeps.summarizationDeps).toEqual({});
    expect(sendDeps.streamMessage).toBeDefined();

    const streamDeps = buildStreamMessageDeps({
      createPort: jest.fn(),
      buildStartStreamPayload: jest.fn()
    });
    expect(streamDeps.createPort).toBeDefined();
    expect(streamDeps.buildStartStreamPayload).toBeDefined();

    const stopDeps = buildStopStreamingDeps({
      getStreamPort: jest.fn(),
      showToast: jest.fn()
    });
    expect(stopDeps.getStreamPort).toBeDefined();
    expect(stopDeps.showToast).toBeDefined();
  });
});