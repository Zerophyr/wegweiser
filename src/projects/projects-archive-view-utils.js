// projects-archive-view-utils.js - Helpers for archived message section rendering and toggle behavior

function buildHtmlNodes(html) {
  const safeHtml = typeof html === "string" ? html : "";
  if (typeof document === "undefined") return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    return Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  }
  return [document.createTextNode(safeHtml)];
}

function setSafeHtml(element, html) {
  if (!element) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.replaceChildren(...buildHtmlNodes(html));
}

function buildArchiveSectionHtml(archivedMessages) {
  const list = Array.isArray(archivedMessages) ? archivedMessages : [];
  if (list.length === 0) return "";
  return `
      <div class="chat-archive-block" data-archive-open="false">
        <button class="chat-archive-toggle" type="button" aria-expanded="false">
          Earlier messages (${list.length})
        </button>
        <div class="chat-archive-content"></div>
      </div>
    `;
}

function toggleArchiveSectionInContainer({
  chatMessagesEl,
  currentArchivedMessages,
  buildMessageHtml,
  postProcessMessages
} = {}) {
  if (!chatMessagesEl) return;
  const archiveBlock = chatMessagesEl.querySelector(".chat-archive-block");
  if (!archiveBlock) return;
  const contentEl = archiveBlock.querySelector(".chat-archive-content");
  if (!contentEl) return;
  const toggleBtn = archiveBlock.querySelector(".chat-archive-toggle");
  const isOpen = archiveBlock.getAttribute("data-archive-open") === "true";

  if (isOpen) {
    contentEl.replaceChildren();
    archiveBlock.setAttribute("data-archive-open", "false");
    archiveBlock.classList.remove("open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
    return;
  }

  const render = typeof buildMessageHtml === "function"
    ? buildMessageHtml
    : () => "";
  const archivedHtml = render(currentArchivedMessages);
  setSafeHtml(contentEl, archivedHtml || '<div class="chat-archive-empty">No archived messages.</div>');
  archiveBlock.setAttribute("data-archive-open", "true");
  archiveBlock.classList.add("open");
  if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
  if (typeof postProcessMessages === "function") {
    postProcessMessages(contentEl);
  }
}

const projectsArchiveViewUtils = {
  buildArchiveSectionHtml,
  toggleArchiveSectionInContainer
};

if (typeof window !== "undefined") {
  window.projectsArchiveViewUtils = projectsArchiveViewUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsArchiveViewUtils;
}
