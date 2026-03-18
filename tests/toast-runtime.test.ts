export {};
/**
 * @jest-environment jsdom
 */

describe("toast runtime", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    delete (global as any).safeHtml;
    delete (window as any).safeHtml;
  });

  test("resolves safeHtml at call time when loaded after the toast module", () => {
    let toastModule: any;
    jest.isolateModules(() => {
      toastModule = require("../src/modules/toast.js");
    });

    const setSanitizedHtml = jest.fn((element: HTMLElement, html: string) => {
      element.innerHTML = html;
    });
    (global as any).safeHtml = { setSanitizedHtml };
    (window as any).safeHtml = { setSanitizedHtml };

    const toastEl = toastModule.showToast("Late helper", "info", 0);

    expect(setSanitizedHtml).toHaveBeenCalled();
    expect(toastEl.querySelector(".toast-close")).not.toBeNull();
    expect(toastEl.textContent).toContain("Late helper");
  });
});
