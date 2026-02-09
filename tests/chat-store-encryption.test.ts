export {};
const { createMemoryChatStore, putThread, getThread } = require("../src/shared/chat-store.js");

jest.mock("../src/shared/crypto-store.js", () => ({
  encryptJson: async (value: any) => ({ alg: "AES-GCM", iv: "iv", data: JSON.stringify(value) }),
  decryptJson: async (payload: any) => JSON.parse(payload.data)
}));

test("chat store encrypts payload and decrypts on read", async () => {
  const store = createMemoryChatStore();
  await putThread({ id: "t1", projectId: "p1", title: "Secret" }, store);
  const raw = store.threads.get("t1");
  expect(raw?.ciphertext || raw?.data).toBeDefined();

  const thread = await getThread("t1", store);
  expect(thread?.title).toBe("Secret");
});
