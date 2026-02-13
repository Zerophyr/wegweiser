export {};

const {
  createDebugStreamState,
  setDebugEnabled,
  getDebugSnapshot,
  clearDebugEntries,
  applyDebugStorageChange,
  createDebugLogger
} = require("../src/background/background-debug-stream-utils.js");

describe("background debug stream utils", () => {
  test("createDebugStreamState builds state object", () => {
    const state = createDebugStreamState({ entries: [{ type: "x" }] }, true);
    expect(state.enabled).toBe(true);
    expect(state.log.entries).toHaveLength(1);
  });

  test("setDebugEnabled updates state and persists", async () => {
    const state = createDebugStreamState({ entries: [] }, false);
    const calls: any[] = [];
    await setDebugEnabled(state, true, async (payload: any) => { calls.push(payload); }, "or_debug_stream");
    expect(state.enabled).toBe(true);
    expect(calls).toEqual([{ or_debug_stream: true }]);
  });

  test("snapshot and clear operate on log entries", () => {
    const state = createDebugStreamState({ entries: [{ type: "a" }, { type: "b" }] }, true);
    const snap = getDebugSnapshot(state, () => ({ count: 2 }));
    expect(snap.ok).toBe(true);
    expect(snap.enabled).toBe(true);
    expect(snap.entries).toHaveLength(2);
    clearDebugEntries(state);
    expect(state.log.entries).toHaveLength(0);
  });

  test("applyDebugStorageChange updates enabled from local change", () => {
    const state = createDebugStreamState({ entries: [] }, false);
    applyDebugStorageChange(
      state,
      { or_debug_stream: { newValue: 1 } },
      "local",
      "or_debug_stream"
    );
    expect(state.enabled).toBe(true);
    applyDebugStorageChange(state, { or_debug_stream: { newValue: 0 } }, "sync", "or_debug_stream");
    expect(state.enabled).toBe(true);
  });

  test("createDebugLogger logs only when enabled", () => {
    const state = createDebugStreamState({ entries: [] }, false);
    const pushed: any[] = [];
    const logger = createDebugLogger(state, (_log: any, entry: any) => { pushed.push(entry); });

    logger.log({ type: "a" });
    expect(pushed).toHaveLength(0);

    state.enabled = true;
    logger.log({ type: "b" });
    expect(pushed).toEqual([{ type: "b" }]);
  });
});
