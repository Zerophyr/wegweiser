const { clearPromptAfterSend } = require("../src/shared/utils.js");

describe("clearPromptAfterSend", () => {
  test("clears the prompt value", () => {
    const el = { value: "hello", style: { height: "40px" } };
    clearPromptAfterSend(el);
    expect(el.value).toBe("");
    expect(el.style.height).toBe("auto");
  });
});
