// sidepanel-setup-controller-utils.js - setup readiness and visibility orchestration

function isProviderReady(localItems) {
  const openrouterKey = typeof localItems?.or_api_key === "string" ? localItems.or_api_key.trim() : "";
  return Boolean(openrouterKey);
}

function updateSetupPanelVisibility(isReady, deps = {}) {
  deps.setSidebarSetupRequired?.(!isReady);

  if (deps.setupPanel) {
    deps.setupPanel.style.display = isReady ? "none" : "flex";
  }
  if (deps.promptContainer) {
    deps.promptContainer.style.display = isReady ? "" : "none";
  }
  if (deps.modelSection) {
    deps.modelSection.style.display = isReady ? "" : "none";
  }
  if (!isReady && deps.modelStatusEl) {
    deps.modelStatusEl.textContent = "Add your OpenRouter API key in Options to load models.";
  }
}

async function refreshSidebarSetupState(deps = {}) {
  const localItems = await deps.getLocalStorage(["or_api_key"]);
  const ready = isProviderReady(localItems);
  updateSetupPanelVisibility(ready, deps);
  return ready;
}

const sidepanelSetupControllerUtils = {
  isProviderReady,
  updateSetupPanelVisibility,
  refreshSidebarSetupState
};

if (typeof window !== "undefined") {
  window.sidepanelSetupControllerUtils = sidepanelSetupControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelSetupControllerUtils;
}
