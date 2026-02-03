const fs = require("fs");
const path = require("path");

describe("release script scaffold", () => {
  test("release script exists", () => {
    const file = path.join(__dirname, "../scripts/release.js");
    expect(fs.existsSync(file)).toBe(true);
  });

  test("release script mentions dist output", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../scripts/release.js"),
      "utf8"
    );
    expect(content).toMatch(/dist/);
  });
});
