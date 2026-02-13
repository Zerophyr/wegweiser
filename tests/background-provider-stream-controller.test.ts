const fs = require("fs");
const path = require("path");
export {};

describe("background-provider-stream-controller-utils", () => {
  test("contains exported streaming listener registration function", () => {
    const filePath = path.join(__dirname, "../src/background/background-provider-stream-controller-utils.js");
    const source = fs.readFileSync(filePath, "utf8");
    expect(source).toContain("export function registerStreamingPortListener");
    expect(source).toContain("runtime.onConnect.addListener");
  });
});
