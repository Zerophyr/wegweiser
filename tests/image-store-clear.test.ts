const { cleanupImageStore, createMemoryImageStore, putImageStoreEntry } = require("../src/shared/image-store.js");

describe("image store clear", () => {
  test("cleanupImageStore clears entries when forced", async () => {
    const store = createMemoryImageStore();
    await putImageStoreEntry({
      imageId: "img-3",
      dataUrl: "data:image/png;base64,abc",
      createdAt: 0,
      expiresAt: 9999999999999
    }, store);

    await cleanupImageStore(Infinity, store);
    const entry = await store.get("img-3", Infinity);
    expect(entry).toBeNull();
  });
});
