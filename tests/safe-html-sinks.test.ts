export {};
const fs = require("fs");
const path = require("path");

describe("safe html sinks", () => {
  test("sidepanel prompt rendering routes through safe helper", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "sidepanel", "sidepanel-prompt-controller-utils.js"), "utf8");
    expect(content).toMatch(/function setSafeHtml\(/);
    expect(content).toMatch(/setSafeHtml\(answerContent/);
  });

  test("projects stream runtime supports sanitized html injection", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "projects", "projects-stream-runtime-utils.js"), "utf8");
    expect(content).toMatch(/setSanitizedHtml/);
  });

  test("options history rendering uses safe html helper", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "options", "options.js"), "utf8");
    expect(content).toMatch(/setHtmlSafely\(/);
  });
});
