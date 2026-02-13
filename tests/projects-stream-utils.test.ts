export {};
const {
  buildAssistantMessage,
  buildStreamMessages,
  getTypingIndicatorHtml,
  getStreamErrorHtml,
  createStreamingAssistantMessage,
  updateAssistantFooter,
  resetStreamingUi
} = require("../src/projects/projects-stream-utils.js");

describe("projects stream helpers", () => {
  test("builds assistant message shape", () => {
    expect(buildAssistantMessage("Hi", { model: "x" })).toEqual({
      role: "assistant",
      content: "Hi",
      meta: { model: "x" }
    });
  });

  test("buildStreamMessages removes duplicate trailing prompt and prepends system messages", () => {
    const result = buildStreamMessages(
      [{ role: "user", content: "Hello" }],
      "Hello",
      "Use concise style",
      "Summary data"
    );
    expect(result).toEqual([
      { role: "system", content: "Use concise style" },
      { role: "system", content: "Summary so far:\nSummary data" }
    ]);
  });

  test("typing indicator and stream error html render expected markers", () => {
    expect(getTypingIndicatorHtml()).toContain("typing-indicator");
    const html = getStreamErrorHtml("<xss>", (v: string) => v.replace("<", "&lt;"));
    expect(html).toContain("&lt;xss>");
    expect(html).toContain("retry-btn");
  });

  test("create/update/reset streaming ui helpers", () => {
    const ui = createStreamingAssistantMessage(() => ({ percent: 15, gradient: "linear-gradient(red, blue)" }));
    expect(ui.content.innerHTML).toContain("typing-indicator");
    expect(ui.tokenFillEl.style.width).toBe("15%");

    updateAssistantFooter(
      ui,
      { model: "test-model", tokens: 321, responseTimeSec: 1.23, contextSize: 6, createdAt: 1700000000000 },
      () => ({ percent: 40, gradient: "linear-gradient(green, yellow)" })
    );
    expect(ui.tokensEl.textContent).toBe("321 tokens");
    expect(ui.timeEl.textContent).toBe("1.23s");
    expect(ui.contextBadgeEl.style.display).toBe("inline-flex");
    expect(ui.tokenFillEl.style.width).toBe("40%");
    expect(ui.tokenBarEl.getAttribute("aria-valuenow")).toBe("40");

    const reasoning = document.createElement("div");
    reasoning.className = "chat-reasoning-bubble";
    ui.wrapper.appendChild(reasoning);
    ui.content.innerHTML = "<p>done</p>";
    ui.sourcesSummaryEl.textContent = "src";

    resetStreamingUi(ui, () => ({ percent: 0, gradient: "linear-gradient(black, white)" }));
    expect(ui.content.innerHTML).toContain("typing-indicator");
    expect(ui.metaText.textContent).toBe("Streaming...");
    expect(ui.tokensEl.textContent).toBe("-- tokens");
    expect(ui.sourcesSummaryEl.textContent).toBe("");
    expect(ui.wrapper.querySelector(".chat-reasoning-bubble")).toBeNull();
    expect(ui.tokenBarEl.getAttribute("aria-valuenow")).toBe("0");
  });
});
