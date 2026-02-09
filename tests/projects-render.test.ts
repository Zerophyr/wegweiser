export {};
const fs = require("fs");
const path = require("path");

describe("projects UI", () => {
  test("projects page title uses Projects", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "..", "src", "projects", "projects.html"),
      "utf8"
    );
    expect(html).toMatch(/Projects/);
    expect(html).not.toMatch(/Spaces/);
  });
});
