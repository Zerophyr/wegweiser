export {};
const {
  extractOpenRouterImageUrl,
  buildDataUrlFromBase64,
  arrayBufferToBase64
} = require("../src/background/background-image-utils.js");

describe("background image utils", () => {
  test("extracts image url from message content parts", () => {
    const url = extractOpenRouterImageUrl({
      content: [
        { type: "text", text: "hello" },
        { type: "image_url", image_url: { url: "https://example.com/x.png" } }
      ]
    });
    expect(url).toBe("https://example.com/x.png");
  });

  test("builds data urls", () => {
    expect(buildDataUrlFromBase64("abc", "image/png")).toBe("data:image/png;base64,abc");
  });


  test("encodes array buffer to base64", () => {
    const bytes = new Uint8Array([72, 105]).buffer;
    expect(arrayBufferToBase64(bytes)).toBe("SGk=");
  });
});
