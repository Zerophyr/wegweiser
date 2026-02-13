export {};
const {
  getFullThreadMessages,
  buildExportPdfHtml,
  buildThreadExportHtml
} = require("../src/projects/projects-export-utils.js");

describe("projects export utils", () => {
  test("combines archived and live thread messages", () => {
    const thread = {
      archivedMessages: [{ role: "user", content: "a" }],
      messages: [{ role: "assistant", content: "b" }]
    };
    expect(getFullThreadMessages(thread)).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" }
    ]);
  });

  test("builds escaped html for pdf export", () => {
    const html = buildExportPdfHtml(
      [{ role: "assistant", content: "<x>" }],
      (v: string) => v.replace("<", "&lt;").replace(">", "&gt;")
    );
    expect(html).toContain("<h2>Assistant</h2>");
    expect(html).toContain("&lt;x&gt;");
  });

  test("buildThreadExportHtml prefers markdown renderer when provided", () => {
    const html = buildThreadExportHtml(
      [{ role: "user", content: "**bold**" }],
      {
        applyMarkdownStyles: (v: string) => `<strong>${v}</strong>`,
        escapeHtml: (v: string) => `ESC(${v})`
      }
    );
    expect(html).toContain("<h2>User</h2>");
    expect(html).toContain("<strong>**bold**</strong>");
    expect(html).not.toContain("ESC(");
  });
});
