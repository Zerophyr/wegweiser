const {
  getTokenBarStyle,
  getStreamingFallbackMessage,
  buildSummarizerMessages,
  getProviderLabel,
  normalizeProviderId,
  getProviderStorageKey,
  parseModelsResponse
} = require("../src/shared/utils.js");
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

describe("buildSummarizerMessages", () => {
  test("includes system summary prompt", () => {
    const messages = buildSummarizerMessages("old", [{ role: "user", content: "hi" }]);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/summarize/i);
  });
});

describe("provider helpers", () => {
  test("normalizeProviderId defaults to openrouter", () => {
    expect(normalizeProviderId(null)).toBe("openrouter");
    expect(normalizeProviderId("unknown")).toBe("openrouter");
  });

  test("getProviderLabel returns readable labels", () => {
    expect(getProviderLabel("openrouter")).toBe("OpenRouter");
    expect(getProviderLabel("naga")).toBe("NagaAI");
  });

  test("getProviderStorageKey returns scoped keys", () => {
    expect(getProviderStorageKey("or_model", "openrouter")).toBe("or_model");
    expect(getProviderStorageKey("or_model", "naga")).toBe("or_model_naga");
  });

  test("parseModelsResponse handles OpenRouter and NagaAI shapes", () => {
    const or = parseModelsResponse({ data: [{ id: "openai/gpt-4o", name: "GPT-4o" }] });
    const naga = parseModelsResponse([{ id: "naga/gpt-4o", name: "GPT-4o" }]);
    expect(or[0].id).toBe("openai/gpt-4o");
    expect(naga[0].id).toBe("naga/gpt-4o");
  });

  test("getProviderApiKeyPlaceholder returns provider-specific prefixes", () => {
    const { getProviderApiKeyPlaceholder } = require("../src/shared/utils.js");
    expect(getProviderApiKeyPlaceholder("openrouter")).toBe("sk-or-...");
    expect(getProviderApiKeyPlaceholder("naga")).toBe("ng-...");
  });
});
