// sidepanel-module-resolver.js - resolves sidepanel helper modules for browser and tests

function resolveSidepanelModule(windowKey, requirePath, requireFn) {
  if (typeof window !== "undefined" && window && window[windowKey]) {
    return window[windowKey];
  }
  const loader = typeof requireFn === "function"
    ? requireFn
    : (typeof require === "function" ? require : null);
  if (!loader || !requirePath) {
    return {};
  }
  try {
    return loader(requirePath) || {};
  } catch (_) {
    return {};
  }
}

const sidepanelModuleResolver = { resolveSidepanelModule };

if (typeof window !== "undefined") {
  window.sidepanelModuleResolver = sidepanelModuleResolver;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelModuleResolver;
}
