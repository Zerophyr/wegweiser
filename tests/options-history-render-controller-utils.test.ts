const { buildHistoryPreviewHtml } = require("../src/options/options-history-render-controller-utils.js");

describe("options-history-render-controller-utils", () => {
  test("buildHistoryPreviewHtml includes prompt and response labels", () => {
    const html = buildHistoryPreviewHtml({ promptText: "P", answerText: "A" }, "now", (v: string) => v, (v: string) => v);
    expect(html).toContain("Prompt:");
    expect(html).toContain("Response:");
  });
});

