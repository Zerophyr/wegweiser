export {};
const {
  buildHistoryPreviewHtml,
  buildHistoryDetailHtml
} = require("../src/options/options-history-view-utils.js");

describe("options history view utils", () => {
  test("builds preview html with escaped prompt and response snippets", () => {
    const html = buildHistoryPreviewHtml(
      { promptText: "<x>", answerText: "**bold**" },
      "now",
      (v: string) => v.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      (v: string) => v
    );
    expect(html).toContain("&lt;x&gt;");
    expect(html).toContain("Response:");
    expect(html).toContain("Click to view full context");
  });

  test("builds detail html with markdown answer container", () => {
    const html = buildHistoryDetailHtml(
      { promptText: "p", answerText: "a", createdAt: 1 },
      "now",
      (v: string) => v
    );
    expect(html).toContain("history-answer-markdown");
    expect(html).toContain("Copy Prompt");
    expect(html).toContain("Copy Answer");
    expect(html).toContain("Delete");
  });
});
