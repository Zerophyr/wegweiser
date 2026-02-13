// projects-project-modal-utils.js - View-state builders for create/edit project modal

function buildCreateProjectModalViewState() {
  return {
    title: "Create Project",
    saveLabel: "Create Project",
    icon: "📁",
    webSearch: false,
    reasoning: false
  };
}

function buildEditProjectModalViewState({
  project,
  currentProvider,
  normalizeProvider,
  buildCombinedModelId,
  getProjectModelLabel
} = {}) {
  const modelProvider = typeof normalizeProvider === "function"
    ? normalizeProvider(project?.modelProvider || currentProvider)
    : (project?.modelProvider || currentProvider || "openrouter");
  const modelCombinedId = project?.model
    ? (typeof buildCombinedModelId === "function" ? buildCombinedModelId(modelProvider, project.model) : `${modelProvider}:${project.model}`)
    : "";
  return {
    title: "Edit Project",
    saveLabel: "Save Changes",
    name: project?.name || "",
    description: project?.description || "",
    icon: project?.icon || "📁",
    modelCombinedId,
    modelDisplayName: project?.model
      ? (typeof getProjectModelLabel === "function" ? getProjectModelLabel(project) : project.model)
      : "",
    customInstructions: project?.customInstructions || "",
    webSearch: Boolean(project?.webSearch),
    reasoning: Boolean(project?.reasoning)
  };
}

const projectsProjectModalUtils = {
  buildCreateProjectModalViewState,
  buildEditProjectModalViewState
};

if (typeof window !== "undefined") {
  window.projectsProjectModalUtils = projectsProjectModalUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsProjectModalUtils;
}
