const { buildCombinedRecentList } = require("../src/options/options-model-dropdown-controller-utils.js");

describe("options-model-dropdown-controller-utils", () => {
  test("buildCombinedRecentList deduplicates provider recents", () => {
    const result = buildCombinedRecentList({ openrouter: ["a", "a", "b"] }, (provider: string, id: string) => `${provider}:${id}`);
    expect(result).toEqual(["openrouter:a", "openrouter:b"]);
  });
});

