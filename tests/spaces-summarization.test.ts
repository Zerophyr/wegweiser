export {};
let spacesLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  __SPACES_LOADED__?: boolean;
  getLiveWindowSize?: (summary: string | null) => number;
  splitMessagesForSummary?: (messages: any[], liveWindowSize: number) => {
    historyToSummarize: any[];
    liveMessages: any[];
  };
  buildStreamMessages?: (
    messages: any[],
    prompt: string,
    systemInstruction?: string,
    summary?: string
  ) => any[];
  shouldSkipSummarization?: (prompt: string) => boolean;
  getSummaryMinLength?: (historyCount: number) => number;
};

function loadSpaces() {
  if (spacesLoaded) return;
  win.__TEST__ = true;
  require("../src/projects/projects.js");
  spacesLoaded = true;
}

describe("spaces summarization helpers", () => {
  beforeEach(() => {
    loadSpaces();
  });

  test("getLiveWindowSize returns 12 when no summary", () => {
    expect(win.getLiveWindowSize?.(null)).toBe(12);
  });

  test("getLiveWindowSize returns 8 when summary exists", () => {
    expect(win.getLiveWindowSize?.("summary")).toBe(8);
  });

  test("splitMessagesForSummary separates history and live window", () => {
    const messages = Array.from({ length: 14 }).map((_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`
    }));
    const result = win.splitMessagesForSummary?.(messages, 12);
    expect(result?.historyToSummarize).toHaveLength(2);
    expect(result?.liveMessages).toHaveLength(12);
  });

  test("buildStreamMessages includes summary as system message", () => {
    const result = win.buildStreamMessages?.([], "prompt", "custom", "summary") || [];
    expect(result[0].role).toBe("system");
    expect(result[0].content).toMatch(/custom/i);
    expect(result[1].role).toBe("system");
    expect(result[1].content).toMatch(/Summary/i);
  });

  test("shouldSkipSummarization returns true for long prompts", () => {
    expect(win.shouldSkipSummarization?.("a".repeat(10000))).toBe(true);
  });

  test("getSummaryMinLength adapts to history length", () => {
    expect(win.getSummaryMinLength?.(4)).toBe(80);
    expect(win.getSummaryMinLength?.(6)).toBe(120);
    expect(win.getSummaryMinLength?.(12)).toBe(200);
  });
});

