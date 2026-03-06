export {};

describe("encrypted storage runtime", () => {
  test("getEncrypted returns undefined when decrypt fails", async () => {
    jest.resetModules();
    const globalAny = global as any;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    globalAny.decryptJson = jest.fn().mockRejectedValue(new Error("bad decrypt"));
    globalAny.chrome.storage.local.get.mockResolvedValue({
      or_api_key: { alg: "AES-GCM", iv: "iv", data: "data" }
    });

    const { getEncrypted } = require("../src/shared/encrypted-storage.js");

    await expect(getEncrypted(["or_api_key"])).resolves.toEqual({
      or_api_key: undefined
    });

    expect(warnSpy).not.toHaveBeenCalled();

    delete globalAny.decryptJson;
    warnSpy.mockRestore();
  });

  test("setEncrypted ignores global ENCRYPTED_STORAGE_KEYS override", async () => {
    jest.resetModules();
    const globalAny = global as any;

    globalAny.ENCRYPTED_STORAGE_KEYS = [];
    globalAny.encryptJson = jest.fn().mockResolvedValue({ alg: "AES-GCM", iv: "iv", data: "cipher" });

    const { setEncrypted } = require("../src/shared/encrypted-storage.js");

    await setEncrypted({ or_api_key: "secret" });

    expect(globalAny.encryptJson).toHaveBeenCalledWith("secret");
    expect(globalAny.chrome.storage.local.set).toHaveBeenCalledWith({
      or_api_key: { alg: "AES-GCM", iv: "iv", data: "cipher" }
    });

    delete globalAny.ENCRYPTED_STORAGE_KEYS;
    delete globalAny.encryptJson;
  });

  test("setEncrypted throws when encryptJson is unavailable", async () => {
    jest.resetModules();
    const globalAny = global as any;
    delete globalAny.encryptJson;

    const { setEncrypted } = require("../src/shared/encrypted-storage.js");

    await expect(setEncrypted({ or_api_key: "secret" })).rejects.toThrow(/encryptJson not available/i);
  });

  test("getEncrypted throws when decryptJson is unavailable", async () => {
    jest.resetModules();
    const globalAny = global as any;
    delete globalAny.decryptJson;

    globalAny.chrome.storage.local.get.mockResolvedValue({
      or_api_key: { alg: "AES-GCM", iv: "iv", data: "data" }
    });

    const { getEncrypted } = require("../src/shared/encrypted-storage.js");

    await expect(getEncrypted(["or_api_key"]))
      .rejects
      .toThrow(/decryptJson not available/i);
  });
});
