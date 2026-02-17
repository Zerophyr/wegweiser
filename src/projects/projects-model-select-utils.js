// projects-model-select-utils.js - DOM-safe model select option rendering helpers

function renderProjectModelSelectOptions(selectEl, models, currentCombinedId, getModelDisplayName) {
  if (!selectEl) return;
  const safeModels = Array.isArray(models) ? models : [];
  const displayName = typeof getModelDisplayName === "function"
    ? getModelDisplayName
    : ((model) => String(model?.name || model?.id || ""));

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Use default model";
  selectEl.replaceChildren(defaultOption);

  safeModels.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = displayName(model);
    if (model.id === currentCombinedId) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
}

const projectsModelSelectUtils = {
  renderProjectModelSelectOptions
};

if (typeof window !== "undefined") {
  window.projectsModelSelectUtils = projectsModelSelectUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsModelSelectUtils;
}
