// exporter.js - Export helpers for threads

function escapeHtmlForExport(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function exportMarkdown(messages) {
  const header = '# Thread Export\n\n';
  const body = (messages || []).map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    return `## ${role}\n\n${msg.content || ''}`;
  }).join('\n\n');
  return header + body + '\n';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportMarkdownFile(messages, filename) {
  const md = exportMarkdown(messages);
  const blob = new Blob([md], { type: 'text/markdown' });
  downloadBlob(blob, filename || 'thread.md');
}

function exportDocx(messages, filename) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${(messages || [])
    .map((msg) => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      return `<h2>${role}</h2><p>${escapeHtmlForExport(msg.content || '')}</p>`;
    })
    .join('')
  }</body></html>`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  downloadBlob(blob, filename || 'thread.docx');
}

function sanitizeExportHtml(htmlString) {
  const value = typeof htmlString === 'string' ? htmlString : '';
  if (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.sanitizeHtml === 'function') {
    return window.safeHtml.sanitizeHtml(value);
  }
  if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(value);
  }
  return escapeHtmlForExport(value);
}

function sanitizeExportTitle(title) {
  const value = typeof title === 'string' ? title : '';
  if (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.sanitizeHtml === 'function') {
    const cleaned = window.safeHtml.sanitizeHtml(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return escapeHtmlForExport(cleaned.replace(/<[^>]*>/g, ''));
  }
  if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
    const cleaned = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return escapeHtmlForExport(cleaned.replace(/<[^>]*>/g, ''));
  }
  return escapeHtmlForExport(value);
}

function exportPdf(htmlString, filename) {
  const safeTitle = sanitizeExportTitle(filename || 'thread');
  const safeHtml = sanitizeExportHtml(htmlString);
  const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
    <style>body{font-family:Arial,sans-serif;color:#111;padding:24px;} h2{margin-top:24px;} pre{white-space:pre-wrap;}</style>
  </head><body>${safeHtml}</body></html>`;

  const blob = new Blob([htmlDoc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return;
  }

  let finished = false;
  const finalize = () => {
    if (finished) return;
    finished = true;
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const printWindow = () => {
    if (finished) return;
    try {
      win.focus();
      win.print();
    } finally {
      finalize();
    }
  };

  if (typeof win.addEventListener === 'function') {
    win.addEventListener('load', printWindow, { once: true });
  }
  setTimeout(printWindow, 1200);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exportMarkdown,
    exportMarkdownFile,
    exportDocx,
    exportPdf
  };
}
