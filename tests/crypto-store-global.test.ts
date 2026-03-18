export {};
const fs = require("fs");
const path = require("path");

describe("crypto-store globals", () => {
  test("exposes a namespaced crypto API instead of raw helpers on globalThis", () => {
    const file = path.join(__dirname, "..", "src", "shared", "crypto-store.js");
    const content = fs.readFileSync(file, "utf8");
    expect(content).not.toMatch(/globalThis\.getOrCreateKey/);
    expect(content).not.toMatch(/globalThis\.encryptJson/);
    expect(content).not.toMatch(/globalThis\.decryptJson/);
    expect(content).toMatch(/CRYPTO_API_GLOBAL_KEY/);
    expect(content).toMatch(/globalThis\[CRYPTO_API_GLOBAL_KEY\]/);
  });
});
