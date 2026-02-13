export {};

const {
  clearChatInput,
  createGeneratingImageMessage,
  resolveAssistantModelLabel,
  buildStreamContext,
  setSendStreamingState
} = require("../src/projects/projects-message-flow-utils.js");

describe("projects message flow utils", () => {
  test("clearChatInput resets value and height", () => {
    const input = document.createElement("textarea");
    input.value = "hello";
    input.style.height = "100px";
    clearChatInput(input);
    expect(input.value).toBe("");
    expect(input.style.height).toBe("auto");
  });

  test("createGeneratingImageMessage uses card builder when provided", () => {
    const el = createGeneratingImageMessage(() => {
      const card = document.createElement("div");
      card.className = "image-card";
      return card;
    });
    expect(el.querySelector(".image-card")).toBeTruthy();
  });

  test("resolveAssistantModelLabel prefers explicit display name", () => {
    expect(resolveAssistantModelLabel({ modelDisplayName: "A" }, "openrouter")).toBe("A");
    expect(resolveAssistantModelLabel({ model: "gpt-5" }, "openrouter", () => "B")).toBe("B");
    expect(resolveAssistantModelLabel({}, "openrouter")).toBe("default model");
  });

  test("buildStreamContext normalizes fields", () => {
    const ctx = buildStreamContext({
      content: "Hi",
      currentProjectId: "p",
      currentThreadId: "t",
      project: { model: "m", modelProvider: "naga", customInstructions: "x" },
      summary: "s",
      webSearch: 1,
      reasoning: 0
    });
    expect(ctx.prompt).toBe("Hi");
    expect(ctx.projectId).toBe("p");
    expect(ctx.threadId).toBe("t");
    expect(ctx.model).toBe("m");
    expect(ctx.modelProvider).toBe("naga");
    expect(ctx.summary).toBe("s");
    expect(ctx.webSearch).toBe(true);
    expect(ctx.reasoning).toBe(false);
  });

  test("setSendStreamingState toggles button and invokes callback", () => {
    const btn = document.createElement("button");
    let state = false;
    setSendStreamingState(btn, (v: boolean) => { state = v; }, true);
    expect(btn.style.display).toBe("none");
    expect(state).toBe(true);
    setSendStreamingState(btn, (v: boolean) => { state = v; }, false);
    expect(btn.style.display).toBe("block");
    expect(state).toBe(false);
  });
});
