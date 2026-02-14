export {};
const fs = require("fs");
const path = require("path");

describe("safe html sinks", () => {
  test("sidepanel prompt rendering routes through safe helper", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "sidepanel", "sidepanel-prompt-controller-utils.js"), "utf8");
    expect(content).toMatch(/function setSafeHtml\(/);
    expect(content).toMatch(/setSafeHtml\(answerContent/);
  });

  test("sidepanel summarize routes dynamic answer container through safe helper", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "sidepanel", "sidepanel-summarize-controller-utils.js"), "utf8");
    expect(content).toMatch(/function setSafeHtml\(/);
    expect(content).toMatch(/setSafeHtml\(answerItem/);
    expect(content).not.toMatch(/answerEl\.insertAdjacentHTML\("beforeend"/);
  });

  test("projects stream runtime uses safe helper for error and markdown sinks", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "projects", "projects-stream-runtime-utils.js"), "utf8");
    expect(content).toMatch(/function setSafeHtml\(/);
    expect(content).toMatch(/setSafeHtml\(ui\.content/);
    expect(content).toMatch(/setSafeHtml\(assistantBubble/);
  });

  test("options history rendering uses safe html helper and replaceChildren clears", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "options", "options.js"), "utf8");
    expect(content).toMatch(/setHtmlSafely\(/);
    expect(content).toMatch(/promptHistoryEl\.replaceChildren\(\)/);
  });
});
