const DEFAULT_MAX_ENTRIES = 500;

const createDebugStreamLog = (maxEntries = DEFAULT_MAX_ENTRIES) => ({
  entries: [],
  maxEntries,
});

const formatDebugTimestamp = (date) => {
  const iso = date.toISOString();
  return iso.replace(/\.\d{3}Z$/, "Z").replace("T", "_").replace(/:/g, "-");
};

const buildDebugLogFilename = (date = new Date()) =>
  `wegweiser-stream-debug-${formatDebugTimestamp(date)}.json`;

const pushDebugStreamEntry = (log, entry) => {
  const stamped = {
    ...entry,
    ts: entry.ts || new Date().toISOString(),
  };
  log.entries.push(stamped);
  if (log.entries.length > log.maxEntries) {
    log.entries.splice(0, log.entries.length - log.maxEntries);
  }
  return stamped;
};

const buildDebugLogMeta = (log) => {
  if (!log.entries.length) {
    return { count: 0, startAt: null, endAt: null };
  }
  return {
    count: log.entries.length,
    startAt: log.entries[0].ts,
    endAt: log.entries[log.entries.length - 1].ts,
  };
};

if (typeof module !== "undefined") {
  module.exports = {
    DEFAULT_MAX_ENTRIES,
    createDebugStreamLog,
    pushDebugStreamEntry,
    buildDebugLogMeta,
    buildDebugLogFilename,
    formatDebugTimestamp,
  };
}

const root = typeof globalThis !== "undefined" ? globalThis : null;
if (root) {
  root.DEFAULT_MAX_ENTRIES = DEFAULT_MAX_ENTRIES;
  root.createDebugStreamLog = createDebugStreamLog;
  root.pushDebugStreamEntry = pushDebugStreamEntry;
  root.buildDebugLogMeta = buildDebugLogMeta;
  root.buildDebugLogFilename = buildDebugLogFilename;
  root.formatDebugTimestamp = formatDebugTimestamp;
}
