export {};

describe("projects migration", () => {
  test("migrates legacy space keys to project keys", async () => {
    const globalAny = global as any;
    globalAny.chrome.storage.local.get.mockResolvedValue({
      or_spaces: [{ id: "s1", name: "Legacy Space" }],
      or_threads: { s1: [{ id: "t1" }] }
    });

    const { migrateLegacySpaceKeys } = require("../src/shared/projects-migration.js");
    const result = await migrateLegacySpaceKeys();

    expect(result.migrated).toBe(true);
    expect(globalAny.chrome.storage.local.set).toHaveBeenCalledWith({
      or_projects: [{ id: "s1", name: "Legacy Space" }],
      or_project_threads: { s1: [{ id: "t1" }] }
    });
  });
});
