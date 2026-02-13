export {};
const { sanitizeHtml, setSanitizedHtml, appendSanitizedHtml } = require("../src/modules/safe-html.js");

describe("safe-html", () => {
  test("sanitizeHtml strips scripts and event handlers when DOMPurify exists", () => {
    (global as any).DOMPurify = {
      sanitize: jest.fn((html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/onerror=\"[^\"]*\"/gi, ""))
    };

    const dirty = '<img src="x" onerror="alert(1)"><script>alert(1)</script>';
    const clean = sanitizeHtml(dirty);

    expect(clean).toContain('<img src="x" >');
    expect(clean).not.toContain('<script');
    expect((global as any).DOMPurify.sanitize).toHaveBeenCalled();
    delete (global as any).DOMPurify;
  });

  test("setSanitizedHtml is no-op for missing element", () => {
    expect(() => setSanitizedHtml(null, "<b>x</b>")).not.toThrow();
  });

  test("appendSanitizedHtml appends sanitized content", () => {
    const el = document.createElement("div");
    (global as any).DOMPurify = { sanitize: jest.fn((html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, "")) };

    appendSanitizedHtml(el, "<span>ok</span><script>bad()</script>");

    expect(el.innerHTML).toContain("<span>ok</span>");
    expect(el.innerHTML).not.toContain("<script>");
    delete (global as any).DOMPurify;
  });
});
