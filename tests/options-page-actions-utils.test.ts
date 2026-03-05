const { normalizeHistoryCsv } = require("../src/options/options-page-actions-utils.js");

describe("options-page-actions-utils", () => {
  test("normalizeHistoryCsv escapes quotes", () => {
    const csv = normalizeHistoryCsv([
      { createdAt: Date.UTC(2026, 0, 1), prompt: 'say "hi"', answer: 'ok' }
    ]);
    expect(csv).toContain('"say ""hi"""');
  });
});
