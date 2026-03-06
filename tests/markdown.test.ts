export {};
const { applyMarkdownStyles, markdownToHtml } = require("../src/modules/markdown");

describe("topic headings", () => {
  test("headings get topic classes", () => {
    (global as any).DOMPurify = { sanitize: (value: string) => value };
    const html = applyMarkdownStyles("# Topic One\n\n## Topic Two");
    expect(html).toContain("topic-heading");
    delete (global as any).DOMPurify;
  });
});

describe("markdown sanitization fallback", () => {
  test("fails closed when no sanitizer is available", () => {
    delete (global as any).DOMPurify;
    const previousSafeHtml = (global as any).window?.safeHtml;
    if ((global as any).window) {
      delete (global as any).window.safeHtml;
    }

    const html = markdownToHtml('# Hi\n\n<script>alert(1)</script>');

    expect(html).toContain('script');
    expect(html).toContain('&amp;lt;script&amp;gt;');
    expect(html).not.toContain('<script>');

    if ((global as any).window) {
      (global as any).window.safeHtml = previousSafeHtml;
    }
  });
});
