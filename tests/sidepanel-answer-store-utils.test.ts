export {};
const {
  getAnswerStorage,
  getCurrentTabId,
  getSidepanelThreadId,
  buildAnswerCacheKey
} = require("../src/sidepanel/sidepanel-answer-store-utils.js");

describe("sidepanel answer store utils", () => {
  test("prefers session storage when available", () => {
    const chromeMock = {
      storage: {
        session: { name: "session" },
        local: { name: "local" }
      }
    };
    expect(getAnswerStorage(chromeMock).name).toBe("session");
  });

  test("falls back to local storage", () => {
    const chromeMock = { storage: { local: { name: "local" } } };
    expect(getAnswerStorage(chromeMock).name).toBe("local");
  });

  test("builds cache key and sidepanel thread id", async () => {
    expect(buildAnswerCacheKey(123)).toBe("or_sidepanel_answer_123");
    const tabsApi = {
      query: jest.fn().mockResolvedValue([{ id: 7 }])
    };
    await expect(getCurrentTabId(tabsApi)).resolves.toBe(7);
    await expect(getSidepanelThreadId(tabsApi)).resolves.toBe("sidepanel_7");
  });
});
