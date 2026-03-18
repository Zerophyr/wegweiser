export {};
const fs = require("fs");
const path = require("path");

describe("encrypted storage globals", () => {
  test("exports only encrypted storage helpers on globalThis", () => {
    const file = path.join(__dirname, "..", "src", "shared", "encrypted-storage.js");
    const content = fs.readFileSync(file, "utf8");
    expect(content).toMatch(/globalThis\.getEncrypted/);
    expect(content).toMatch(/globalThis\.setEncrypted/);
    expect(content).not.toMatch(/globalThis\.migratePlaintextKey/);
  });

  test("reads crypto helpers from the internal namespace instead of raw globals", () => {
    const file = path.join(__dirname, "..", "src", "shared", "encrypted-storage.js");
    const content = fs.readFileSync(file, "utf8");
    expect(content).toMatch(/globalThis\.__wegweiserCrypto/);
    expect(content).not.toMatch(/globalThis\.encryptJson/);
    expect(content).not.toMatch(/globalThis\.decryptJson/);
  });
});
