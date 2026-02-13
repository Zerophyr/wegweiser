// options-history-utils.js - Export formatting helpers for prompt history

function buildHistoryJson(history) {
  const list = Array.isArray(history) ? history : [];
  return JSON.stringify(list, null, 2);
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildHistoryCsv(history) {
  const list = Array.isArray(history) ? history : [];
  const rows = ["timestamp,prompt,answer"];
  list.forEach((item) => {
    const timestamp = new Date(item.createdAt).toISOString();
    const prompt = escapeCsv(item.prompt || "");
    const answer = escapeCsv(item.answer || "");
    rows.push(`${escapeCsv(timestamp)},${prompt},${answer}`);
  });
  return rows.join("\n");
}

const optionsHistoryUtils = {
  buildHistoryJson,
  buildHistoryCsv
};

if (typeof window !== "undefined") {
  window.optionsHistoryUtils = optionsHistoryUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = optionsHistoryUtils;
}
