export {};

const {
  evaluateImpact,
  defaultConfig
} = require("../scripts/tdd/check-test-impact.js");

function cfg(overrides: any = {}) {
  return {
    ...defaultConfig,
    ...overrides
  };
}

describe("tdd test-impact checker", () => {
  test("fails when source changes without tests", () => {
    const result = evaluateImpact(
      ["src/sidepanel/sidepanel.js"],
      cfg()
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no test changes/i);
  });

  test("passes when related area test changed", () => {
    const result = evaluateImpact(
      [
        "src/sidepanel/sidepanel.js",
        "tests/sidepanel-model-controller.test.ts"
      ],
      cfg()
    );

    expect(result.ok).toBe(true);
  });

  test("fails when only unrelated test changed", () => {
    const result = evaluateImpact(
      [
        "src/sidepanel/sidepanel.js",
        "tests/background-provider-utils.test.ts"
      ],
      cfg()
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no related test/i);
  });

  test("passes when no source changes", () => {
    const result = evaluateImpact(
      ["README.md", "tests/sidepanel-model-controller.test.ts"],
      cfg()
    );

    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/no source changes/i);
  });

  test("passes when source change is ignored by config", () => {
    const result = evaluateImpact(
      ["src/lib/dompurify.min.js"],
      cfg()
    );

    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/ignored/i);
  });

  test("accepts browser/integration tests for cross-page source changes", () => {
    const browserResult = evaluateImpact(
      [
        "src/options/options.js",
        "src/sidepanel/sidepanel.js",
        "tests/browser/options-sidepanel-projects-sync.smoke.spec.ts"
      ],
      cfg()
    );
    expect(browserResult.ok).toBe(true);

    const integrationResult = evaluateImpact(
      [
        "src/options/options.js",
        "src/sidepanel/sidepanel.js",
        "tests/runtime-options-to-ui-refresh.integration.test.ts"
      ],
      cfg()
    );
    expect(integrationResult.ok).toBe(true);
  });
});
