const { estimateTokens } = require("../src/sidepanel/sidepanel-ui-helpers-utils.js");

describe("sidepanel-ui-helpers-utils", () => {
  test("estimateTokens uses chars per token", () => {
    expect(estimateTokens("abcd", 4)).toBe(1);
    expect(estimateTokens("abcde", 4)).toBe(2);
  });
});
