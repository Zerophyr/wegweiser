// projects-chat-click-utils.js - Resolves click intent in Projects chat message area

function resolveChatMessageClickAction(target) {
  if (target?.closest?.(".chat-archive-toggle")) {
    return { type: "archive-toggle" };
  }

  const exportBtn = target?.closest?.(".export-btn");
  if (exportBtn) {
    return { type: "export-menu-toggle", menu: exportBtn.closest(".export-menu") };
  }

  const exportOption = target?.closest?.(".export-option");
  if (exportOption) {
    return { type: "export-option", format: exportOption.getAttribute("data-format") };
  }

  return { type: "none" };
}

const projectsChatClickUtils = {
  resolveChatMessageClickAction
};

if (typeof window !== "undefined") {
  window.projectsChatClickUtils = projectsChatClickUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsChatClickUtils;
}
