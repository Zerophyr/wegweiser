export {};
const fs = require("fs");
const path = require("path");

describe("sidepanel layout stacking", () => {
  test("bottom section is stacked above main content", () => {
    const cssPath = path.join(__dirname, "..", "src", "sidepanel", "sidepanel.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toMatch(/#main-content[\s\S]*?z-index:\s*1/);
    expect(css).toMatch(/#bottom-section[\s\S]*?z-index:\s*2/);
  });
});
