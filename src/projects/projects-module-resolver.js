// projects-module-resolver.js - resolves shared Projects helper modules in browser and tests

function resolveProjectsModule(windowKey, requirePath, requireFn) {
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

const projectsModuleResolver = { resolveProjectsModule };

if (typeof window !== "undefined") {
  window.projectsModuleResolver = projectsModuleResolver;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsModuleResolver;
}
