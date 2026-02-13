// projects-view-utils.js - Helpers for Projects view state and list presentation

function applyViewSelection(viewName, options = {}) {
  const listView = options.listView || null;
  const projectView = options.projectView || null;

  if (typeof document !== "undefined") {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  }

  if (viewName === "list") {
    if (listView) listView.classList.add("active");
    return { shouldResetSelection: true };
  }

  if (viewName === "Project") {
    if (projectView) projectView.classList.add("active");
  }

  return { shouldResetSelection: false };
}

function getProjectsListVisibilityState(projects) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const showEmpty = safeProjects.length === 0;
  return {
    showEmpty,
    gridDisplay: showEmpty ? "none" : "grid",
    emptyDisplay: showEmpty ? "flex" : "none"
  };
}

function sortProjectsByUpdatedAt(projects) {
  const safeProjects = Array.isArray(projects) ? projects.slice() : [];
  safeProjects.sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
  return safeProjects;
}

const projectsViewUtils = {
  applyViewSelection,
  getProjectsListVisibilityState,
  sortProjectsByUpdatedAt
};

if (typeof window !== "undefined") {
  window.projectsViewUtils = projectsViewUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsViewUtils;
}
