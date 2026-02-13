export {};
const fs = require("fs");
const path = require("path");

describe("projects UI", () => {
  test("projects page title uses Projects", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "..", "src", "projects", "projects.html"),
      "utf8"
    );
    expect(html).toMatch(/Projects/);
    expect(html).not.toMatch(/Spaces/);
  });

  test("stream rendering uses safe-html helper for dynamic assistant content", () => {
    const js = fs.readFileSync(
      path.join(__dirname, "..", "src", "projects", "projects.js"),
      "utf8"
    );
    expect(js).toMatch(/safeHtml\.setSanitizedHtml\(assistantBubble,\s*rendered\)/);
    expect(js).toMatch(/safeHtml\.setSanitizedHtml\(ui\.content,\s*errorHtml\)/);
  });
});
