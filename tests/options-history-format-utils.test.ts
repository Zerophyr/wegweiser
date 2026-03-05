export {};

const {
  coerceHistoryText,
  extractDisplayTextFromKnownUiHtml,
  normalizeHistoryEntryForDisplay,
  buildPreviewSnippet
} = require("../src/options/options-history-format-utils.js");

describe("options history format utils", () => {
  test("coerceHistoryText handles nulls and objects", () => {
    expect(coerceHistoryText(null)).toBe("");
    expect(coerceHistoryText(123)).toBe("123");
    expect(coerceHistoryText({ prompt: "hello" })).toBe("hello");
  });

  test("extractDisplayTextFromKnownUiHtml unwraps known extension wrappers", () => {
    const raw = `
      <div class="answer-item">
        <div class="answer-content">Line 1<br>Line 2</div>
      </div>
    `;
    expect(extractDisplayTextFromKnownUiHtml(raw)).toContain("Line 1");
    expect(extractDisplayTextFromKnownUiHtml(raw)).toContain("Line 2");
  });

  test("extractDisplayTextFromKnownUiHtml preserves unknown raw html/code text", () => {
    const raw = "<div class=custom-code>const x = 1;</div>";
    expect(extractDisplayTextFromKnownUiHtml(raw)).toBe(raw);
  });

  test("normalizeHistoryEntryForDisplay adds promptText and answerText", () => {
    const entry = normalizeHistoryEntryForDisplay({
      prompt: "<div class=history-preview><div>Ignore</div><div>Prompt:</div><div>Hello</div></div>",
      answer: "<div class='answer-content'>World</div>"
    });
    expect(entry.promptText).toContain("Hello");
    expect(entry.answerText).toContain("World");
  });

  test("buildPreviewSnippet trims and truncates", () => {
    expect(buildPreviewSnippet("a b", 10)).toBe("a b");
    expect(buildPreviewSnippet("0123456789ABC", 10)).toBe("0123456789...");
  });
});
