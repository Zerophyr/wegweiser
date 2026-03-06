export {};

const { exportPdf } = require("../src/modules/exporter.js");

describe("exporter", () => {
  test("exportPdf sanitizes htmlString before document.write", () => {
    const write = jest.fn();
    const fakeWin: any = {
      document: {
        write,
        close: jest.fn()
      },
      focus: jest.fn(),
      print: jest.fn()
    };

    (global as any).window.open = jest.fn(() => fakeWin);
    (global as any).window.safeHtml = {
      sanitizeHtml: jest.fn((value: string) => value.replace(/<script[\s\S]*?<\/script>/gi, ""))
    };

    exportPdf('<h2>ok</h2><script>alert(1)</script>', 'x"><script>alert(2)</script>');

    expect(write).toHaveBeenCalledTimes(1);
    const written = write.mock.calls[0][0];
    expect(written).toContain('<h2>ok</h2>');
    expect(written).not.toContain('<script>alert(1)</script>');
    expect(written).not.toContain('x"><script>alert(2)</script>');
  });
});
