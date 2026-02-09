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
    expect(content).toMatch(/isImageOnly/);
    expect(content).toMatch(/aria-disabled/);
  });
});

