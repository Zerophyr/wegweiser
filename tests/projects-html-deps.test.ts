export {};

const fs = require("fs");
const path = require("path");

describe("projects html dependencies", () => {
  test("loads chat-store backends before chat-store", () => {
    const htmlPath = path.join(__dirname, "..", "src", "projects", "projects.html");
    const html = fs.readFileSync(htmlPath, "utf8");

    const backendsPos = html.indexOf("../shared/chat-store-backends.js");
    const chatStorePos = html.indexOf("../shared/chat-store.js");

    expect(backendsPos).toBeGreaterThanOrEqual(0);
    expect(chatStorePos).toBeGreaterThanOrEqual(0);
    expect(backendsPos).toBeLessThan(chatStorePos);
  });
});
