export {};
const fs = require("fs");
const path = require("path");

describe("image message type", () => {
  test("IMAGE_QUERY constant exists", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/shared/constants.js"),
      "utf8"
    );
    expect(content).toMatch(/IMAGE_QUERY/);
  });
});

describe("background image routing", () => {
  test("background handles image query and endpoints", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/IMAGE_QUERY/);
    expect(content).toMatch(/modalities/);
    expect(content).toMatch(/images\/generations/);
  });
});

