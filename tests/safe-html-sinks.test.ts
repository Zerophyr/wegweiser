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

  test("toast routes rendering through helper instead of direct toast innerHTML", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "modules", "toast.js"), "utf8");
    expect(content).toMatch(/function setToastHtml\(/);
    expect(content).toMatch(/setToastHtml\(toast, toastHtml\)/);
    expect(content).not.toMatch(/toast\.innerHTML\s*=/);
  });

  test("image cards avoid innerHTML for state and disclaimer rendering", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "modules", "image-cards.js"), "utf8");
    expect(content).not.toMatch(/body\.innerHTML\s*=/);
    expect(content).not.toMatch(/disclaimer\.innerHTML\s*=/);
  });

  test("source cards avoid direct card.innerHTML template writes", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "modules", "source-cards.js"), "utf8");
    expect(content).not.toMatch(/card\.innerHTML\s*=/);
    expect(content).toMatch(/title\.textContent\s*=/);
    expect(content).toMatch(/domain\.textContent\s*=/);
  });

  test("markdown avoids direct wrapper and element innerHTML assignment for rendering", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "modules", "markdown.js"), "utf8");
    expect(content).not.toMatch(/wrapper\.innerHTML\s*=\s*html/);
    expect(content).not.toMatch(/element\.innerHTML\s*=\s*html/);
  });

  test("projects render controller keeps render sinks localized", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "projects", "projects-render-controller-utils.js"), "utf8");
    expect(content).toMatch(/ProjectsGrid\.innerHTML/);
    expect(content).toMatch(/threadList\.innerHTML/);
    expect(content).toMatch(/chatMessagesEl\.innerHTML/);
  });

  test("projects archive and image helpers use clear-only DOM APIs where possible", () => {
    const archive = fs.readFileSync(path.join(__dirname, "..", "src", "projects", "projects-archive-view-utils.js"), "utf8");
    const image = fs.readFileSync(path.join(__dirname, "..", "src", "projects", "projects-image-utils.js"), "utf8");
    const sidepanel = fs.readFileSync(path.join(__dirname, "..", "src", "sidepanel", "sidepanel-answer-persistence-controller-utils.js"), "utf8");
    expect(archive).toMatch(/contentEl\.replaceChildren\(\)/);
    expect(image).toMatch(/contentEl\.replaceChildren\(\)/);
    expect(sidepanel).toMatch(/answerEl\.replaceChildren\(\)/);
  });

});
