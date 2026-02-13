export {};

const {
  buildEmojiButtonsHtml,
  shouldCloseEmojiGridOnDocumentClick
} = require("../src/projects/projects-emoji-utils.js");

describe("projects emoji utils", () => {
  test("buildEmojiButtonsHtml renders emoji buttons", () => {
    const html = buildEmojiButtonsHtml(["😀", "🚀"]);
    expect(html).toContain('data-emoji="😀"');
    expect(html).toContain('data-emoji="🚀"');
    expect((html.match(/class="emoji-btn"/g) || []).length).toBe(2);
  });

  test("shouldCloseEmojiGridOnDocumentClick detects outside wrapper clicks", () => {
    document.body.innerHTML = `
      <div class="icon-picker-wrapper" id="wrapper">
        <button id="inside"></button>
      </div>
      <button id="outside"></button>
    `;
    const inside = document.getElementById("inside");
    const outside = document.getElementById("outside");
    expect(shouldCloseEmojiGridOnDocumentClick(inside)).toBe(false);
    expect(shouldCloseEmojiGridOnDocumentClick(outside)).toBe(true);
  });
});
