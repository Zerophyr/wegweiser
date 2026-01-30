const { prepareImageCacheEntry } = require("../src/shared/image-cache.js");

describe("prepareImageCacheEntry", () => {
  test("strips dataUrl when image store is supported", () => {
    const entry = {
      imageId: "img-1",
      dataUrl: "data:image/png;base64,abc",
      mimeType: "image/png",
      createdAt: 0
    };

    const result = prepareImageCacheEntry(entry, 1000, true);
    expect(result.cacheEntry.dataUrl).toBeUndefined();
    expect(result.cacheEntry.hasData).toBe(true);
    expect(result.storeEntry.dataUrl).toBe("data:image/png;base64,abc");
  });

  test("keeps dataUrl when image store is not supported", () => {
    const entry = {
      imageId: "img-2",
      dataUrl: "data:image/png;base64,abc",
      createdAt: 0
    };

    const result = prepareImageCacheEntry(entry, 1000, false);
    expect(result.cacheEntry.dataUrl).toBe("data:image/png;base64,abc");
    expect(result.cacheEntry.hasData).toBeUndefined();
    expect(result.storeEntry).toBeNull();
  });
});
