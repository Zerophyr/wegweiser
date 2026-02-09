export {};

describe("projects migration", () => {
  test("migrates legacy space keys to project keys", async () => {
    const globalAny = global as any;
    delete globalAny.getEncrypted;
    delete globalAny.setEncrypted;
    globalAny.chrome.storage.local.remove = jest.fn();
    globalAny.chrome.storage.local.get.mockResolvedValue({
      or_spaces: [{ id: "s1", name: "Legacy Space" }],
      or_threads: { s1: [{ id: "t1" }] }
    });

    const { migrateLegacySpaceKeys } = require("../src/shared/projects-migration.js");
    const result = await migrateLegacySpaceKeys();

    expect(result.migrated).toBe(true);
    expect(globalAny.chrome.storage.local.set).toHaveBeenCalledWith({
      or_projects: [{ id: "s1", name: "Legacy Space" }],
      or_project_threads: [{ id: "t1", projectId: "s1" }]
    });
    expect(globalAny.chrome.storage.local.remove).toHaveBeenCalledWith([
      "or_spaces",
      "or_threads",
      "or_collapse_on_spaces"
    ]);
  });

  test("merges legacy data when project keys already exist", async () => {
    const globalAny = global as any;
    delete globalAny.getEncrypted;
    delete globalAny.setEncrypted;
    globalAny.chrome.storage.local.remove = jest.fn();
    globalAny.chrome.storage.local.get.mockResolvedValue({
      or_projects: [{ id: "p1", name: "Existing Project" }],
      or_spaces: [{ id: "s1", name: "Legacy Space" }],
      or_threads: {
        s1: [{ id: "t1", ProjectId: "s1", title: "Legacy Thread" }]
      }
    });

    const { migrateLegacySpaceKeys } = require("../src/shared/projects-migration.js");
    const result = await migrateLegacySpaceKeys();

    expect(result.migrated).toBe(true);
    expect(globalAny.chrome.storage.local.set).toHaveBeenCalledWith({
      or_projects: expect.arrayContaining([
        expect.objectContaining({ id: "p1", name: "Existing Project" }),
        expect.objectContaining({ id: "s1", name: "Legacy Space" })
      ]),
      or_project_threads: expect.arrayContaining([
        expect.objectContaining({ id: "t1", projectId: "s1", title: "Legacy Thread" })
      ])
    });
    expect(globalAny.chrome.storage.local.remove).toHaveBeenCalledWith([
      "or_spaces",
      "or_threads",
      "or_collapse_on_spaces"
    ]);
  });
});
