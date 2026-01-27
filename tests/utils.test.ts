const { getTokenBarStyle, getStreamingFallbackMessage } = require("../src/shared/utils.js");
const { extractSources } = require("../src/modules/sources");
const { exportMarkdown } = require("../src/modules/exporter");

describe("getTokenBarStyle", () => {
  test("returns 0% and green for null tokens", () => {
    const res = getTokenBarStyle(null, 4000);
    expect(res.percent).toBe(0);
    expect(res.gradient).toContain("#22c55e");
  });

  test("returns yellow for mid usage", () => {
    const res = getTokenBarStyle(2400, 4000);
    expect(res.percent).toBe(60);
    expect(res.gradient).toContain("#eab308");
  });

  test("returns red for high usage", () => {
    const res = getTokenBarStyle(3600, 4000);
    expect(res.percent).toBe(90);
    expect(res.gradient).toContain("#ef4444");
  });
});

describe("extractSources domain metadata", () => {
  test("extractSources returns domain names", () => {
    const { sources } = extractSources("https://example.com [1]");
    expect(sources[0].domain).toBe("example.com");
  });
});

describe("exportMarkdown", () => {
  test("exportMarkdown formats thread", () => {
    const md = exportMarkdown([{ role: 'user', content: 'Hi' }]);
    expect(md).toContain("## User");
  });
});

describe("getStreamingFallbackMessage", () => {
  test("returns message when stream ends with no answer", () => {
    const message = getStreamingFallbackMessage("", false);
    expect(message).toMatch(/no answer/i);
  });

  test("returns reasoning-specific message when only reasoning was received", () => {
    const message = getStreamingFallbackMessage("", true);
    expect(message).toMatch(/reasoning/i);
  });

  test("returns null when answer exists", () => {
    const message = getStreamingFallbackMessage("Hello", false);
    expect(message).toBeNull();
  });
});
