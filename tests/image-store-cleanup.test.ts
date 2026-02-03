export {};
const { createMemoryImageStore, putImageStoreEntry, cleanupImageStore } = require("../src/shared/image-store.js");

describe("image store cleanup", () => {
  test("cleanupImageStore clears all entries when called with Infinity", async () => {
    const store = createMemoryImageStore();
    await putImageStoreEntry({
      imageId: "img-1",
      dataUrl: "data:image/png;base64,abc",
      createdAt: 0,
      expiresAt: 9999999999999
    }, store);
    await cleanupImageStore(Infinity, store);
    const entry = await store.get("img-1", Infinity);
    expect(entry).toBeNull();
  });
});

