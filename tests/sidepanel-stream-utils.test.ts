export {};
const {
  buildStreamErrorHtml,
  sanitizePrompt,
  getImageExtension,
  getImageViewerBaseUrl
} = require("../src/sidepanel/sidepanel-stream-utils.js");

describe("sidepanel stream helpers", () => {
  test("sanitizePrompt trims and strips control chars", () => {
    expect(sanitizePrompt("  hi\u0000 there \u0008 ")).toBe("hi there");
  });

  test("buildStreamErrorHtml escapes content", () => {
    const html = buildStreamErrorHtml("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  test("getImageExtension and viewer url fallback", () => {
    expect(getImageExtension("image/png")).toBe("png");
    expect(getImageExtension("unknown")).toBe("png");
    expect(getImageViewerBaseUrl()).toContain("image-viewer/image-viewer.html");
  });
});
