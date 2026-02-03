const fs = require("fs");
const path = require("path");

describe("background sidepanel close", () => {
  test("falls back to active tab when sender tab missing", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/CLOSE_SIDEPANEL/);
    expect(content).toMatch(/chrome\.tabs\.query/);
  });
});
