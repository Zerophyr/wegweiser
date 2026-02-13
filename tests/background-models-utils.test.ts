export {};
const {
  parseModelsPayload
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

});
