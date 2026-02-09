export {};
const { modelSupportsReasoning } = require("../src/shared/utils.js");

describe("modelSupportsReasoning", () => {
  test("returns false for explicit false flags", () => {
    expect(modelSupportsReasoning({ supportsReasoning: false })).toBe(false);
    expect(modelSupportsReasoning({ supports_reasoning: false })).toBe(false);
    expect(modelSupportsReasoning({ capabilities: { reasoning: false } })).toBe(false);
    expect(modelSupportsReasoning({ architecture: { supports_reasoning: false } })).toBe(false);
  });

  test("returns true for explicit true flags", () => {
    expect(modelSupportsReasoning({ supportsReasoning: true })).toBe(true);
    expect(modelSupportsReasoning({ supports_reasoning: true })).toBe(true);
    expect(modelSupportsReasoning({ capabilities: { reasoning: true } })).toBe(true);
    expect(modelSupportsReasoning({ architecture: { supports_reasoning: true } })).toBe(true);
  });

  test("defaults to true when metadata is missing", () => {
    expect(modelSupportsReasoning({})).toBe(true);
    expect(modelSupportsReasoning(null)).toBe(true);
    expect(modelSupportsReasoning(undefined)).toBe(true);
  });

  test("uses supported_parameters when provided", () => {
    expect(modelSupportsReasoning({ supported_parameters: ["reasoning_effort"] })).toBe(true);
    expect(modelSupportsReasoning({ supported_parameters: ["reasoning"] })).toBe(true);
    expect(modelSupportsReasoning({ supported_parameters: ["temperature"] })).toBe(false);
  });

  test("does not disable reasoning for naga when supported_parameters lacks reasoning", () => {
    expect(modelSupportsReasoning({
      provider: "naga",
      supported_parameters: ["temperature"]
    })).toBe(true);
  });
});
