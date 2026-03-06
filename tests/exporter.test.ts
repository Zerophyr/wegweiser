export {};

const { exportPdf } = require("../src/modules/exporter.js");

describe("exporter", () => {
  test("exportPdf sanitizes output and avoids document.write", () => {
    jest.useFakeTimers();

    const createObjectURL = jest.fn(() => "blob:test-url");
    const revokeObjectURL = jest.fn();
    const open = jest.fn();
    let loadHandler: any = null;
    const fakeWin: any = {
      addEventListener: jest.fn((event: string, cb: () => void) => {
        if (event === "load") loadHandler = cb;
      }),
      focus: jest.fn(),
      print: jest.fn(),
      document: {
        write: jest.fn()
      }
    };

    open.mockReturnValue(fakeWin);

    (global as any).URL.createObjectURL = createObjectURL;
    (global as any).URL.revokeObjectURL = revokeObjectURL;
    (global as any).window.open = open;
    (global as any).window.safeHtml = {
      sanitizeHtml: jest.fn((value: string, config?: any) => {
        if (config && Array.isArray(config.ALLOWED_TAGS) && config.ALLOWED_TAGS.length === 0) {
          return value.replace(/<[^>]*>/g, "");
        }
        return value.replace(/<script[\s\S]*?<\/script>/gi, "");
      })
    };

    exportPdf('<h2>ok</h2><script>alert(1)</script>', 'x"><script>alert(2)</script>');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobCalls = (createObjectURL as any).mock.calls;
    const blobArg = blobCalls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(open).toHaveBeenCalledWith("blob:test-url", "_blank");
    expect(fakeWin.document.write).not.toHaveBeenCalled();

    expect(loadHandler).toBeTruthy();
    (loadHandler as any)?.();

    expect(fakeWin.focus).toHaveBeenCalledTimes(1);
    expect(fakeWin.print).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(3000);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    expect(fakeWin.print).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
