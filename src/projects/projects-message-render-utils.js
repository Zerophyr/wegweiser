// projects-message-render-utils.js - HTML rendering helpers for Projects chat messages

function buildProjectsMessageHtml(messages, deps = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const escapeHtml = typeof deps.escapeHtml === "function" ? deps.escapeHtml : (v) => String(v || "");
  const applyMarkdownStyles = typeof deps.applyMarkdownStyles === "function" ? deps.applyMarkdownStyles : (v) => escapeHtml(v || "");
  const extractSources = typeof deps.extractSources === "function" ? deps.extractSources : null;
  const getTokenBarStyle = typeof deps.getTokenBarStyle === "function" ? deps.getTokenBarStyle : null;

  return safeMessages.map((msg, index) => {
    if (msg.role === "assistant") {
      if (msg.meta?.imageId) {
        const meta = msg.meta || null;
        const metaTime = meta?.createdAt ? new Date(meta.createdAt).toLocaleTimeString() : "";
        const metaModel = meta?.model || "default model";
        const metaText = meta ? `${metaTime} - ${metaModel}` : "";
        const metaHtml = meta
          ? `<div class="chat-meta"><span class="chat-meta-text">${escapeHtml(metaText)}</span></div>`
          : "";

        return `
          <div class="chat-message chat-message-assistant image-message" data-image-id="${escapeHtml(msg.meta.imageId)}" data-msg-index="${index}">
            <div class="chat-bubble-wrapper">
              ${metaHtml}
              <div class="chat-bubble">
                <div class="chat-content"></div>
              </div>
            </div>
          </div>
        `;
      }

      const extracted = extractSources
        ? extractSources(msg.content)
        : { sources: [], cleanText: msg.content };
      const sources = extracted?.sources || [];
      const cleanText = extracted?.cleanText || msg.content || "";

      const meta = msg.meta || null;
      const metaTime = meta?.createdAt ? new Date(meta.createdAt).toLocaleTimeString() : "";
      const metaModel = meta?.model || "default model";
      const metaText = meta ? `${metaTime} - ${metaModel}` : "";
      const metaHtml = meta
        ? `<div class="chat-meta"><span class="chat-meta-text">${escapeHtml(metaText)}</span></div>`
        : "";

      let footerHtml = "";
      if (meta) {
        const responseTime = typeof meta.responseTimeSec === "number"
          ? `${meta.responseTimeSec.toFixed(2)}s`
          : "--s";
        const tokensText = meta.tokens ? `${meta.tokens} tokens` : "-- tokens";
        const contextBadge = meta.contextSize > 2
          ? `<span class="chat-context-badge" title="${meta.contextSize} messages in conversation context">🧠 ${Math.floor(meta.contextSize / 2)} Q&A</span>`
          : "";
        const tokenStyle = getTokenBarStyle
          ? getTokenBarStyle(meta.tokens || null)
          : { percent: 0, gradient: "linear-gradient(90deg, var(--color-success), #16a34a)" };

        footerHtml = `
          <div class="chat-footer">
            <div class="chat-stats">
              <span class="chat-time">${responseTime}</span>
              <span class="chat-tokens">${escapeHtml(tokensText)}</span>
              ${contextBadge}
            </div>
            <div class="token-usage-bar" role="progressbar" aria-valuenow="${tokenStyle.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Token usage">
              <div class="token-usage-fill" style="width: ${tokenStyle.percent}%; background: ${tokenStyle.gradient};"></div>
            </div>
          </div>
        `;
      }

      return `
        <div class="chat-message chat-message-assistant" data-msg-index="${index}">
          <div class="chat-bubble-wrapper">
            ${metaHtml}
            <div class="chat-bubble">
              <div class="chat-content" data-sources='${JSON.stringify(sources)}'>${applyMarkdownStyles(cleanText)}</div>
              ${footerHtml}
              <div class="chat-actions">
                <div class="chat-actions-left">
                  <button class="action-btn chat-copy-btn" title="Copy answer" aria-label="Copy answer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  </button>
                  <div class="export-menu">
                    <button class="action-btn export-btn" title="Export" aria-label="Export" aria-haspopup="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/>
                      </svg>
                    </button>
                    <div class="export-menu-items">
                      <button class="export-option" data-format="pdf">Export PDF</button>
                      <button class="export-option" data-format="markdown">Export Markdown</button>
                      <button class="export-option" data-format="docx">Export DOCX</button>
                    </div>
                  </div>
                </div>
                <div class="chat-sources-summary"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="chat-message chat-message-user">
        <div class="chat-bubble">${escapeHtml(msg.content)}</div>
      </div>
    `;
  }).join("");
}

const projectsMessageRenderUtils = {
  buildProjectsMessageHtml
};

if (typeof window !== "undefined") {
  window.projectsMessageRenderUtils = projectsMessageRenderUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsMessageRenderUtils;
}
