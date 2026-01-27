const { applyMarkdownStyles } = require("../src/modules/markdown");

describe("topic headings", () => {
  test("headings get topic classes", () => {
    const html = applyMarkdownStyles("# Topic One\n\n## Topic Two");
    expect(html).toContain("topic-heading");
  });
});
