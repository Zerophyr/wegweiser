export {};
const {
  createMemoryImageStore,
  getImageStoreStats,
  putImageStoreEntry,
  getImageStoreEntry,
  cleanupImageStore
} = require("../src/shared/image-store.js");

describe("image store (memory adapter)", () => {
  test("stores and retrieves image entries", async () => {
    const store = createMemoryImageStore();
    await putImageStoreEntry({
      imageId: "img-1",
      dataUrl: "data:image/png;base64,abc",
      mimeType: "image/png",
      createdAt: 0,
      expiresAt: 9999999999999
    }, store);

    const entry = await getImageStoreEntry("img-1", store);
    expect(entry?.dataUrl).toBe("data:image/png;base64,abc");
  });

  test("cleanup removes expired entries", async () => {
    const store = createMemoryImageStore();
    await putImageStoreEntry({
      imageId: "img-exp",
      dataUrl: "data:image/png;base64,expired",
      createdAt: 0,
      expiresAt: 5
    }, store);

    await cleanupImageStore(10, store);
    const entry = await getImageStoreEntry("img-exp", store);
    expect(entry).toBeNull();
  });

  test("stats report total bytes", async () => {
    const store = createMemoryImageStore();
    await putImageStoreEntry({
      imageId: "img-2",
      dataUrl: "data:image/png;base64,abc",
      createdAt: 0,
      expiresAt: 9999999999999
    }, store);

    const stats = await getImageStoreStats(store);
    expect(stats.count).toBe(1);
    expect(stats.bytesUsed).toBe("data:image/png;base64,abc".length);
  });
});

