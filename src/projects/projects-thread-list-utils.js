// projects-thread-list-utils.js - HTML builders for Projects thread list

function buildEmptyThreadListHtml() {
  return '<p class="text-muted" style="text-align: center; padding: 20px;">No threads yet</p>';
}

function buildThreadListHtml(threads, currentThreadId, escapeHtmlFn, formatRelativeTimeFn) {
  const list = Array.isArray(threads) ? threads : [];
  const escape = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (value) => String(value || "");
  const formatTime = typeof formatRelativeTimeFn === "function" ? formatRelativeTimeFn : (() => "");
  return list.map((thread) => `
    <div class="thread-item ${thread.id === currentThreadId ? "active" : ""}" data-thread-id="${thread.id}">
      <h4 class="thread-title">${escape(thread.title)}</h4>
      <span class="thread-time">${formatTime(thread.updatedAt)}</span>
      <div class="thread-menu menu-dropdown">
        <button class="menu-btn" data-action="toggle-menu">&#8942;</button>
        <div class="menu-items" style="display: none;">
          <button class="menu-item" data-action="rename" data-thread-id="${thread.id}">Rename</button>
          <div class="menu-item-submenu">
            <button class="menu-item" data-action="export-parent">&#9666; Export</button>
            <div class="submenu-items">
              <button class="menu-item" data-action="export" data-thread-id="${thread.id}" data-format="md">Markdown</button>
              <button class="menu-item" data-action="export" data-thread-id="${thread.id}" data-format="pdf">PDF</button>
              <button class="menu-item" data-action="export" data-thread-id="${thread.id}" data-format="docx">DOCX</button>
            </div>
          </div>
          <button class="menu-item danger" data-action="delete-thread" data-thread-id="${thread.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join("");
}

const projectsThreadListUtils = {
  buildEmptyThreadListHtml,
  buildThreadListHtml
};

if (typeof window !== "undefined") {
  window.projectsThreadListUtils = projectsThreadListUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsThreadListUtils;
}
