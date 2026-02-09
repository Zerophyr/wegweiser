export {};

jest.mock("../src/shared/crypto-store.js", () => ({
  encryptJson: async (value: any) => ({ alg: "AES-GCM", iv: "iv", data: JSON.stringify(value) }),
  decryptJson: async (payload: any) => JSON.parse(payload.data)
}));

const { migrateLegacyChatToIdb } = require("../src/shared/chat-migration.js");
const { getProjects, getThread } = require("../src/shared/chat-store.js");

test("migrates legacy project/thread keys and removes old storage", async () => {
  const globalAny = global as any;
  globalAny.chrome = { storage: { local: { get: jest.fn(), remove: jest.fn(), set: jest.fn() } } };
  globalAny.chrome.storage.local.get.mockResolvedValue({
    or_projects: [{ id: "p1", name: "Legacy Project" }],
    or_project_threads: [{ id: "t1", projectId: "p1", title: "Thread" }]
  });

  const result = await migrateLegacyChatToIdb();
  expect(result.migrated).toBe(true);

  const projects = await getProjects();
  const thread = await getThread("t1");
  expect(projects).toHaveLength(1);
  expect(projects[0].name).toBe("Legacy Project");
  expect(thread?.title).toBe("Thread");

  expect(globalAny.chrome.storage.local.remove).toHaveBeenCalled();
});
