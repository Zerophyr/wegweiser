// options-page-actions-utils.js - options page wiring helpers

function normalizeHistoryCsv(history) {
  let csv = "timestamp,prompt,answer\n";
  history.forEach((item) => {
    const timestamp = new Date(item.createdAt).toISOString();
    const prompt = `"${(item.prompt || "").replace(/"/g, '""')}"`;
    const answer = `"${(item.answer || "").replace(/"/g, '""')}"`;
    csv += `"${timestamp}",${prompt},${answer}\n`;
  });
  return csv;
}

function exportHistoryJSON({ currentHistory, toast, historyUtils }) {
  if (currentHistory.length === 0) {
    toast.warning("No history to export");
    return;
  }
  const buildJson = historyUtils.buildHistoryJson || ((history) => JSON.stringify(history, null, 2));
  const dataStr = buildJson(currentHistory);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `openrouter-history-${new Date().toISOString().split("T")[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${currentHistory.length} history items as JSON`);
}

function exportHistoryCSV({ currentHistory, toast, historyUtils }) {
  if (currentHistory.length === 0) {
    toast.warning("No history to export");
    return;
  }
  const buildCsv = historyUtils.buildHistoryCsv || normalizeHistoryCsv;
  const csv = buildCsv(currentHistory);
  const dataBlob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `openrouter-history-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${currentHistory.length} history items as CSV`);
}

function wireProviderKeyInput({ provider, inputEl, saveProviderKey, syncProviderToggleState, updateEnableStatus, updateProviderModelsAfterChange }) {
  if (!inputEl) return;
  let debounceId = null;
  inputEl.addEventListener("input", () => {
    const value = inputEl.value.trim();
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(async () => {
      await saveProviderKey(provider, value);
      await syncProviderToggleState(provider, value);
      if (value.length === 0) updateEnableStatus(provider, false);
      await updateProviderModelsAfterChange();
    }, 300);
  });
}

function wireProviderEnableToggle({ provider, toggleEl, inputEl, updateEnableStatus, updateProviderModelsAfterChange }) {
  if (!toggleEl) return;
  toggleEl.addEventListener("change", async () => {
    const hasKey = Boolean(inputEl?.value?.trim().length);
    if (!hasKey) {
      toggleEl.checked = false;
      toggleEl.disabled = true;
      updateEnableStatus(provider, false);
      return;
    }
    updateEnableStatus(provider, toggleEl.checked);
    await updateProviderModelsAfterChange();
  });
}

function registerDebugStreamHandlers({ debugStreamToggle, downloadDebugLogBtn, clearDebugLogBtn, setLocalStorage, debugStreamKey, runtime, toast, buildDebugLogFilename }) {
  if (debugStreamToggle) {
    debugStreamToggle.addEventListener("change", async () => {
      const enabled = Boolean(debugStreamToggle.checked);
      await setLocalStorage({ [debugStreamKey]: enabled });
      if (downloadDebugLogBtn) downloadDebugLogBtn.disabled = !enabled;
      if (clearDebugLogBtn) clearDebugLogBtn.disabled = !enabled;
      try {
        await runtime.sendMessage({ type: "debug_set_enabled", enabled });
      } catch (e) {
        console.warn("Failed to notify debug toggle:", e);
      }
    });
  }

  if (downloadDebugLogBtn) {
    downloadDebugLogBtn.addEventListener("click", async () => {
      try {
        const res = await runtime.sendMessage({ type: "debug_get_stream_log" });
        if (!res?.ok) throw new Error(res?.error || "Failed to fetch debug log");
        const payload = { meta: res.meta || {}, entries: res.entries || [] };
        const dataStr = JSON.stringify(payload, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = typeof buildDebugLogFilename === "function"
          ? buildDebugLogFilename()
          : `wegweiser-stream-debug-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${payload.entries.length} debug entries`);
      } catch (e) {
        console.error("Failed to download debug log:", e);
        toast.error("Failed to download debug log");
      }
    });
  }

  if (clearDebugLogBtn) {
    clearDebugLogBtn.addEventListener("click", async () => {
      try {
        const res = await runtime.sendMessage({ type: "debug_clear_stream_log" });
        if (!res?.ok) throw new Error(res?.error || "Failed to clear debug log");
        toast.success("Debug log cleared");
      } catch (e) {
        console.error("Failed to clear debug log:", e);
        toast.error("Failed to clear debug log");
      }
    });
  }
}

function registerImageCacheHandlers({ clearImageCacheBtn, imageCacheLimitInput, normalizeImageCacheLimitMb, updateImageCacheLimitLabel, cleanupImageStore, toast }) {
  if (clearImageCacheBtn) {
    clearImageCacheBtn.addEventListener("click", async () => {
      try {
        if (typeof cleanupImageStore !== "function") {
          throw new Error("Image store unavailable");
        }
        await cleanupImageStore(Infinity);
        toast.success("Image cache cleared");
      } catch (e) {
        console.error("Failed to clear image cache:", e);
        toast.error("Failed to clear image cache");
      }
    });
  }

  if (imageCacheLimitInput) {
    imageCacheLimitInput.addEventListener("input", () => {
      const normalized = normalizeImageCacheLimitMb(parseInt(imageCacheLimitInput.value, 10));
      imageCacheLimitInput.value = normalized;
      updateImageCacheLimitLabel(normalized);
    });
  }
}

function registerThemeHandlers({ themeSelect, getLocalStorage, applyTheme, THEMES, toast }) {
  getLocalStorage(["or_theme"]).then((result) => {
    if (result.or_theme && themeSelect) {
      themeSelect.value = result.or_theme;
    }
  });

  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      const themeName = themeSelect.value;
      applyTheme(themeName);
      toast.success(`Theme changed to ${THEMES[themeName].name}`);
    });
  }
}

const optionsPageActionsUtils = {
  normalizeHistoryCsv,
  exportHistoryJSON,
  exportHistoryCSV,
  wireProviderKeyInput,
  wireProviderEnableToggle,
  registerDebugStreamHandlers,
  registerImageCacheHandlers,
  registerThemeHandlers
};

if (typeof window !== "undefined") {
  window.optionsPageActionsUtils = optionsPageActionsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsPageActionsUtils;
}
