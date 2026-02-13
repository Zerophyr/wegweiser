export {};

const {
  createStreamChunkState,
  applyContentChunk,
  applyReasoningChunk
} = require("../src/projects/projects-stream-chunk-utils.js");

describe("projects stream chunk utils", () => {
  test("createStreamChunkState initializes stream state", () => {
    document.body.innerHTML = '<div class="msg"><div class="chat-content"></div></div>';
    const ui = {
      messageDiv: document.querySelector(".msg"),
      content: document.querySelector(".chat-content")
    };
    const state = createStreamChunkState(ui, () => ({ append: () => {} }));
    expect(state.fullContent).toBe("");
    expect(state.assistantBubble).toBeTruthy();
    expect(state.reasoningStreamState).toEqual({ inReasoning: false, carry: "" });
  });

  test("applyContentChunk appends content and reasoning", () => {
    document.body.innerHTML = '<div class="msg"><div class="chat-content"></div></div>';
    const ui = {
      messageDiv: document.querySelector(".msg"),
      content: document.querySelector(".chat-content")
    };
    let reasoning = "";
    let rendered = "";
    let scrolled = false;

    const state = createStreamChunkState(ui, () => ({
      append: (text: string) => { reasoning += text; }
    }));

    const consumed = applyContentChunk(state, { type: "content", content: "<think>a</think>b" }, {
      extractReasoningFromStreamChunk: () => ({ content: "b", reasoning: "a" }),
      renderAssistantContent: (_el: HTMLElement, text: string) => { rendered = text; },
      scrollToBottom: () => { scrolled = true; }
    });

    expect(consumed).toBe(true);
    expect(reasoning).toBe("a");
    expect(state.fullContent).toBe("b");
    expect(rendered).toBe("b");
    expect(scrolled).toBe(true);
  });

  test("applyReasoningChunk handles reasoning event", () => {
    const state = {
      reasoningAppender: { append: jest.fn() }
    };
    const consumed = applyReasoningChunk(state, { type: "reasoning", reasoning: "x" });
    expect(consumed).toBe(true);
    expect(state.reasoningAppender.append).toHaveBeenCalledWith("x");
  });
});
