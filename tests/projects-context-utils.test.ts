export {};
const {
  getLiveWindowSize,
  splitMessagesForSummary,
  shouldSkipSummarization,
  getSummaryMinLength,
  appendArchivedMessages,
  buildProjectsContextData,
  buildContextBadgeLabel,
  getContextUsageCount,
  buildContextMessageHtml,
  getProjectsContextButtonState,
  getProjectsContextModalState,
  buildProjectsContextModalHtml
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

  test("buildContextMessageHtml renders escaped + truncated messages", () => {
    const html = buildContextMessageHtml(
      [{ role: "assistant", content: "<tag>" }],
      (v: string) => v.slice(0, 2),
      (v: string) => v.replace("<", "&lt;")
    );
    expect(html).toContain("assistant");
    expect(html).toContain("&lt;");
  });

  test("getProjectsContextButtonState computes badge/title usage", () => {
    const thread = { summary: "s", messages: [{ role: "user", content: "a" }], archivedMessages: [] };
    const state = getProjectsContextButtonState(thread, { customInstructions: "x" }, 16);
    expect(state.usedCount).toBe(3);
    expect(state.remaining).toBe(13);
    expect(state.isActive).toBe(false);
  });

  test("getProjectsContextModalState computes fill + warning threshold", () => {
    const thread = {
      summary: "s",
      messages: Array.from({ length: 14 }).map(() => ({ role: "user", content: "x" })),
      archivedMessages: []
    };
    const state = getProjectsContextModalState(thread, { customInstructions: "x" }, 16);
    expect(state.usedCount).toBe(16);
    expect(state.remaining).toBe(0);
    expect(state.fillPercentage).toBe(100);
    expect(state.isNearLimit).toBe(true);
  });

  test("buildProjectsContextModalHtml renders summary and limit warning", () => {
    const thread = {
      summary: "Summary block",
      messages: Array.from({ length: 14 }).map((_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` })),
      archivedMessages: [{ role: "assistant", content: "old" }]
    };
    const html = buildProjectsContextModalHtml({
      thread,
      project: { customInstructions: "Use concise bullets." },
      maxContextMessages: 16,
      truncateText: (v: string) => v,
      escapeHtml: (v: string) => v
    });
    expect(html).toContain("Summary");
    expect(html).toContain("Archived messages (1)");
    expect(html).toContain("Context is nearing capacity");
  });
});
