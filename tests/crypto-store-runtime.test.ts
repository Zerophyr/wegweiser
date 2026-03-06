export {};

type RequestMock = {
  result?: any;
  error?: any;
  onsuccess?: (() => void) | null;
  onerror?: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
};

type TransactionMock = {
  oncomplete?: (() => void) | null;
  onerror?: (() => void) | null;
  onabort?: (() => void) | null;
  error?: any;
  objectStore: (name: string) => any;
};

function createRequest(): RequestMock {
  return {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  };
}

function createIndexedDbMock() {
  const store = new Map<string, any>();
  let storeCreated = false;

  const db = {
    objectStoreNames: {
      contains(name: string) {
        return storeCreated && name === "crypto_keys";
      }
    },
    createObjectStore(name: string) {
      if (name === "crypto_keys") {
        storeCreated = true;
      }
      return null;
    },
    transaction(_name: string, _mode: string): TransactionMock {
      const tx: TransactionMock = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore() {
          return {
            get(id: string) {
              const req = createRequest();
              setTimeout(() => {
                req.result = store.get(id);
                req.onsuccess && req.onsuccess();
                setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
              }, 0);
              return req;
            },
            put(value: any) {
              const req = createRequest();
              setTimeout(() => {
                store.set(value.id, value);
                req.result = value;
                req.onsuccess && req.onsuccess();
                setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
              }, 0);
              return req;
            },
            delete(id: string) {
              const req = createRequest();
              setTimeout(() => {
                store.delete(id);
                req.result = undefined;
                req.onsuccess && req.onsuccess();
                setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
              }, 0);
              return req;
            }
          };
        }
      };
      return tx;
    }
  };

  const indexedDb = {
    open(_dbName: string, _version: number) {
      const req = createRequest();
      setTimeout(() => {
        req.result = db;
        req.onupgradeneeded && req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    }
  };

  return { indexedDb, store };
}

function setRuntimeApis(globalAny: any, indexedDb: any, subtle: any) {
  Object.defineProperty(globalAny, "indexedDB", {
    configurable: true,
    writable: true,
    value: indexedDb
  });
  Object.defineProperty(globalAny, "crypto", {
    configurable: true,
    writable: true,
    value: {
      subtle,
      getRandomValues: (arr: Uint8Array) => arr
    }
  });
}

describe("crypto-store runtime", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    const local = (global as any).chrome.storage.local;
    local.get.mockReset();
    local.set.mockReset();
    if (local.remove && typeof local.remove.mockReset === "function") {
      local.remove.mockReset();
    }
  });

  test("generates non-extractable key and applies one-time reset", async () => {
    const globalAny = global as any;
    const { indexedDb, store } = createIndexedDbMock();
    const generatedKey = { type: "secret", id: "k1" };

    const subtle = {
      generateKey: jest.fn().mockResolvedValue(generatedKey)
    };

    setRuntimeApis(globalAny, indexedDb, subtle);

    globalAny.chrome.storage.local.get
      .mockResolvedValueOnce({})
      .mockResolvedValue({ or_crypto_reset_v2: true });
    globalAny.chrome.storage.local.remove = jest.fn().mockResolvedValue(undefined);
    globalAny.chrome.storage.local.set.mockResolvedValue(undefined);

    const { getOrCreateKey } = require("../src/shared/crypto-store.js");

    const key = await getOrCreateKey();

    expect(key).toBe(generatedKey);
    expect(subtle.generateKey).toHaveBeenCalledWith(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    expect(globalAny.chrome.storage.local.remove).toHaveBeenCalledWith(expect.arrayContaining([
      "or_crypto_key",
      "or_api_key",
      "or_recent_models"
    ]));
    expect(globalAny.chrome.storage.local.set).toHaveBeenCalledWith({ or_crypto_reset_v2: true });
    expect(globalAny.chrome.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({ or_crypto_key: expect.anything() }));
    expect(store.get("primary")?.key).toBe(generatedKey);
  });

  test("does not reset again when marker already exists", async () => {
    const globalAny = global as any;
    const { indexedDb } = createIndexedDbMock();

    const subtle = {
      generateKey: jest.fn().mockResolvedValue({ type: "secret", id: "k2" })
    };

    setRuntimeApis(globalAny, indexedDb, subtle);

    globalAny.chrome.storage.local.get.mockResolvedValue({ or_crypto_reset_v2: true });
    globalAny.chrome.storage.local.remove = jest.fn().mockResolvedValue(undefined);
    globalAny.chrome.storage.local.set.mockResolvedValue(undefined);

    const { getOrCreateKey } = require("../src/shared/crypto-store.js");

    await getOrCreateKey();

    expect(globalAny.chrome.storage.local.remove).not.toHaveBeenCalled();
    expect(globalAny.chrome.storage.local.set).not.toHaveBeenCalledWith({ or_crypto_reset_v2: true });
  });
});
