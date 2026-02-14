export {};
const fs = require("fs");
const path = require("path");

describe("projects button behavior", () => {
  test("opens or focuses Projects before closing the sidepanel", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel-events-controller-utils.js"),
      "utf8"
    );

    const start = content.indexOf("const openProjectsPage");
    expect(start).toBeGreaterThan(-1);
    const snippet = content.slice(start, start + 2500);

    const openIndex = Math.max(snippet.indexOf("focusExistingTab"), snippet.indexOf("openNewTab"));
    const closeIndex = snippet.indexOf("closeSidepanel");

    expect(openIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(openIndex);
  });
});

