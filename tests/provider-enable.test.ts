export {};
const fs = require("fs");
const path = require("path");

describe("provider enable settings", () => {
  test("storage keys exist in constants", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/shared/constants.js"),
      "utf8"
    );
    expect(content).toMatch(/PROVIDER_ENABLED_OPENROUTER/);
    expect(content).not.toMatch(/PROVIDER_ENABLED_NAGA/);
  });

  test("options UI renders only openrouter provider card", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/options/options.html"),
      "utf8"
    );
    expect(content).toMatch(/provider-card-openrouter/);
    expect(content).not.toMatch(/provider-card-naga/);
    expect(content).not.toMatch(/enable-openrouter/);
  });

  test("options JS does not depend on provider enable toggles", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/options/options.js"),
      "utf8"
    );
    expect(content).not.toMatch(/or_provider_enabled_naga/);
  });

  test("background contains no naga provider flags", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/PROVIDER_ENABLED_OPENROUTER/);
    expect(content).not.toMatch(/PROVIDER_ENABLED_NAGA/);
  });
});

