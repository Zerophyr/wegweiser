export {};
const {
  parseModelsPayload,
  getNagaStartupsCacheKeys
} = require("../src/background/background-models-utils.js");

describe("background models utils", () => {
  test("parses arrays and nested model lists", () => {
    const derive = () => ({ supportsChat: true, supportsImages: false, outputsImage: false, isImageOnly: false });
    const parsed = parseModelsPayload([{ id: "a" }], derive);
    expect(parsed[0].id).toBe("a");
    expect(parsed[0].supportsChat).toBe(true);
    expect(parseModelsPayload({ data: [{ id: "b" }] }, derive)[0].id).toBe("b");
  });

  test("returns empty list for unsupported payload", () => {
    expect(parseModelsPayload(null)).toEqual([]);
    expect(parseModelsPayload({})).toEqual([]);
  });

  test("returns naga startup cache key set", () => {
    const keys = getNagaStartupsCacheKeys({
      NAGA_STARTUPS_CACHE: "a",
      NAGA_STARTUPS_CACHE_TIME: "b"
    });
    expect(keys).toEqual({
      startupsKey: "a",
      timeKey: "b"
    });
  });
});
