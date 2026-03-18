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

type IndexedDbOptions = {
  failOpen?: boolean;
  failPutIds?: string[];
  failDeleteIds?: string[];
  log?: string[];
};

function createRequest(): RequestMock {
  return {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  };
}

function createStorageState(initial: Record<string, any> = {}) {
  const state = { ...initial };

  const get = jest.fn(async (keys?: string[] | string | Record<string, any>) => {
    if (Array.isArray(keys)) {
      return keys.reduce((acc, key) => {
        acc[key] = state[key];
        return acc;
      }, {} as Record<string, any>);
    }
    if (typeof keys === "string") {
      return { [keys]: state[keys] };
    }
    if (keys && typeof keys === "object") {
      return Object.keys(keys).reduce((acc, key) => {
        acc[key] = state[key] === undefined ? keys[key] : state[key];
        return acc;
      }, {} as Record<string, any>);
    }
    return { ...state };
  });

  const set = jest.fn(async (payload: Record<string, any>) => {
    Object.assign(state, payload);
  });

  const remove = jest.fn(async (keys: string[] | string) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      delete state[key];
    }
  });

  return { state, get, set, remove };
}

function createIndexedDbMock(options: IndexedDbOptions = {}) {
  const store = new Map<string, any>();
  let storeCreated = false;
  const failPutIds = new Set(options.failPutIds || []);
  const failDeleteIds = new Set(options.failDeleteIds || []);
  const log = options.log || [];

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
                log.push(`idb:get:${id}`);
                req.result = store.get(id);
                req.onsuccess && req.onsuccess();
                setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
              }, 0);
              return req;
            },
            put(value: any) {
              const req = createRequest();
              setTimeout(() => {
                log.push(`idb:put:${value.id}`);
                if (failPutIds.has(value.id)) {
                  const error = new Error(`put failed for ${value.id}`);
                  req.error = error;
                  tx.error = error;
                  req.onerror && req.onerror();
                  setTimeout(() => tx.onerror && tx.onerror(), 0);
                  return;
                }
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
                log.push(`idb:delete:${id}`);
                if (failDeleteIds.has(id)) {
                  const error = new Error(`delete failed for ${id}`);
                  req.error = error;
                  tx.error = error;
                  req.onerror && req.onerror();
                  setTimeout(() => tx.onerror && tx.onerror(), 0);
                  return;
                }
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
        if (options.failOpen) {
          req.error = new Error("open failed");
          req.onerror && req.onerror();
          return;
        }
        req.result = db;
        req.onupgradeneeded && req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    }
  };

  return { indexedDb, store, log };
}

function setRuntimeApis(globalAny: any, indexedDb: any, subtle: any, localStorageMock: ReturnType<typeof createStorageState>) {
  Object.defineProperty(globalAny, "indexedDB", {
    configurable: true,
    writable: true,
    value: indexedDb
  });

  const subtleApi = {
    encrypt: jest.fn(async (_algorithm: any, _key: any, data: Uint8Array) => data),
    decrypt: jest.fn(async (_algorithm: any, _key: any, data: ArrayBuffer | Uint8Array) => data),
    ...subtle
  };

  Object.defineProperty(globalAny, "crypto", {
    configurable: true,
    writable: true,
    value: {
      subtle: subtleApi,
      getRandomValues: (arr: Uint8Array) => arr
    }
  });
  globalAny.chrome.storage.local.get = localStorageMock.get;
  globalAny.chrome.storage.local.set = localStorageMock.set;
  globalAny.chrome.storage.local.remove = localStorageMock.remove;
}

function loadCryptoStoreModule() {
  let loaded: any;
  jest.isolateModules(() => {
    loaded = require("../src/shared/crypto-store.js");
  });
  return loaded;
}

