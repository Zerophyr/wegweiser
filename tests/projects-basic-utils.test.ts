export {};
const {
  generateId,
  formatRelativeTime,
  formatDate,
  truncateText,
  generateThreadTitle,
  formatBytes,
  buildStorageLabel,
  escapeHtml,
  getImageExtension,
  sanitizeFilename
} = require("../src/projects/projects-basic-utils.js");

describe("projects basic utils", () => {
  test("generates ids with prefix", () => {
    const id = generateId("thr");
    expect(id.startsWith("thr_")).toBe(true);
  });

  test("formats relative and absolute dates", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 10 * 1000)).toBe("Just now");
    expect(typeof formatDate(now)).toBe("string");
  });

  test("truncates and creates thread titles", () => {
    expect(truncateText("abcdef", 4)).toBe("abcd...");
    expect(generateThreadTitle("Hello world. Another sentence")).toBe("Hello world");
  });

  test("formats bytes and labels", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0MB");
    expect(buildStorageLabel("Used", 1024 * 1024, 2 * 1024 * 1024)).toBe("Used: 1.0MB of 2.0MB");
  });

  test("escapes html and normalizes file names", () => {
    expect(escapeHtml("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
    expect(sanitizeFilename("bad:/name*")).toBe("badname");
  });

  test("maps mime types to image extensions", () => {
    expect(getImageExtension("image/jpeg")).toBe("jpg");
    expect(getImageExtension("image/webp")).toBe("webp");
    expect(getImageExtension("anything")).toBe("png");
  });
});
