export {};

const { resolveProjectsModule } = require("../src/projects/projects-module-resolver.js");

describe("projects module resolver", () => {
  test("prefers window module when present", () => {
    (window as any).demoModule = { ok: true };
    const mod = resolveProjectsModule("demoModule", "./does-not-matter.js", () => {
      throw new Error("should not require");
    });
    expect(mod).toEqual({ ok: true });
    delete (window as any).demoModule;
  });

  test("falls back to require loader when window module missing", () => {
    delete (window as any).missing;
    const mod = resolveProjectsModule("missing", "./virtual.js", (path: string) => ({ loaded: path }));
    expect(mod).toEqual({ loaded: "./virtual.js" });
  });

  test("returns empty object when require fails", () => {
    delete (window as any).missing;
    const mod = resolveProjectsModule("missing", "./missing.js", () => {
      throw new Error("not found");
    });
    expect(mod).toEqual({});
  });
});
