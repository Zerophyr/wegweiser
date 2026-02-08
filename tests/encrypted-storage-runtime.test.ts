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
});
