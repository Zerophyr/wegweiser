// background-debug-stream-utils.js - debug stream state helpers for background worker

function createDebugStreamState(log, enabled = false) {
  return {
    log: log || { entries: [] },
    enabled: Boolean(enabled)
  };
}

async function setDebugEnabled(state, enabled, persistFn, storageKey) {
  state.enabled = Boolean(enabled);
  if (typeof persistFn === "function" && storageKey) {
    await persistFn({ [storageKey]: state.enabled });
  }
  return state.enabled;
}

function getDebugSnapshot(state, buildMetaFn) {
  const buildMeta = typeof buildMetaFn === "function" ? buildMetaFn : (() => ({}));
  return {
    ok: true,
    enabled: Boolean(state?.enabled),
    meta: buildMeta(state?.log),
    entries: state?.log?.entries || []
  };
}

function clearDebugEntries(state) {
  if (Array.isArray(state?.log?.entries)) {
    state.log.entries.length = 0;
  }
}

function applyDebugStorageChange(state, changes, area, storageKey) {
  if (area !== "local") return;
  if (!changes || !storageKey || !changes[storageKey]) return;
  state.enabled = Boolean(changes[storageKey].newValue);
}

function createDebugLogger(state, pushEntryFn) {
  const push = typeof pushEntryFn === "function" ? pushEntryFn : (() => {});
  return {
    isEnabled() {
      return Boolean(state?.enabled);
    },
    log(entry) {
      if (!this.isEnabled()) return false;
      push(state?.log, entry);
      return true;
    }
  };
}

const backgroundDebugStreamUtils = {
  createDebugStreamState,
  setDebugEnabled,
  getDebugSnapshot,
  clearDebugEntries,
  applyDebugStorageChange,
  createDebugLogger
};

if (typeof window !== "undefined") {
  window.backgroundDebugStreamUtils = backgroundDebugStreamUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundDebugStreamUtils;
}
