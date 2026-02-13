export {};
const {
  buildHistoryPreviewHtml,
  buildHistoryDetailHtml
} = require("../src/options/options-history-view-utils.js");

describe("options history view utils", () => {
  test("builds preview html with escaped prompt", () => {
    const html = buildHistoryPreviewHtml(
      { prompt: "<x>", createdAt: 1 },
      "now",
      (v: string) => v.replace("<", "&lt;").replace(">", "&gt;")
    );
    expect(html).toContain("&lt;x&gt;");
    expect(html).toContain("Click to view full context");
  });

  test("builds detail html", () => {
    const html = buildHistoryDetailHtml(
      { prompt: "p", answer: "a", createdAt: 1 },
      "now",
      (v: string) => v
    );
    expect(html).toContain("Copy Prompt");
    expect(html).toContain("Copy Answer");
    expect(html).toContain("Delete");
  });
});
