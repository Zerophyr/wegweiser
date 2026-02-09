export {};
const fs = require("fs");
const path = require("path");

describe("projects image toggle", () => {
  test("projects enables image toggle for image-capable models", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/projects/projects.js"),
      "utf8"
    );
    expect(content).not.toMatch(/setChatImageToggleState\(false,\s*true\)/);
  });

  test("projects does not lock image-only models", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/projects/projects.js"),
      "utf8"
    );
    expect(content).not.toMatch(/setChatImageToggleState\(true,\s*true\)/);
  });
});
