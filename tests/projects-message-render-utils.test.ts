export {};

const {
  buildProjectsMessageHtml
} = require("../src/projects/projects-message-render-utils.js");

describe("projects message render utils", () => {
  test("renders escaped user messages", () => {
    const html = buildProjectsMessageHtml(
      [{ role: "user", content: "<script>" }],
      {
        escapeHtml: (v: string) => v.replace("<", "&lt;").replace(">", "&gt;"),
        applyMarkdownStyles: (v: string) => v
      }
    );
    expect(html).toContain("&lt;script&gt;");
  });

  test("renders assistant image messages with data-image-id", () => {
    const html = buildProjectsMessageHtml(
      [{ role: "assistant", content: "", meta: { imageId: "img-1", model: "m" } }],
      {
        escapeHtml: (v: string) => v,
        applyMarkdownStyles: (v: string) => v
      }
    );
    expect(html).toContain("image-message");
    expect(html).toContain('data-image-id="img-1"');
  });
});
