export {};
const fs = require("fs");
const path = require("path");

describe("projects button behavior", () => {
  test("opens or focuses Projects before closing the sidepanel", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel.js"),
      "utf8"
    );

    const start = content.indexOf("const openProjectsPage");
    expect(start).toBeGreaterThan(-1);
    const snippet = content.slice(start, start + 2500);

    const createIndex = snippet.indexOf("chrome.tabs.create");
    const updateIndex = snippet.indexOf("chrome.tabs.update");
    const closeIndex = snippet.indexOf("close_sidepanel");

    const openIndex = Math.max(createIndex, updateIndex);
    expect(openIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(openIndex);
  });
});

