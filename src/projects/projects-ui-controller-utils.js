// projects-ui-controller-utils.js - provider/context/model UI helpers for Projects

function getSafeHtmlModule() {
  return (typeof globalThis !== "undefined" && globalThis.safeHtml)
  || (typeof module !== "undefined" && module.exports ? require("../modules/safe-html.js") : null)
  || {};
}

function setSafeHtml(element, html) {
  if (!element) return;
  if (typeof getSafeHtmlModule().setSanitizedHtml === "function") {
    getSafeHtmlModule().setSanitizedHtml(element, html || "");
    return;
  }
  element.textContent = typeof html === "string" ? html : "";
}

const IMAGE_CACHE_LIMIT_DEFAULT = 512;
const IMAGE_CACHE_LIMIT_MIN = 128;
const IMAGE_CACHE_LIMIT_MAX = 2048;
const IMAGE_CACHE_LIMIT_STEP = 64;

const PROJECT_EMOJIS = [
  "📁", "📂", "📋", "📝", "📚", "📖", "📓", "📒",
  "💼", "🗂️", "🗃️", "📊", "📈", "📉", "🧮", "💡",
  "🎯", "🚀", "⭐", "🌟", "💫", "✨", "🔥", "💪",
  "🧠", "💭", "💬", "🗣️", "👥", "🤝", "🎓", "🏆",
  "🔬", "🔭", "🧪", "⚗️", "🔧", "🔨", "⚙️", "🛠️",
  "💻", "🖥️", "📱", "🌐", "🔗", "📡", "🎮", "🎨",
  "🎵", "🎬", "📷", "🎤", "✏️", "🖊️", "🖌️", "📐",
  "🏠", "🏢", "🏗️", "🌳", "🌍", "🌎", "🌏", "☀️"
];

function normalizeImageCacheLimitMb(value) {
  if (!Number.isFinite(value)) return IMAGE_CACHE_LIMIT_DEFAULT;
  const clamped = Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, value));
  const snapped = Math.round(clamped / IMAGE_CACHE_LIMIT_STEP) * IMAGE_CACHE_LIMIT_STEP;
  return Math.max(IMAGE_CACHE_LIMIT_MIN, Math.min(IMAGE_CACHE_LIMIT_MAX, snapped));
}

function getProjectModelLabel(project, deps) {
  if (!project || !project.model) return "Default";
  if (project.modelDisplayName) return project.modelDisplayName;
  if (typeof deps.buildModelDisplayName === "function") {
    return deps.buildModelDisplayName(project.modelProvider || "openrouter", project.model);
  }
  return project.model.split("/").pop() || project.model;
}

function updateChatModelIndicator(project, deps) {
  const { elements, formatThreadModelLabel } = deps;
  if (!elements.chatModelIndicator) return;
  if (!project) {
    elements.chatModelIndicator.textContent = "";
    return;
  }
  if (typeof formatThreadModelLabel === "function") {
    elements.chatModelIndicator.textContent = formatThreadModelLabel({
      model: project.model || "",
      modelDisplayName: project.modelDisplayName || ""
    });
    return;
  }
  elements.chatModelIndicator.textContent = `Model: ${getProjectModelLabel(project, deps)}`;
}

function setChatImageToggleState(enabled, disabled, deps) {
  const { elements } = deps;
  if (!elements.chatImageMode) return;
  elements.chatImageMode.checked = enabled;
  elements.chatImageMode.disabled = disabled;
  const label = elements.chatImageMode.closest(".chat-toggle");
  if (label) {
    label.classList.toggle("disabled", disabled);
    label.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
}

function applyProjectImageMode(project, deps) {
  setChatImageToggleState(Boolean(deps.imageModeEnabled()), false, deps);
}

async function loadProviderSetting(deps) {
  try {
    const stored = await deps.getLocalStorage(["or_provider", "or_model_provider"]);
    deps.setCurrentProvider(deps.normalizeProviderSafe(stored.or_model_provider || stored.or_provider));
  } catch (e) {
    console.warn("Failed to load provider setting:", e);
  }
}

function updateProjectsContextButton(thread, project, deps) {
  const { elements, getProjectsContextButtonState, maxContextMessages } = deps;
  if (!elements.ProjectsContextBtn) return;
  const badgeEl = elements.ProjectsContextBadge;
  if (!thread) {
    elements.ProjectsContextBtn.classList.add("inactive");
    elements.ProjectsContextBtn.setAttribute("aria-disabled", "true");
    if (badgeEl) {
      badgeEl.style.display = "none";
      badgeEl.textContent = "";
    }
    return;
  }
  const state = getProjectsContextButtonState(thread, project, maxContextMessages);
  const { isActive, label } = state;
  elements.ProjectsContextBtn.classList.toggle("inactive", !isActive);
  elements.ProjectsContextBtn.setAttribute("aria-disabled", isActive ? "false" : "true");
  if (badgeEl) {
    if (isActive) {
      badgeEl.textContent = label;
      badgeEl.style.display = "inline-flex";
    } else {
      badgeEl.style.display = "none";
      badgeEl.textContent = "";
    }
  }
  elements.ProjectsContextBtn.title = state.title;
}

function openProjectsContextModal(thread, project, deps) {
  if (!thread) return;
  const overlay = document.createElement("div");
  overlay.className = "projects-context-overlay";
  const modal = document.createElement("div");
  modal.className = "projects-context-modal";
  setSafeHtml(modal, deps.buildProjectsContextModalHtml({
    thread,
    project,
    maxContextMessages: deps.maxContextMessages,
    truncateText: deps.truncateText,
    escapeHtml: deps.escapeHtml
  }));
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const closeBtn = modal.querySelector(".projects-context-close");
  closeBtn?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  const archiveToggle = modal.querySelector(".projects-context-archive-toggle");
  const archiveContent = modal.querySelector(".projects-context-archive-content");
  if (archiveToggle && archiveContent) {
    archiveToggle.addEventListener("click", () => {
      const isOpen = archiveContent.classList.toggle("open");
      const indicator = archiveToggle.querySelector("span:last-child");
      if (indicator) {
        indicator.textContent = isOpen ? "−" : "+";
      }
    });
  }
}

const projectsUiControllerUtils = {
  PROJECT_EMOJIS,
  normalizeImageCacheLimitMb,
  getProjectModelLabel,
  updateChatModelIndicator,
  setChatImageToggleState,
  applyProjectImageMode,
  loadProviderSetting,
  updateProjectsContextButton,
  openProjectsContextModal
};

if (typeof window !== "undefined") {
  window.projectsUiControllerUtils = projectsUiControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsUiControllerUtils;
}

