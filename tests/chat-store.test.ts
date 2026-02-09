export {};
const {
  createMemoryChatStore,
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
