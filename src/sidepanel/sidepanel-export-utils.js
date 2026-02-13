// sidepanel-export-utils.js - export menu/payload helpers for sidepanel answers

function closeExportMenus(rootDocument) {
  const doc = rootDocument || document;
  doc.querySelectorAll(".export-menu").forEach((menu) => menu.classList.remove("open"));
}

function getExportPayload(answerItem) {
  const answerContent = answerItem?.querySelector?.(".answer-content");
  const text = answerContent?.innerText || answerContent?.textContent || "";
  const html = answerContent?.innerHTML || "";
  return { text, html, messages: [{ role: "assistant", content: text }] };
}

const sidepanelExportUtils = {
  closeExportMenus,
  getExportPayload
};

if (typeof window !== "undefined") {
  window.sidepanelExportUtils = sidepanelExportUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelExportUtils;
}
