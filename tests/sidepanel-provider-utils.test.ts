export {};
const {
  normalizeProviderSafe,
  getProviderStorageKeySafe,
  buildCombinedModelIdSafe,
  parseCombinedModelIdSafe,
  buildCombinedFavoritesList,
  buildCombinedRecentList
} = require("../src/sidepanel/sidepanel-provider.js");

describe("sidepanel provider helpers", () => {
  test("build and parse combined model ids", () => {
    const id = buildCombinedModelIdSafe("naga", "grok-4");
    expect(id).toBe("openrouter:grok-4");
    expect(parseCombinedModelIdSafe(id)).toEqual({ provider: "openrouter", modelId: "grok-4" });
  });

  test("normalizes provider keys", () => {
    expect(normalizeProviderSafe("naga")).toBe("openrouter");
    expect(normalizeProviderSafe("anything-else")).toBe("openrouter");
    expect(getProviderStorageKeySafe("or_recent_models", "naga")).toBe("or_recent_models");
    expect(getProviderStorageKeySafe("or_recent_models", "openrouter")).toBe("or_recent_models");
  });

  test("combines favorites and recents by provider", () => {
    const favorites = {
      openrouter: new Set(["openai/gpt-5"]),
      naga: new Set(["grok-4.1-fast-reasoning"])
    };
    const recents = {
      openrouter: ["google/gemini-2.5-flash"],
      naga: ["grok-4.1-fast-reasoning", "dall-e-3"]
    };

    expect(buildCombinedFavoritesList(favorites)).toEqual([
      "openrouter:openai/gpt-5"
    ]);

    expect(buildCombinedRecentList(recents)).toEqual([
      "openrouter:google/gemini-2.5-flash"
    ]);
  });
});
