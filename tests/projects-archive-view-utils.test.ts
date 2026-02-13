export {};

const {
  buildArchiveSectionHtml,
  toggleArchiveSectionInContainer
} = require("../src/projects/projects-archive-view-utils.js");

describe("projects archive view utils", () => {
  test("buildArchiveSectionHtml renders toggle block when archived messages exist", () => {
    const html = buildArchiveSectionHtml([{ role: "user", content: "old" }]);
    expect(html).toContain("chat-archive-block");
    expect(html).toContain("Earlier messages (1)");
  });

  test("toggleArchiveSectionInContainer opens and closes archive content", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="chat-archive-block" data-archive-open="false">
        <button class="chat-archive-toggle" type="button" aria-expanded="false"></button>
        <div class="chat-archive-content"></div>
      </div>
    `;

    toggleArchiveSectionInContainer({
      chatMessagesEl: root,
      currentArchivedMessages: [{ role: "assistant", content: "A" }],
      buildMessageHtml: () => "<div class='msg'>A</div>",
      postProcessMessages: () => {}
    });

    const block = root.querySelector(".chat-archive-block");
    const content = root.querySelector(".chat-archive-content");
    expect(block?.getAttribute("data-archive-open")).toBe("true");
    expect(content?.innerHTML).toContain("msg");

    toggleArchiveSectionInContainer({
      chatMessagesEl: root,
      currentArchivedMessages: [{ role: "assistant", content: "A" }],
      buildMessageHtml: () => "<div class='msg'>A</div>",
      postProcessMessages: () => {}
    });

    expect(block?.getAttribute("data-archive-open")).toBe("false");
    expect(content?.innerHTML).toBe("");
  });
});
