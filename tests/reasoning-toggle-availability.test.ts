export {};
const fs = require("fs");
const path = require("path");

describe("reasoning toggle availability", () => {
  test("sidepanel does not disable reasoning toggle by model", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel.js"),
      "utf8"
    );
    expect(content).not.toMatch(/applyReasoningToggleAvailability/);
    expect(content).not.toMatch(/reasoningToggle\.setAttribute\(['"]aria-disabled/);
    expect(content).not.toMatch(/reasoningToggle\.classList\.toggle\(['"]disabled/);
  });

  test("projects does not disable reasoning toggles by model", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/projects/projects.js"),
      "utf8"
    );
    expect(content).not.toMatch(/applyChatReasoningAvailability/);
    expect(content).not.toMatch(/applyProjectReasoningAvailability/);
    expect(content).not.toMatch(/applyReasoningToggleState/);
  });
});
