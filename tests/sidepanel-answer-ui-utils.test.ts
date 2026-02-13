export {};
const {
  hasAnswerContent,
  buildSourcesCountLabel
} = require("../src/sidepanel/sidepanel-answer-ui-utils.js");

describe("sidepanel answer ui utils", () => {
  test("detects answer content", () => {
    expect(hasAnswerContent("")).toBe(false);
    expect(hasAnswerContent("  ")).toBe(false);
    expect(hasAnswerContent("<div>x</div>")).toBe(true);
  });

  test("builds source count label", () => {
    expect(buildSourcesCountLabel(1)).toBe("1 source");
    expect(buildSourcesCountLabel(2)).toBe("2 sources");
  });
});