describe("crypto-store runtime", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test("generates a non-extractable key, verifies persistence, then applies one-time reset", async () => {
    const globalAny = global as any;
    const log: string[] = [];
    const indexedDbMock = createIndexedDbMock({ log });
    const localStorageMock = createStorageState();
    const generatedKey = { type: "secret", id: "k1" };
    const subtle = {
      generateKey: jest.fn().mockResolvedValue(generatedKey)
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();
    const key = await getOrCreateKey();

    expect(key).toBe(generatedKey);
    expect(subtle.generateKey).toHaveBeenCalledWith(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    expect(localStorageMock.remove).toHaveBeenCalledWith(expect.arrayContaining([
      "or_crypto_key",
      "or_api_key",
      "or_recent_models"
    ]));
    expect(localStorageMock.set).toHaveBeenCalledWith({ or_crypto_reset_v2: true });
    expect(indexedDbMock.store.get("primary")?.key).toBe(generatedKey);
    expect(log.indexOf("idb:put:pending_v2")).toBeLessThan(log.indexOf("idb:get:pending_v2"));
    expect(log.indexOf("idb:get:pending_v2")).toBeLessThan(log.indexOf("idb:put:primary"));
  });

  test("does not clear encrypted data when IndexedDB open fails", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock({ failOpen: true });
    const localStorageMock = createStorageState({ or_api_key: { data: "cipher" } });
    const subtle = {
      generateKey: jest.fn()
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();

    await expect(getOrCreateKey()).rejects.toThrow("open failed");
    expect(localStorageMock.remove).not.toHaveBeenCalledWith(expect.arrayContaining(["or_api_key"]));
    expect(localStorageMock.set).not.toHaveBeenCalledWith({ or_crypto_reset_v2: true });
    expect(localStorageMock.state.or_api_key).toEqual({ data: "cipher" });
  });

  test("does not set reset marker or clear encrypted values when key persistence fails", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock({ failPutIds: ["pending_v2"] });
    const localStorageMock = createStorageState({ or_api_key: { data: "cipher" } });
    const subtle = {
      generateKey: jest.fn().mockResolvedValue({ type: "secret", id: "k2" })
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();

    await expect(getOrCreateKey()).rejects.toThrow("put failed for pending_v2");
    expect(localStorageMock.remove).not.toHaveBeenCalledWith(expect.arrayContaining(["or_api_key"]));
    expect(localStorageMock.state.or_crypto_reset_v2).toBeUndefined();
    expect(indexedDbMock.store.get("primary")).toBeUndefined();
  });


  test("does not clear encrypted values when reset marker write fails after primary promotion", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock();
    const localStorageMock = createStorageState({ or_api_key: { data: "cipher" } });
    localStorageMock.set.mockImplementation(async (payload: Record<string, any>) => {
      if (Object.prototype.hasOwnProperty.call(payload, "or_crypto_reset_v2")) {
        throw new Error("marker write failed");
      }
      Object.assign(localStorageMock.state, payload);
    });
    const subtle = {
      generateKey: jest.fn().mockResolvedValue({ type: "secret", id: "k2b" })
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();

    await expect(getOrCreateKey()).rejects.toThrow("marker write failed");
    expect(localStorageMock.state.or_api_key).toEqual({ data: "cipher" });
    expect(indexedDbMock.store.get("primary")?.key).toEqual({ type: "secret", id: "k2b" });
    expect(localStorageMock.state.or_crypto_reset_v2).toBeUndefined();
  });

  test("aborts bootstrap if the init lock is lost before key generation", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock();
    const localStorageMock = createStorageState();
    let lockReads = 0;
    const baseGet = localStorageMock.get;
    localStorageMock.get = jest.fn(async (keys?: string[] | string | Record<string, any>) => {
      const result = await baseGet(keys);
      const requestedKeys = Array.isArray(keys) ? keys : (typeof keys === "string" ? [keys] : Object.keys(keys || {}));
      if (requestedKeys.includes("or_crypto_init_lock_v2")) {
        lockReads += 1;
        if (lockReads >= 5) {
          result.or_crypto_init_lock_v2 = {
            owner: "other-owner",
            acquiredAt: 1,
            expiresAt: Date.now() + 60000
          };
        }
      }
      return result;
    });
    const subtle = {
      generateKey: jest.fn().mockResolvedValue({ type: "secret", id: "k-lock" })
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();

    await expect(getOrCreateKey()).rejects.toThrow("Crypto init lock lost");
    expect(subtle.generateKey).not.toHaveBeenCalled();
    expect(localStorageMock.remove).not.toHaveBeenCalledWith(expect.arrayContaining(["or_api_key"]));
    expect(localStorageMock.state.or_crypto_reset_v2).toBeUndefined();
  });

  test("cleanup failures after marker write do not roll back the new key state", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock({ failDeleteIds: ["pending_v2"] });
    const localStorageMock = createStorageState();
    const subtle = {
      generateKey: jest.fn().mockResolvedValue({ type: "secret", id: "k2c" })
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();
    const key = await getOrCreateKey();

    expect(key).toEqual({ type: "secret", id: "k2c" });
    expect(localStorageMock.state.or_crypto_reset_v2).toBe(true);
    expect(indexedDbMock.store.get("primary")?.key).toEqual({ type: "secret", id: "k2c" });
  });

  test("stale init lock is ignored and replaced during recovery", async () => {
    const globalAny = global as any;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(10000);
    const indexedDbMock = createIndexedDbMock();
    const localStorageMock = createStorageState({
      or_crypto_init_lock_v2: {
        owner: "stale-owner",
        expiresAt: 1000
      }
    });
    const generatedKey = { type: "secret", id: "k3" };
    const subtle = {
      generateKey: jest.fn().mockResolvedValue(generatedKey)
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();
    const key = await getOrCreateKey();

    expect(key).toBe(generatedKey);
    expect(localStorageMock.state.or_crypto_reset_v2).toBe(true);
    expect(localStorageMock.state.or_crypto_init_lock_v2).toBeUndefined();
    nowSpy.mockRestore();
  });

  test("long-running init renews the lock instead of losing it to timeout expiry", async () => {
    const globalAny = global as any;
    let now = 1000;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
    const indexedDbMock = createIndexedDbMock();
    const localStorageMock = createStorageState();
    const generatedKey = { type: "secret", id: "k4" };
    let resolveGenerateKey: ((value: any) => void) | null = null;
    const subtle = {
      generateKey: jest.fn().mockImplementation(() => new Promise((resolve) => {
        resolveGenerateKey = resolve;
        now += 35000;
      }))
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const cryptoStoreA = loadCryptoStoreModule();
    const cryptoStoreB = loadCryptoStoreModule();

    const pendingA = cryptoStoreA.getOrCreateKey();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const pendingB = cryptoStoreB.getOrCreateKey();
    if (!resolveGenerateKey) throw new Error("missing generateKey resolver");
    const finishGenerateKey = resolveGenerateKey as (value: any) => void;
    finishGenerateKey(generatedKey);

    const [keyA, keyB] = await Promise.all([pendingA, pendingB]);

    expect(keyA).toBe(generatedKey);
    expect(keyB).toBe(generatedKey);
    expect(subtle.generateKey).toHaveBeenCalledTimes(1);
    expect(localStorageMock.state.or_crypto_reset_v2).toBe(true);

    nowSpy.mockRestore();
  }, 15000);

  test("concurrent module instances converge on one persisted key", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock();
    const localStorageMock = createStorageState();
    const generatedKey = { type: "secret", id: "shared-key" };
    const subtle = {
      generateKey: jest.fn().mockResolvedValue(generatedKey)
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const cryptoStoreA = loadCryptoStoreModule();
    const cryptoStoreB = loadCryptoStoreModule();

    const [keyA, keyB] = await Promise.all([
      cryptoStoreA.getOrCreateKey(),
      cryptoStoreB.getOrCreateKey()
    ]);

    expect(keyA).toBe(generatedKey);
    expect(keyB).toBe(generatedKey);
    expect(subtle.generateKey).toHaveBeenCalledTimes(1);
    expect(localStorageMock.state.or_crypto_reset_v2).toBe(true);
    expect(indexedDbMock.store.get("primary")?.key).toBe(generatedKey);
  });

  test("does not reset again when marker already exists", async () => {
    const globalAny = global as any;
    const indexedDbMock = createIndexedDbMock();
    const persistedKey = { type: "secret", id: "existing" };
    indexedDbMock.store.set("primary", { id: "primary", key: persistedKey });
    const localStorageMock = createStorageState({ or_crypto_reset_v2: true });
    const subtle = {
      generateKey: jest.fn()
    };

    setRuntimeApis(globalAny, indexedDbMock.indexedDb, subtle, localStorageMock);

    const { getOrCreateKey } = loadCryptoStoreModule();
    const key = await getOrCreateKey();

    expect(key).toBe(persistedKey);
    expect(localStorageMock.remove).not.toHaveBeenCalled();
    expect(subtle.generateKey).not.toHaveBeenCalled();
  });
});
