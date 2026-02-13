export {};
const {
  buildAssistantMessage,
  buildStreamMessages,
  getTypingIndicatorHtml,
  getStreamErrorHtml
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
});
