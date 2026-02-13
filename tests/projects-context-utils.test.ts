export {};
const {
  getLiveWindowSize,
  splitMessagesForSummary,
  shouldSkipSummarization,
  getSummaryMinLength,
  appendArchivedMessages,
  buildProjectsContextData,
  buildContextBadgeLabel,
  getContextUsageCount
} = require("../src/projects/projects-context.js");

describe("projects-context helpers", () => {
  test("getLiveWindowSize adapts to summary presence", () => {
    expect(getLiveWindowSize("")).toBe(12);
    expect(getLiveWindowSize("summary")).toBe(8);
  });

  test("splitMessagesForSummary returns history + live windows", () => {
    const messages = Array.from({ length: 14 }).map((_, i) => ({ role: "user", content: `m${i}` }));
    const out = splitMessagesForSummary(messages, 12);
    expect(out.historyToSummarize).toHaveLength(2);
    expect(out.liveMessages).toHaveLength(12);
  });

  test("buildContextBadgeLabel and usage count remain stable", () => {
    expect(buildContextBadgeLabel(4)).toBe("2 Q&A");
    expect(buildContextBadgeLabel(1)).toBe("");

    const thread = {
      summary: "s",
      messages: [{ role: "user", content: "a" }],
      archivedMessages: [{ role: "assistant", content: "b" }]
    };
    const Project = { customInstructions: "be concise" };
    expect(getContextUsageCount(thread, Project)).toBe(3);
  });

  test("summarization utility guardrails", () => {
    expect(shouldSkipSummarization("a".repeat(10000))).toBe(true);
    expect(getSummaryMinLength(4)).toBe(80);
    expect(getSummaryMinLength(12)).toBe(200);
    expect(appendArchivedMessages([{ content: "a" }], [{ content: "b" }])).toHaveLength(2);
  });

  test("buildProjectsContextData normalizes arrays", () => {
    const out = buildProjectsContextData({ summary: "x", messages: null, archivedMessages: undefined });
    expect(out.summary).toBe("x");
    expect(out.liveMessages).toEqual([]);
    expect(out.archivedMessages).toEqual([]);
  });
});
