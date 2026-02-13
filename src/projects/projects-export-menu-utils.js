// projects-export-menu-utils.js - export menu open/close helpers for Projects

function closeProjectsExportMenus(rootDocument) {
  const doc = rootDocument || document;
  doc.querySelectorAll(".export-menu").forEach((menu) => menu.classList.remove("open"));
}

function toggleProjectsExportMenu(buttonEl, rootDocument) {
  const menu = buttonEl?.closest?.(".export-menu");
  if (!menu) return false;
  const isOpen = menu.classList.contains("open");
  closeProjectsExportMenus(rootDocument);
  if (!isOpen) {
    menu.classList.add("open");
    return true;
  }
  return false;
}

const projectsExportMenuUtils = {
  closeProjectsExportMenus,
  toggleProjectsExportMenu
};

if (typeof window !== "undefined") {
  window.projectsExportMenuUtils = projectsExportMenuUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsExportMenuUtils;
}
