// projects-cards-utils.js - HTML builders for project cards grid

function buildProjectCardHtml(project, modelName, dateStr, escapeHtmlFn) {
  const p = project || {};
  const escape = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (v) => String(v || "");
  const icon = p.icon || "📁";
  return `
      <div class="project-card" data-project-id="${p.id}">
        <div class="project-card-icon">${icon}</div>
        <div class="project-card-menu menu-dropdown">
          <button class="menu-btn" data-action="toggle-menu">&#8942;</button>
          <div class="menu-items" style="display: none;">
            <button class="menu-item" data-action="edit" data-project-id="${p.id}">Edit</button>
            <button class="menu-item danger" data-action="delete" data-project-id="${p.id}">Delete</button>
          </div>
        </div>
        <div class="project-card-content">
          <div class="project-card-info">
            <h3 class="project-card-name">${escape(p.name)}</h3>
          </div>
          <div class="project-card-footer">
            <span class="project-card-date">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
              ${dateStr}
            </span>
            <span class="project-card-model">${escape(modelName)}</span>
          </div>
        </div>
      </div>
    `;
}

const projectsCardsUtils = {
  buildProjectCardHtml
};

if (typeof window !== "undefined") {
  window.projectsCardsUtils = projectsCardsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsCardsUtils;
}
