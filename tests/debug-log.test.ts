const {
  createDebugStreamLog,
  pushDebugStreamEntry,
  buildDebugLogMeta,
  buildDebugLogFilename,
} = require("../src/shared/debug-log.js");

describe("debug stream log helpers", () => {
  test("createDebugStreamLog defaults to 500 entries and empty log", () => {
    const log = createDebugStreamLog();
    expect(log.entries).toEqual([]);
    expect(log.maxEntries).toBe(500);
  });

  test("pushDebugStreamEntry appends entries and sets timestamp", () => {
    const log = createDebugStreamLog(2);
    const entry = pushDebugStreamEntry(log, { type: "stream_start" });
    expect(log.entries.length).toBe(1);
    expect(entry.ts).toBeDefined();
  });

  test("pushDebugStreamEntry trims entries beyond max", () => {
    const log = createDebugStreamLog(2);
    pushDebugStreamEntry(log, { type: "first", ts: "t1" });
    pushDebugStreamEntry(log, { type: "second", ts: "t2" });
    pushDebugStreamEntry(log, { type: "third", ts: "t3" });
    expect(log.entries.length).toBe(2);
    expect(log.entries[0].type).toBe("second");
    expect(log.entries[1].type).toBe("third");
  });

  test("buildDebugLogMeta returns empty state for no entries", () => {
    const log = createDebugStreamLog(3);
    expect(buildDebugLogMeta(log)).toEqual({
      count: 0,
      startAt: null,
      endAt: null,
    });
  });

  test("buildDebugLogMeta returns start/end timestamps", () => {
    const log = createDebugStreamLog(3);
    pushDebugStreamEntry(log, { type: "a", ts: "2026-01-28T22:06:06Z" });
    pushDebugStreamEntry(log, { type: "b", ts: "2026-01-28T22:07:06Z" });
    expect(buildDebugLogMeta(log)).toEqual({
      count: 2,
      startAt: "2026-01-28T22:06:06Z",
      endAt: "2026-01-28T22:07:06Z",
    });
  });

  test("buildDebugLogFilename uses UTC timestamp", () => {
    const filename = buildDebugLogFilename(new Date("2026-01-28T22:06:06Z"));
    expect(filename).toBe("wegweiser-stream-debug-2026-01-28_22-06-06Z.json");
  });
});
