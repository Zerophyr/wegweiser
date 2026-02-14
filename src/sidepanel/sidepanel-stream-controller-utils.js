// sidepanel-stream-controller-utils.js - stream stop helper for Sidepanel

function stopActiveStream(deps) {
  if (!deps?.state?.activePort) {
    return false;
  }

  try {
    deps.state.activePort.disconnect();
  } catch (_) {
    // ignore disconnect failures
  }
  deps.state.activePort = null;

  deps.setPromptStreamingState?.(false);
  if (deps.askBtn) {
    deps.askBtn.disabled = false;
  }
  if (deps.metaEl) {
    deps.metaEl.textContent = "⚠️ Generation stopped by user.";
  }
  deps.hideTypingIndicator?.();
  deps.showToast?.("Generation stopped", "info");
  return true;
}

const sidepanelStreamControllerUtils = {
  stopActiveStream
};

if (typeof window !== "undefined") {
  window.sidepanelStreamControllerUtils = sidepanelStreamControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelStreamControllerUtils;
}