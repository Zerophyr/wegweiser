const {
  getModelLabel,
  getProviderBadge,
  getModelBaseNameForSort
} = require("../src/modules/models-dropdown-render-utils.js");

describe("models-dropdown-render-utils", () => {
  const manager = {
    config: { containerType: "sidebar" }
  };

  test("getModelLabel prefers displayName then name then id", () => {
    expect(getModelLabel(manager, { displayName: "A", name: "B", id: "C" })).toBe("A");
    expect(getModelLabel(manager, { name: "B", id: "C" })).toBe("B");
    expect(getModelLabel(manager, { id: "C" })).toBe("C");
  });

  test("getModelBaseNameForSort strips provider prefixes", () => {
    expect(getModelBaseNameForSort(manager, { displayName: "openai/gpt-4o" })).toBe("gpt-4o");
  });

  test("getProviderBadge returns short provider labels", () => {
    expect(getProviderBadge(manager, { id: "openrouter:test" })).toEqual({ label: "OR", background: "var(--color-success, #10b981)", color: "#fff" });
  });
});
