export {};

const {
  getIndexedDbStorageUsage,
  estimateItemSize,
  normalizeThreadProjectId,
  ensureThreadMessage,
  buildThreadRecordForStorage,
  normalizeLegacyThreadsPayload
} = require("../src/projects/projects-storage-utils.js");

describe("projects storage utils", () => {
  test("combines image/chat usage and computes quota usage", async () => {
    const usage = await getIndexedDbStorageUsage({
      getImageStoreStats: async () => ({ bytesUsed: 200 }),
      getChatStoreStats: async () => ({ bytesUsed: 300 }),
      storageApi: { estimate: async () => ({ quota: 1000 }) }
    });

    expect(usage.bytesUsed).toBe(500);
    expect(usage.quotaBytes).toBe(1000);
    expect(usage.percentUsed).toBeCloseTo(50);
  });

  test("falls back to chatStore stats when direct helper is missing", async () => {
    const usage = await getIndexedDbStorageUsage({
      getImageStoreStats: async () => ({ bytesUsed: 100 }),
      chatStore: { getStats: async () => ({ bytesUsed: 150 }) },
      storageApi: null
    });

    expect(usage.bytesUsed).toBe(250);
    expect(usage.quotaBytes).toBeNull();
    expect(usage.percentUsed).toBeNull();
  });



  test("uses configured quota override for storage indicator calculations", async () => {
    const usage = await getIndexedDbStorageUsage({
      getImageStoreStats: async () => ({ bytesUsed: 200 }),
      getChatStoreStats: async () => ({ bytesUsed: 300 }),
      storageApi: { estimate: async () => ({ quota: 2 * 1024 * 1024 * 1024 }) },
      quotaBytesOverride: 1000
    });

    expect(usage.bytesUsed).toBe(500);
    expect(usage.quotaBytes).toBe(1000);
    expect(usage.percentUsed).toBeCloseTo(50);
  });
  test("estimateItemSize returns positive byte count", async () => {
    const size = await estimateItemSize({ id: "thread-1", title: "Hello" });
    expect(size).toBeGreaterThan(0);
  });

  test("normalizeThreadProjectId migrates legacy ProjectId/spaceId fields", () => {
    const normalized = normalizeThreadProjectId({
      id: "t1",
      ProjectId: "p-legacy",
      spaceId: "p-old"
    });

    expect(normalized.projectId).toBe("p-legacy");
    expect(normalized.ProjectId).toBeUndefined();
    expect(normalized.spaceId).toBeUndefined();
  });

  test("ensureThreadMessage backfills id/threadId/createdAt", () => {
    const created = ensureThreadMessage(
      { role: "user", content: "hello" },
      "thread-9",
      2,
      1234
    );

    expect(created.id).toBe("thread-9_msg_2");
    expect(created.threadId).toBe("thread-9");
    expect(created.createdAt).toBe(1236);
  });

  test("buildThreadRecordForStorage strips large chat fields from thread record", () => {
    const record = buildThreadRecordForStorage({
      id: "thread-1",
      projectId: "project-1",
      title: "T",
      messages: [{ id: "m1" }],
      summary: "s",
      summaryUpdatedAt: 1,
      archivedMessages: [{ id: "a1" }],
      archivedUpdatedAt: 2
    });

    expect(record).toEqual({
      id: "thread-1",
      projectId: "project-1",
      title: "T"
    });
  });

  test("normalizeLegacyThreadsPayload converts keyed legacy maps to thread arrays", () => {
    const legacy = {
      alpha: [
        { id: "t1", title: "A1", ProjectId: "alpha" },
        { id: "t2", title: "A2" }
      ],
      beta: [{ id: "t3", title: "B1", spaceId: "beta" }]
    };

    const result = normalizeLegacyThreadsPayload(legacy);

    expect(result.normalized).toBe(true);
    expect(result.threads).toEqual([
      { id: "t1", title: "A1", projectId: "alpha" },
      { id: "t2", title: "A2", projectId: "alpha" },
      { id: "t3", title: "B1", projectId: "beta" }
    ]);
  });
});
