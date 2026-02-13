// projects-menu-utils.js - dropdown menu helpers for Projects list/thread actions

function closeProjectsDropdownMenus(rootDocument) {
  const doc = rootDocument || document;
  doc.querySelectorAll(".menu-items").forEach((menu) => {
    menu.style.display = "none";
  });
}

function toggleProjectsDropdownMenu(buttonEl, rootDocument) {
  if (!buttonEl) return false;
  const doc = rootDocument || document;
  const targetMenu = buttonEl.nextElementSibling;
  doc.querySelectorAll(".menu-items").forEach((menu) => {
    if (menu !== targetMenu) {
      menu.style.display = "none";
    }
  });
  if (!targetMenu) return false;
  targetMenu.style.display = targetMenu.style.display === "none" ? "block" : "none";
  return targetMenu.style.display === "block";
}

const projectsMenuUtils = {
  closeProjectsDropdownMenus,
  toggleProjectsDropdownMenu
};

if (typeof window !== "undefined") {
  window.projectsMenuUtils = projectsMenuUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsMenuUtils;
}
