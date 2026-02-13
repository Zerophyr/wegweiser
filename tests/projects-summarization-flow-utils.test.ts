export {};

const {
  maybeSummarizeBeforeStreaming
} = require("../src/projects/projects-summarization-flow-utils.js");

describe("projects summarization flow utils", () => {
  test("returns thread unchanged when no summary window overflow", async () => {
    const thread = { messages: [{ role: "user", content: "a" }], summary: "" };
    const out = await maybeSummarizeBeforeStreaming({
      thread,
      content: "hello",
      currentThreadId: "t1",
      project: {},
      currentProvider: "openrouter"
    }, {
      getLiveWindowSize: () => 12,
      splitMessagesForSummary: () => ({ historyToSummarize: [], liveMessages: thread.messages }),
      shouldSkipSummarization: () => false
    });

    expect(out).toBe(thread);
  });

  test("updates thread summary and archive when summarize response is valid", async () => {
    const updates: any[] = [];
    const thread = {
      messages: [
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" }
      ],
      summary: "",
      archivedMessages: []
    };

    const out = await maybeSummarizeBeforeStreaming({
      thread,
      content: "new prompt",
      currentThreadId: "t1",
      project: { model: "gpt-5", modelProvider: "naga" },
      currentProvider: "openrouter"
    }, {
      getLiveWindowSize: () => 1,
      splitMessagesForSummary: () => ({
        historyToSummarize: thread.messages.slice(0, 2),
        liveMessages: thread.messages.slice(2)
      }),
      shouldSkipSummarization: () => false,
      getSummaryMinLength: () => 5,
      appendArchivedMessages: (a: any[], b: any[]) => [...a, ...b],
      sendRuntimeMessage: async () => ({ ok: true, summary: "valid summary text" }),
      updateThread: async (_id: string, patch: any) => { updates.push(patch); }
    });

    expect(out.summary).toBe("valid summary text");
    expect(out.messages.length).toBe(1);
    expect(out.archivedMessages.length).toBe(2);
    expect(updates).toHaveLength(1);
  });
});
