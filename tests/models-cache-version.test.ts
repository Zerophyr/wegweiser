export {};
const fs = require("fs");
const path = require("path");

describe("models cache versioning", () => {
  test("constants include cache version keys", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/shared/constants.js"),
      "utf8"
    );
    expect(content).toMatch(/MODELS_CACHE_VERSION/);
    expect(content).toMatch(/MODELS_CACHE_VERSION_NAGA/);
    expect(content).toMatch(/MODELS_CACHE_SCHEMA_VERSION/);
    expect(content).toMatch(/MODELS_CACHE_SCHEMA_VERSION\s*=\s*3/);
  });

  test("background checks cache version", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/MODELS_CACHE_SCHEMA_VERSION/);
    expect(content).toMatch(/versionKey/);
  });
});
