let spacesLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  __SPACES_LOADED__?: boolean;
  getLiveWindowSize?: (summary: string | null) => number;
  splitMessagesForSummary?: (messages: any[], liveWindowSize: number) => {
    historyToSummarize: any[];
    liveMessages: any[];
  };
};

function loadSpaces() {
  if (spacesLoaded) return;
  win.__TEST__ = true;
  require("../src/spaces/spaces.js");
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
});
