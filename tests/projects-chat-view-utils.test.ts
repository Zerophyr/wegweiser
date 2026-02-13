export {};

const {
  shouldShowSummaryBadge,
  buildChatMessagesContainerHtml
} = require("../src/projects/projects-chat-view-utils.js");

describe("projects chat view utils", () => {
  test("shouldShowSummaryBadge returns true only within freshness window", () => {
    const now = 100_000;
    expect(shouldShowSummaryBadge(now - 10_000, now, 30_000)).toBe(true);
    expect(shouldShowSummaryBadge(now - 31_000, now, 30_000)).toBe(false);
    expect(shouldShowSummaryBadge(null, now, 30_000)).toBe(false);
  });

  test("buildChatMessagesContainerHtml stitches archive + badge + messages html", () => {
    const html = buildChatMessagesContainerHtml({
      archiveHtml: "<div>archive</div>",
      showSummaryBadge: true,
      messagesHtml: "<div>messages</div>"
    });

    expect(html).toContain("archive");
    expect(html).toContain("chat-summary-badge");
    expect(html).toContain("messages");
  });
});
