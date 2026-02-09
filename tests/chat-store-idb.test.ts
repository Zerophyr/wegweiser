export {};
const {
  createIndexedDbChatStore,
  putThread,
  getThread
} = require("../src/shared/chat-store.js");

jest.mock("../src/shared/crypto-store.js", () => ({
  encryptJson: async (value: any) => ({ alg: "AES-GCM", iv: "iv", data: JSON.stringify(value) }),
  decryptJson: async (payload: any) => JSON.parse(payload.data)
}));

function createFakeIndexedDb() {
  const stores = new Map();

  const createObjectStore = (name: string, options: any) => {
    const data = new Map();
    const indexes = new Map();
    const store = {
      data,
      put: (record: any) => {
        data.set(record[options.keyPath], record);
        const req: any = { result: record };
        setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
        return req;
      },
      get: (key: any) => {
        const req: any = { result: data.get(key) || null };
        setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
        return req;
      },
      createIndex: (indexName: string, keyPath: string) => {
        indexes.set(indexName, { keyPath });
      },
      index: (indexName: string) => {
        const index = indexes.get(indexName);
        return {
          getAll: (value: any) => {
            const req: any = { result: [] };
            setTimeout(() => {
              const results: any[] = [];
              for (const record of data.values()) {
                if (index && record[index.keyPath] === value) {
                  results.push(record);
                }
              }
              req.result = results;
              req.onsuccess && req.onsuccess({ target: req });
            }, 0);
            return req;
          }
        };
      }
    };
    stores.set(name, store);
    return store;
  };

  const db = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name)
    },
    createObjectStore,
    transaction: (storeName: string) => {
      const tx: any = {
        objectStore: () => stores.get(storeName),
        oncomplete: null,
        onerror: null
      };
      setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
      return tx;
    }
  };

  return {
    open: () => {
      const request: any = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
      setTimeout(() => {
        if (request.onupgradeneeded) request.onupgradeneeded();
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }
  };
}

test("indexeddb adapter stores and retrieves thread", async () => {
  const idb = createFakeIndexedDb();
  const store = createIndexedDbChatStore(idb);
  await putThread({ id: "t1", projectId: "p1", title: "Hello" }, store);
  const thread = await getThread("t1", store);
  expect(thread?.title).toBe("Hello");
});
