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

function exportPdf(htmlString, filename) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename || 'thread'}</title>
    <style>body{font-family:Arial,sans-serif;color:#111;padding:24px;} h2{margin-top:24px;} pre{white-space:pre-wrap;}</style>
  </head><body>${htmlString}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exportMarkdown,
    exportMarkdownFile,
    exportDocx,
    exportPdf
  };
}
