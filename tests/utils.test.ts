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

describe("extractReasoningFromStreamChunk", () => {
  test("separates reasoning tags from content in a single chunk", () => {
    const { extractReasoningFromStreamChunk } = require("../src/shared/utils.js");
    const state = { inReasoning: false, carry: "" };
    const res = extractReasoningFromStreamChunk(state, "Hello <think>reason</think> world");
    expect(res.content).toBe("Hello  world");
    expect(res.reasoning).toBe("reason");
  });

  test("handles reasoning tags split across chunks", () => {
    const { extractReasoningFromStreamChunk } = require("../src/shared/utils.js");
    const state = { inReasoning: false, carry: "" };
    const first = extractReasoningFromStreamChunk(state, "<think>rea");
    const second = extractReasoningFromStreamChunk(state, "son</think>done");
    expect(first.content).toBe("");
    expect(first.reasoning).toBe("rea");
    expect(second.content).toBe("done");
    expect(second.reasoning).toBe("son");
  });

  test("keeps partial tags until completed", () => {
    const { extractReasoningFromStreamChunk } = require("../src/shared/utils.js");
    const state = { inReasoning: false, carry: "" };
    const first = extractReasoningFromStreamChunk(state, "Hello <thi");
    const second = extractReasoningFromStreamChunk(state, "nk>R</think>!");
    expect(first.content).toBe("Hello ");
    expect(first.reasoning).toBe("");
    expect(second.content).toBe("!");
    expect(second.reasoning).toBe("R");
  });
});

describe("removeReasoningBubbles", () => {
  test("removes reasoning nodes from a container", () => {
    const { removeReasoningBubbles } = require("../src/shared/utils.js");
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="reasoning-content">Reasoning A</div>
      <div class="chat-reasoning-bubble">Reasoning B</div>
      <div class="keep">Keep</div>
    `;

    removeReasoningBubbles(container);

    expect(container.querySelector(".reasoning-content")).toBeNull();
    expect(container.querySelector(".chat-reasoning-bubble")).toBeNull();
    expect(container.querySelector(".keep")).not.toBeNull();
  });
});

describe("formatThreadModelLabel", () => {
  test("returns default when no model is set", () => {
    const { formatThreadModelLabel } = require("../src/shared/utils.js");
    expect(formatThreadModelLabel({})).toBe("Model: Default");
  });

  test("prefers display name when provided", () => {
    const { formatThreadModelLabel } = require("../src/shared/utils.js");
    expect(formatThreadModelLabel({ modelDisplayName: "NG-claude-3-opus" })).toBe("Model: NG-claude-3-opus");
  });

  test("falls back to raw model id", () => {
    const { formatThreadModelLabel } = require("../src/shared/utils.js");
    expect(formatThreadModelLabel({ model: "anthropic/claude-3-opus" })).toBe("Model: anthropic/claude-3-opus");
  });
});

describe("model display helpers", () => {
  const {
    getModelBaseName,
    buildModelDisplayName,
    buildCombinedModelId,
    parseCombinedModelId,
    resolveNagaVendorLabel
  } = require("../src/shared/utils.js");

  test("getModelBaseName strips provider segments", () => {
    expect(getModelBaseName("anthropic/claude-3-opus")).toBe("claude-3-opus");
    expect(getModelBaseName("openai/gpt-4o")).toBe("gpt-4o");
    expect(getModelBaseName("mistral:latest")).toBe("latest");
  });

  test("buildModelDisplayName prefixes NG-/OR-", () => {
    expect(buildModelDisplayName("naga", "anthropic/claude-3-opus")).toBe("anthropic/claude-3-opus");
    expect(buildModelDisplayName("openrouter", "openai/gpt-4o")).toBe("openai/gpt-4o");
  });

  test("combined model IDs round-trip", () => {
    const id = buildCombinedModelId("naga", "anthropic/claude-3-opus");
    expect(id).toBe("naga:anthropic/claude-3-opus");
    expect(parseCombinedModelId(id)).toEqual({ provider: "naga", modelId: "anthropic/claude-3-opus" });
  });

  test("resolveNagaVendorLabel prefers startups display name", () => {
    expect(resolveNagaVendorLabel("qwen", { qwen: "Qwen" })).toBe("Qwen");
  });

  test("resolveNagaVendorLabel falls back to title case", () => {
    expect(resolveNagaVendorLabel("deepseek", {})).toBe("Deepseek");
  });

  test("resolveNagaVendorLabel returns Other for empty input", () => {
    expect(resolveNagaVendorLabel("", {})).toBe("Other");
  });
});
