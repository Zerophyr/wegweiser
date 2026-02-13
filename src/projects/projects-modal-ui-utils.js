// projects-modal-ui-utils.js - modal open/close helpers for Projects UI

function setModalVisibility(modalEl, isOpen) {
  if (!modalEl) return;
  modalEl.style.display = isOpen ? "flex" : "none";
}

function shouldCloseModalOnBackdropClick(event, modalEl) {
  return Boolean(event && modalEl && event.target === modalEl);
}

function isEscapeCloseEvent(event) {
  return event?.key === "Escape";
}

const projectsModalUiUtils = {
  setModalVisibility,
  shouldCloseModalOnBackdropClick,
  isEscapeCloseEvent
};

if (typeof window !== "undefined") {
  window.projectsModalUiUtils = projectsModalUiUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsModalUiUtils;
}
