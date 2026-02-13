export {};
const {
  buildEmptyThreadListHtml,
  buildThreadListHtml
} = require("../src/projects/projects-thread-list-utils.js");

describe("projects thread list utils", () => {
  test("builds empty state html", () => {
    expect(buildEmptyThreadListHtml()).toContain("No threads yet");
  });

  test("builds thread list html with active item", () => {
    const html = buildThreadListHtml(
      [
        { id: "t1", title: "First", updatedAt: 123 },
        { id: "t2", title: "Second", updatedAt: 456 }
      ],
      "t2",
      (v: string) => v,
      () => "now"
    );
    expect(html).toContain('data-thread-id="t1"');
    expect(html).toContain('data-thread-id="t2"');
    expect(html).toContain("thread-item active");
  });
});
