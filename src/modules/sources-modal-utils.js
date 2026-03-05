// sources-modal-utils.js - Sources modal renderer

function showSourcesModal(sources, uniqueDomains, highlightId = null) {
  const existing = document.getElementById("sources-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "sources-modal";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: var(--color-bg, #0f0f0f);
    border: 1px solid var(--color-border, #27272a);
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border, #27272a);
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const title = document.createElement("h3");
  title.textContent = `Sources (${sources.length})`;
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text, #e4e4e7);
  `;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: var(--color-text-muted, #71717a);
    font-size: 28px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = "var(--color-bg-secondary, #18181b)";
    closeBtn.style.color = "var(--color-text, #e4e4e7)";
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "var(--color-text-muted, #71717a)";
  };
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = document.createElement("div");
  body.id = "sources-modal-body";
  body.style.cssText = `
    padding: 16px 24px;
    overflow-y: auto;
    flex: 1;
  `;

  uniqueDomains.forEach((domainGroup, index) => {
    const domainHeader = document.createElement("div");
    domainHeader.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      ${index > 0 ? "margin-top: 20px;" : ""}
    `;

    const favicon = document.createElement("img");
    favicon.src = domainGroup.favicon;
    favicon.alt = domainGroup.domain;
    favicon.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid var(--color-border, #27272a);
      background: white;
    `;
    favicon.onerror = () => {
      favicon.style.display = "none";
    };

    const domainName = document.createElement("span");
    domainName.textContent = domainGroup.domain;
    domainName.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-secondary, #d4d4d8);
    `;

    const sourceCount = document.createElement("span");
    sourceCount.textContent = `(${domainGroup.sources.length})`;
    sourceCount.style.cssText = `
      font-size: 12px;
      color: var(--color-text-muted, #71717a);
    `;

    domainHeader.appendChild(favicon);
    domainHeader.appendChild(domainName);
    domainHeader.appendChild(sourceCount);
    body.appendChild(domainHeader);

    domainGroup.sources.forEach((source) => {
      const sourceItem = document.createElement("div");
      sourceItem.id = source.id;
      sourceItem.className = "source-item";
      sourceItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        margin-bottom: 6px;
        margin-left: 30px;
        background: var(--color-bg-secondary, #18181b);
        border: 1px solid var(--color-border, #27272a);
        border-radius: 6px;
        transition: all 0.3s ease;
      `;

      const numberBadge = document.createElement("span");
      numberBadge.textContent = source.number;
      numberBadge.style.cssText = `
        flex-shrink: 0;
        min-width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary, #3b82f6);
        color: white;
        font-size: 13px;
        font-weight: 700;
        border-radius: 4px;
        font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      `;
      sourceItem.appendChild(numberBadge);

      const sourceLink = document.createElement("a");
      sourceLink.href = source.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = source.title;
      sourceLink.style.cssText = `
        flex: 1;
        color: var(--color-primary, #3b82f6);
        text-decoration: none;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      sourceLink.onmouseenter = () => {
        sourceLink.style.textDecoration = "underline";
      };
      sourceLink.onmouseleave = () => {
        sourceLink.style.textDecoration = "none";
      };
      sourceItem.appendChild(sourceLink);

      sourceItem.addEventListener("mouseenter", () => {
        sourceItem.style.background = "var(--color-bg-tertiary, #27272a)";
        sourceItem.style.borderColor = "var(--color-primary, #3b82f6)";
      });
      sourceItem.addEventListener("mouseleave", () => {
        if (source.id !== highlightId) {
          sourceItem.style.background = "var(--color-bg-secondary, #18181b)";
          sourceItem.style.borderColor = "var(--color-border, #27272a)";
        }
      });

      body.appendChild(sourceItem);
    });
  });

  modal.appendChild(body);
  overlay.appendChild(modal);

  if (!document.getElementById("sources-modal-animations")) {
    const style = document.createElement("style");
    style.id = "sources-modal-animations";
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes highlight {
        0%, 100% { background: var(--color-bg-tertiary, #27272a); }
        50% { background: var(--color-primary, #3b82f6); }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);

  document.body.appendChild(overlay);

  if (highlightId) {
    setTimeout(() => {
      const sourceElement = document.getElementById(highlightId);
      if (sourceElement) {
        sourceElement.scrollIntoView({ behavior: "smooth", block: "center" });
        sourceElement.style.background = "var(--color-bg-tertiary, #27272a)";
        sourceElement.style.borderColor = "var(--color-primary, #3b82f6)";
        sourceElement.style.animation = "highlight 1s ease-in-out";

        setTimeout(() => {
          sourceElement.style.animation = "";
        }, 1000);
      }
    }, 100);
  }
}

const sourcesModalUtils = {
  showSourcesModal
};

if (typeof window !== "undefined") {
  window.sourcesModalUtils = sourcesModalUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.sourcesModalUtils = sourcesModalUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sourcesModalUtils;
}
