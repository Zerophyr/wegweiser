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
    expect(content).toMatch(/PROVIDER_ENABLED_NAGA/);
  });

  test("options UI renders provider cards with enable controls", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/options/options.html"),
      "utf8"
    );
    expect(content).toMatch(/provider-card-openrouter/);
    expect(content).toMatch(/provider-card-naga/);
    expect(content).toMatch(/Enable/);
  });

  test("options JS stores provider enable flags", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/options/options.js"),
      "utf8"
    );
    expect(content).toMatch(/or_provider_enabled_openrouter/);
    expect(content).toMatch(/or_provider_enabled_naga/);
  });

  test("background respects provider enable flags", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/background/background.js"),
      "utf8"
    );
    expect(content).toMatch(/PROVIDER_ENABLED_OPENROUTER/);
    expect(content).toMatch(/PROVIDER_ENABLED_NAGA/);
  });
});

