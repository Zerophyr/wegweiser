export {};

const {
  persistThreadToChatStore,
  loadThreads,
  addMessageToThread
} = require("../src/projects/projects-storage-controller-utils.js");

describe("projects-storage-controller-utils", () => {
  test("persistThreadToChatStore writes thread, messages, summary and archive", async () => {
    const chatStore = {
      deleteThread: jest.fn().mockResolvedValue(undefined),
      putThread: jest.fn().mockResolvedValue(undefined),
      putMessage: jest.fn().mockResolvedValue(undefined),
      setSummary: jest.fn().mockResolvedValue(undefined),
      setArchivedMessages: jest.fn().mockResolvedValue(undefined)
    };

    const thread = {
      id: "t1",
      projectId: "p1",
      title: "Thread",
      messages: [{ id: "m1", role: "user", content: "hi" }],
      summary: "sum",
      summaryUpdatedAt: 10,
      archivedMessages: [{ id: "a1", role: "assistant", content: "old" }],
      archivedUpdatedAt: 11,
      updatedAt: 20
    };

    await persistThreadToChatStore(thread, {
      chatStore,
      normalizeThreadProjectId: (value: any) => value,
      buildThreadRecordForStorage: (value: any) => ({ id: value.id, projectId: value.projectId, title: value.title }),
      ensureThreadMessage: (msg: any, threadId: string) => ({ ...msg, threadId })
    });

    expect(chatStore.deleteThread).toHaveBeenCalledWith("t1");
    expect(chatStore.putThread).toHaveBeenCalledWith({ id: "t1", projectId: "p1", title: "Thread" });
    expect(chatStore.putMessage).toHaveBeenCalledTimes(1);
    expect(chatStore.setSummary).toHaveBeenCalledWith("t1", "sum", 10);
    expect(chatStore.setArchivedMessages).toHaveBeenCalledTimes(1);
  });

  test("loadThreads hydrates chatStore records and filters sidepanel thread", async () => {
    const chatStore = {
      getThreads: jest.fn().mockResolvedValue([
        { id: "t1", projectId: "p1", title: "A" },
        { id: "side", projectId: "__sidepanel__", title: "Hidden" }
      ]),
      getMessages: jest.fn().mockResolvedValue([{ id: "m1" }]),
      getSummary: jest.fn().mockResolvedValue({ summary: "s", summaryUpdatedAt: 5 }),
      getArchivedMessages: jest.fn().mockResolvedValue({ archivedMessages: [{ id: "a1" }], archivedUpdatedAt: 6 })
    };

    const threads = await loadThreads(null, {
      chatStore,
      getLocalStorage: jest.fn(),
      storageKeys: {},
      normalizeLegacyThreadsPayload: jest.fn(),
      saveThreads: jest.fn(),
      logger: console
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe("t1");
    expect(threads[0].messages).toEqual([{ id: "m1" }]);
    expect(threads[0].summary).toBe("s");
    expect(threads[0].archivedMessages).toEqual([{ id: "a1" }]);
  });

  test("addMessageToThread appends message and persists updated thread list", async () => {
    const existingThread = { id: "t1", title: "Old", messages: [] };
    const updatedThread = { id: "t1", title: "Updated", messages: [{ id: "m2" }] };
    const saveThreads = jest.fn().mockResolvedValue(undefined);

    const result = await addMessageToThread("t1", { role: "user", content: "Hello" }, {
      getThread: jest.fn().mockResolvedValue(existingThread),
      appendMessageToThreadData: jest.fn().mockReturnValue(updatedThread),
      loadThreads: jest.fn().mockResolvedValue([existingThread]),
      saveThreads,
      generateThreadTitle: jest.fn().mockReturnValue("Updated")
    });

    expect(result).toBe(updatedThread);
    expect(saveThreads).toHaveBeenCalledWith([updatedThread]);
  });
});
