export {};
const {
  CHAT_STORE_DB,
  STORE_NAMES,
  estimateRecordSize,
  createEmptyStats,
  createMemoryChatStore
} = require("../src/shared/chat-store-backends.js");

describe("chat store backends", () => {
  test("exports constants", () => {
    expect(CHAT_STORE_DB).toBe("wegweiser-chat-store");
    expect(STORE_NAMES.THREADS).toBe("threads");
  });

  test("estimates record size safely", () => {
    expect(estimateRecordSize({ a: 1 })).toBeGreaterThan(0);
    expect(estimateRecordSize(null)).toBe(0);
  });

  test("creates empty stats shape", () => {
    expect(createEmptyStats()).toEqual({
      bytesUsed: 0,
      counts: {
        projects: 0,
        threads: 0,
        messages: 0,
        summaries: 0,
        archives: 0
      }
    });
  });

  test("memory store stats reflect inserted records", async () => {
    const store = createMemoryChatStore();
    store.projects.set("p1", { id: "p1" });
    store.threads.set("t1", { id: "t1" });
    store.messages.set("t1", [{ id: "m1" }, { id: "m2" }]);
    const stats = await store.stats();
    expect(stats.counts.projects).toBe(1);
    expect(stats.counts.threads).toBe(1);
    expect(stats.counts.messages).toBe(2);
    expect(stats.bytesUsed).toBeGreaterThan(0);
  });
});
