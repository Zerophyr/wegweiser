// projects-delete-modal-utils.js - Delete confirmation copy builders for Projects UI

function buildProjectDeleteModalContent(projectName, threadCount) {
  const safeCount = Number.isFinite(threadCount) ? threadCount : 0;
  return {
    title: "Delete Project",
    message: `Are you sure you want to delete "${projectName}" and all its threads?`,
    sizeText: `This will delete ${safeCount} thread${safeCount !== 1 ? "s" : ""}.`
  };
}

function buildThreadDeleteModalContent(threadTitle, sizeBytes) {
  const safeBytes = Number.isFinite(sizeBytes) ? sizeBytes : 0;
  return {
    title: "Delete Thread",
    message: `Are you sure you want to delete "${threadTitle}"?`,
    sizeText: `This will free ~${(safeBytes / 1024).toFixed(1)}KB.`
  };
}

const projectsDeleteModalUtils = {
  buildProjectDeleteModalContent,
  buildThreadDeleteModalContent
};

if (typeof window !== "undefined") {
  window.projectsDeleteModalUtils = projectsDeleteModalUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsDeleteModalUtils;
}
