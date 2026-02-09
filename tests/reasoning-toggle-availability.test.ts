export {};
const fs = require("fs");
const path = require("path");

describe("reasoning toggle availability", () => {
  test("sidepanel applies reasoning availability for selected model", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel.js"),
      "utf8"
    );
    expect(content).toMatch(/modelSupportsReasoning/);
    expect(content).toMatch(/reasoning-toggle/);
  });

  test("projects applies reasoning availability for chat and project toggles", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/projects/projects.js"),
      "utf8"
    );
    expect(content).toMatch(/modelSupportsReasoning/);
    expect(content).toMatch(/ProjectReasoning/);
    expect(content).toMatch(/chatReasoning/);
  });
});
