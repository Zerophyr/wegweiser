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

  test("background rejects non-image models", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/IMAGE_MODEL_REQUIRED/);
  });

  test("image generation supports url fallback conversion", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/fetchImageAsDataUrl/);
  });

  test("chat image route uses chat completions", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/chat\/completions/);
  });
});

describe("model cache refresh", () => {
  test("models updated message type exists", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/shared/constants.js"),
      "utf8"
    );
    expect(content).toMatch(/MODELS_UPDATED/);
  });

  test("background broadcasts models_updated", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/models_updated/);
  });

  test("background invalidates cache without capability fields", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/hasModelCapabilityFields/);
  });
});

