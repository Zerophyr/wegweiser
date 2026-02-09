export {};

jest.mock("../src/shared/crypto-store.js", () => ({
  encryptJson: async (value: any) => ({ alg: "AES-GCM", iv: "iv", data: JSON.stringify(value) }),
  decryptJson: async (payload: any) => JSON.parse(payload.data)
}));

const {
  createMemoryChatStore,
  putProject,
  getProjects,
  putThread,
  getThread,
  putMessage,
  getMessages
} = require("../src/shared/chat-store.js");

test("chat store memory adapter stores and retrieves threads + messages", async () => {
  const store = createMemoryChatStore();
  await putThread({ id: "t1", projectId: "p1", title: "Hello" }, store);
  await putMessage({ id: "m1", threadId: "t1", role: "user", content: "Hi" }, store);

  const thread = await getThread("t1", store);
  const messages = await getMessages("t1", store);
  expect(thread?.title).toBe("Hello");
  expect(messages).toHaveLength(1);
  expect(messages[0].content).toBe("Hi");
});

test("chat store memory adapter stores and retrieves projects", async () => {
  const store = createMemoryChatStore();
  await putProject({ id: "p1", name: "Project" }, store);
  const projects = await getProjects(store);
  expect(projects).toHaveLength(1);
  expect(projects[0].name).toBe("Project");
});
