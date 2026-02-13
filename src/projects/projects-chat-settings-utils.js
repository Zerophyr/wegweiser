// projects-chat-settings-utils.js - Applies project chat settings to UI elements

function applyProjectChatSettingsToElements(project, elements, applyProjectImageModeFn) {
  if (!project || !elements) return;
  if (elements.chatWebSearch) {
    elements.chatWebSearch.checked = Boolean(project.webSearch);
  }
  if (elements.chatReasoning) {
    elements.chatReasoning.checked = Boolean(project.reasoning);
  }
  if (typeof applyProjectImageModeFn === "function") {
    applyProjectImageModeFn(project);
  }
}

const projectsChatSettingsUtils = {
  applyProjectChatSettingsToElements
};

if (typeof window !== "undefined") {
  window.projectsChatSettingsUtils = projectsChatSettingsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsChatSettingsUtils;
}
