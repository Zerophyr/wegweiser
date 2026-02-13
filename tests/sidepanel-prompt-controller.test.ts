const { askQuestion } = require("../src/sidepanel/sidepanel-prompt-controller-utils.js");

describe("sidepanel-prompt-controller-utils", () => {
  test("askQuestion short-circuits on empty prompt", async () => {
    const deps = {
      state: {},
      promptEl: { value: "   " },
      sanitizePrompt: () => "",
      metaEl: { textContent: "" }
    };

    await askQuestion(deps);
    expect(deps.metaEl.textContent).toBe("Enter a prompt first.");
  });
});
