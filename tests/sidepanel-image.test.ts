export {};
const fs = require("fs");
const path = require("path");

describe("sidepanel image toggle", () => {
  test("image toggle button exists", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel.html"),
      "utf8"
    );
    expect(html).toMatch(/image-toggle/i);
  });

  test("sidepanel enforces image-only model rules", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel.js"),
      "utf8"
    );
    expect(content).not.toMatch(/setImageToggleUi\(true,\s*true\)/);
    expect(content).not.toMatch(/image mode locked/i);
  });

  test("sidepanel does not force-disable image mode", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel.js"),
      "utf8"
    );
    expect(content).not.toMatch(/setImageToggleUi\(false,\s*true\)/);
    expect(content).not.toMatch(/image mode not available/i);
  });
});

