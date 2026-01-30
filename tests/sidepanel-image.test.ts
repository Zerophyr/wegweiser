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
});
