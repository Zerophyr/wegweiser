const utils = require("../src/projects/projects-send-controller-utils.js");

describe("projects stream controller surface", () => {
  test("exports stream orchestration functions", () => {
    expect(typeof utils.streamMessage).toBe("function");
    expect(typeof utils.retryStreamFromContext).toBe("function");
    expect(typeof utils.sendMessage).toBe("function");
  });
});
