// projects-emoji-utils.js - Emoji picker helpers for Projects modal

function buildEmojiButtonsHtml(emojis) {
  const list = Array.isArray(emojis) ? emojis : [];
  return list.map((emoji) => (
    `<button type="button" class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`
  )).join("");
}

function shouldCloseEmojiGridOnDocumentClick(target) {
  return !target?.closest?.(".icon-picker-wrapper");
}

const projectsEmojiUtils = {
  buildEmojiButtonsHtml,
  shouldCloseEmojiGridOnDocumentClick
};

if (typeof window !== "undefined") {
  window.projectsEmojiUtils = projectsEmojiUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsEmojiUtils;
}
