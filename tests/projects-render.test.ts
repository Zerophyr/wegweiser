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
    const runtimeUtils = fs.readFileSync(
      path.join(__dirname, "..", "src", "projects", "projects-stream-runtime-utils.js"),
      "utf8"
    );
    const chunkUtils = fs.readFileSync(
      path.join(__dirname, "..", "src", "projects", "projects-stream-chunk-utils.js"),
      "utf8"
    );
    expect(chunkUtils).toMatch(/renderAssistantContent\?\.\(state\.assistantBubble,\s*state\.fullContent\)/);
    expect(runtimeUtils).toMatch(/setSafeHtml\(assistantBubble,\s*rendered,\s*deps\.setSanitizedHtml\)/);
    expect(runtimeUtils).toMatch(/setSafeHtml\(ui\.content,\s*errorHtml,\s*deps\.setSanitizedHtml\)/);
  });
});
