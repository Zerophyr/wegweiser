export {};
const {
  buildProjectCardHtml
} = require("../src/projects/projects-cards-utils.js");

describe("projects cards utils", () => {
  test("builds project card html with escaped values", () => {
    const html = buildProjectCardHtml(
      { id: "p1", name: "<Demo>", icon: "📁", updatedAt: 1 },
      "model-x",
      "1. Jan. 2026",
      (v: string) => v.replace("<", "&lt;").replace(">", "&gt;")
    );
    expect(html).toContain('data-project-id="p1"');
    expect(html).toContain("&lt;Demo&gt;");
    expect(html).toContain("model-x");
  });
});
