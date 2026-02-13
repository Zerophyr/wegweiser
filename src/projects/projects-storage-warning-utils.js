// projects-storage-warning-utils.js - UI helpers for Projects storage warning banner

function showProjectsStorageWarning(warningEl, messageEl, level, message) {
  if (!warningEl) return;
  warningEl.className = `storage-warning ${level}`;
  warningEl.style.display = "flex";
  if (messageEl) {
    messageEl.textContent = message;
  }
}

function hideProjectsStorageWarning(warningEl) {
  if (!warningEl) return;
  warningEl.style.display = "none";
}

const projectsStorageWarningUtils = {
  showProjectsStorageWarning,
  hideProjectsStorageWarning
};

if (typeof window !== "undefined") {
  window.projectsStorageWarningUtils = projectsStorageWarningUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStorageWarningUtils;
}
