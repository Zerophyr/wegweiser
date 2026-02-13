// options-history-view-utils.js - template helpers for prompt history rendering

function buildHistoryPreviewHtml(item, timestamp, escapeHtmlFn) {
  const escape = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (v) => String(v || "");
  const promptPreview = String(item?.prompt || "").length > 80
    ? `${String(item.prompt).slice(0, 80)}...`
    : String(item?.prompt || "");
  return `
      <div class="history-preview">
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px;">${timestamp}</div>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 600;">Prompt:</div>
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; white-space: pre-wrap;">${escape(promptPreview)}</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Click to view full context</div>
      </div>
    `;
}

function buildHistoryDetailHtml(item, timestamp, escapeHtmlFn) {
  const escape = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (v) => String(v || "");
  return `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 12px;">${timestamp}</div>
      <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 600;">Prompt</div>
      <div style="font-size: 13px; color: var(--color-text); margin-bottom: 16px; white-space: pre-wrap; background: var(--color-bg); padding: 16px; border-radius: 8px; line-height: 1.6;">${escape(item.prompt)}</div>
      <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 600;">Answer</div>
      <div style="font-size: 13px; color: var(--color-text); margin-bottom: 20px; white-space: pre-wrap; background: var(--color-bg); padding: 16px; border-radius: 8px; line-height: 1.6; max-height: 400px; overflow-y: auto;">${escape(item.answer || "No answer available")}</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="detail-copy-prompt-btn" style="padding: 8px 16px; background: var(--color-primary); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Prompt</button>
        <button class="detail-copy-answer-btn" style="padding: 8px 16px; background: var(--color-accent); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Copy Answer</button>
        <button class="detail-delete-btn" style="padding: 8px 16px; background: var(--color-error); color: var(--color-text-on-primary); border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;">Delete</button>
      </div>
    </div>
  `;
}

const optionsHistoryViewUtils = {
  buildHistoryPreviewHtml,
  buildHistoryDetailHtml
};

if (typeof window !== "undefined") {
  window.optionsHistoryViewUtils = optionsHistoryViewUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsHistoryViewUtils;
}
