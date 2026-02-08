export {};
const fs = require("fs");
const path = require("path");

describe("sidepanel toggle storage keys", () => {
  test("uses encrypted storage keys for web search and reasoning", () => {
    const jsPath = path.join(__dirname, "..", "src", "sidepanel", "sidepanel.js");
    const content = fs.readFileSync(jsPath, "utf8");
    expect(content).toMatch(/or_web_search/);
    expect(content).toMatch(/or_reasoning/);
  });
});
