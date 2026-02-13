export {};

const { resolveSidepanelModule } = require("../src/sidepanel/sidepanel-module-resolver.js");

describe("sidepanel module resolver", () => {
  test("returns window module when available", () => {
    (window as any).demoSidepanel = { ok: true };
    const mod = resolveSidepanelModule("demoSidepanel", "./x.js", () => {
      throw new Error("should not load");
    });
    expect(mod).toEqual({ ok: true });
    delete (window as any).demoSidepanel;
  });

  test("uses loader when window module missing", () => {
    const mod = resolveSidepanelModule("missingSidepanel", "./x.js", (p: string) => ({ path: p }));
    expect(mod).toEqual({ path: "./x.js" });
  });
});
