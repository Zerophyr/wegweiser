export {};

const {
  renderStreamError,
  retryStreamFromContext,
  createReasoningAppender,
  renderAssistantContent,
  buildStreamMeta,
  disconnectStreamPort
} = require("../src/projects/projects-stream-runtime-utils.js");

describe("projects stream runtime utils", () => {
  test("renderStreamError wires retry click and sanitizes html", async () => {
    document.body.innerHTML = '<div id="c"></div>';
    const content = document.getElementById("c");
    const ui = { content };
    let retried = false;

    renderStreamError(ui, "boom", { id: "ctx" }, {
      getStreamErrorHtml: () => '<button class="retry-btn" type="button">Retry</button>',
      setSanitizedHtml: (el: HTMLElement, html: string) => { el.innerHTML = html; },
      getRetryInProgress: () => false,
      getIsStreaming: () => false,
      retryStreamFromContext: async () => { retried = true; }
    });

    const btn = content?.querySelector(".retry-btn") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    await Promise.resolve();
    expect(retried).toBe(true);
  });

  test("retryStreamFromContext exits early when missing context", async () => {
    const calls: string[] = [];
    await retryStreamFromContext(null, {}, {
      getIsStreaming: () => false,
      setRetryInProgress: () => {},
      showToast: (msg: string) => calls.push(msg)
    });
    expect(calls[0]).toContain("Nothing to retry yet");
  });

  test("retryStreamFromContext executes stream and resets state", async () => {
    const sendBtn = document.createElement("button");
    sendBtn.style.display = "block";
    const state = { isStreaming: false, retry: false, streamingUiReset: false, streamCalled: false };

    await retryStreamFromContext(
      {
        prompt: "hello",
        threadId: "t-1",
        projectId: "p-1",
        model: "m",
        modelProvider: "openrouter",
        modelDisplayName: "M",
        customInstructions: "",
        webSearch: true,
        reasoning: false
      },
      {},
      {
        getIsStreaming: () => state.isStreaming,
        setRetryInProgress: (value: boolean) => { state.retry = value; },
        getThread: async () => ({ id: "t-1" }),
        getProject: async () => ({ id: "p-1" }),
        resetStreamingUi: () => { state.streamingUiReset = true; },
        sendBtn,
        setChatStreamingState: () => {},
        setIsStreaming: (value: boolean) => { state.isStreaming = value; },
        streamMessage: async () => { state.streamCalled = true; },
        renderThreadList: async () => {}
      }
    );

    expect(state.streamingUiReset).toBe(true);
    expect(state.streamCalled).toBe(true);
    expect(state.retry).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(sendBtn.style.display).toBe("block");
  });

  test("reasoning appender creates bubble and appends text", () => {
    document.body.innerHTML = '<div class="chat-message"><div class="chat-bubble"><div class="chat-content"></div></div></div>';
    const messageDiv = document.querySelector(".chat-message") as HTMLElement;
    const assistantBubble = messageDiv.querySelector(".chat-content") as HTMLElement;
    const appender = createReasoningAppender(messageDiv, assistantBubble);
    appender.append("step 1");
    appender.append(" + step 2");
    const reasoning = messageDiv.querySelector(".reasoning-text") as HTMLElement;
    expect(reasoning).toBeTruthy();
    expect(reasoning.textContent).toContain("step 1 + step 2");
  });

  test("renderAssistantContent prefers sanitized sink", () => {
    const el = document.createElement("div");
    let captured = "";
    renderAssistantContent(el, "Hello", {
      applyMarkdownStyles: (v: string) => `<p>${v}</p>`,
      setSanitizedHtml: (_el: HTMLElement, html: string) => { captured = html; }
    });
    expect(captured).toBe("<p>Hello</p>");
    expect(el.innerHTML).toBe("");
  });

  test("buildStreamMeta resolves model display and tokens", () => {
    const meta = buildStreamMeta(
      { model: "fallback", tokens: 25, contextSize: 4 },
      { model: "gpt-5", modelProvider: "openrouter" },
      1.234,
      { buildModelDisplayName: () => "Display Name", currentProvider: "openrouter" }
    );
    expect(meta.model).toBe("Display Name");
    expect(meta.tokens).toBe(25);
    expect(meta.contextSize).toBe(4);
    expect(meta.responseTimeSec).toBe(1.23);
  });

  test("disconnectStreamPort tolerates errors", () => {
    const value = disconnectStreamPort({ disconnect: () => { throw new Error("x"); } });
    expect(value).toBeNull();
  });
});
