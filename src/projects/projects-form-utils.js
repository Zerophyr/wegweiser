// projects-form-utils.js - Form data normalization for Projects modal

function buildProjectFormData({
  elements,
  parseCombinedModelId,
  normalizeProvider,
  buildModelDisplayName
} = {}) {
  const el = elements || {};
  const combinedModelId = el.ProjectModel?.value || "";
  const parsedModel = typeof parseCombinedModelId === "function"
    ? parseCombinedModelId(combinedModelId)
    : { provider: "openrouter", modelId: combinedModelId };
  const modelProvider = combinedModelId
    ? (typeof normalizeProvider === "function" ? normalizeProvider(parsedModel.provider) : parsedModel.provider)
    : null;
  const modelId = combinedModelId ? (parsedModel.modelId || "") : "";
  const modelDisplayName = combinedModelId
    ? (
      el.ProjectModelInput?.value
      || (typeof buildModelDisplayName === "function" ? buildModelDisplayName(modelProvider, modelId) : modelId)
    )
    : "";

  return {
    name: (el.ProjectName?.value || "").trim(),
    description: (el.ProjectDescription?.value || "").trim(),
    icon: el.ProjectIcon?.value || "📁",
    model: modelId,
    modelProvider,
    modelDisplayName,
    customInstructions: (el.ProjectInstructions?.value || "").trim(),
    webSearch: Boolean(el.ProjectWebSearch?.checked),
    reasoning: Boolean(el.ProjectReasoning?.checked)
  };
}

const projectsFormUtils = {
  buildProjectFormData
};

if (typeof window !== "undefined") {
  window.projectsFormUtils = projectsFormUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsFormUtils;
}
