const fs = require("fs");
const path = require("path");
export {};

describe("background-message-router-utils", () => {
  test("contains exported router registration function", () => {
    const filePath = path.join(__dirname, "../src/background/background-message-router-utils.js");
    const source = fs.readFileSync(filePath, "utf8");
    expect(source).toContain("export function registerBackgroundMessageRouter");
    expect(source).toContain("runtime.onMessage.addListener");
  });
});
