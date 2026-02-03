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

  test("release script checks for clean git status", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../scripts/release.js"),
      "utf8"
    );
    expect(content).toMatch(/git status --porcelain/);
  });

  test("release script handles PEM cleanup and zip fallback", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../scripts/release.js"),
      "utf8"
    );
    expect(content).toMatch(/\.pem/);
    expect(content).toMatch(/Compress-Archive/);
  });
});
