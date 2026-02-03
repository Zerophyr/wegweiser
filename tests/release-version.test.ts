export {};
const { bumpVersion } = require("../scripts/release-utils.js");

describe("bumpVersion", () => {
  test("patch bump increments patch", () => {
    expect(bumpVersion("1.1.1", "patch")).toBe("1.1.2");
  });

  test("minor bump increments minor and resets patch", () => {
    expect(bumpVersion("1.1.1", "minor")).toBe("1.2.0");
  });

  test("major bump increments major and resets minor/patch", () => {
    expect(bumpVersion("1.1.1", "major")).toBe("2.0.0");
  });
});

