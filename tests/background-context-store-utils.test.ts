export {};
const {
  getContextStorageKey,
  parseStoredTabId,
  loadContextsFromStorage,
  persistContextForTab,
  removeContextForTab
} = require("../src/background/background-context-store-utils.js");

describe("background context store utils", () => {
  test("builds context storage keys", () => {
    expect(getContextStorageKey(12)).toBe("or_context_session_12");
    expect(getContextStorageKey("x", "custom_")).toBe("custom_x");
  });

  test("parses tab ids", () => {
    expect(parseStoredTabId(99)).toBe(99);
    expect(parseStoredTabId("abc")).toBe("abc");
    expect(parseStoredTabId("1")).toBe(1);
    expect(parseStoredTabId("default")).toBe("default");
  });

  test("loads contexts map from storage snapshot", async () => {
    const result = await loadContextsFromStorage({
      getAll: async () => ({
        or_context_session_1: [{ role: "user", content: "a" }],
        other_key: "ignored",
        or_context_session_default: [{ role: "assistant", content: "b" }]
      }),
      prefix: "or_context_session_"
    });

    expect(result.get(1)).toEqual([{ role: "user", content: "a" }]);
    expect(result.get("default")).toEqual([{ role: "assistant", content: "b" }]);
    expect(result.size).toBe(2);
  });

  test("persists and removes context entries", async () => {
    const setCalls: any[] = [];
    const removeCalls: any[] = [];
    const storage = {
      set: async (payload: any) => { setCalls.push(payload); },
      remove: async (keys: string[]) => { removeCalls.push(keys); }
    };
    const contexts = new Map<any, any>([[3, [{ role: "user", content: "x" }]]]);

    await persistContextForTab(storage, contexts, 3, "or_context_session_");
    await removeContextForTab(storage, 3, "or_context_session_");

    expect(setCalls).toEqual([{ or_context_session_3: [{ role: "user", content: "x" }] }]);
    expect(removeCalls).toEqual([["or_context_session_3"]]);
  });
});
