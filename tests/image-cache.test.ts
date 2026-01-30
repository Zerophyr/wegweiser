const {
  pruneExpiredImageCache,
  putImageCacheEntry,
  getImageCacheEntry
} = require("../src/shared/image-cache.js");

const IMAGE_CACHE_KEY = "or_image_cache";

describe("image cache", () => {
  beforeEach(() => {
    (global as any).chrome.storage.local.get.mockResolvedValue({
      [IMAGE_CACHE_KEY]: {}
    });
    (global as any).chrome.storage.local.set.mockResolvedValue(undefined);
  });

  test("pruneExpiredImageCache drops expired entries", () => {
    const now = 1000;
    const cache = {
      a: { imageId: "a", expiresAt: now - 1 },
      b: { imageId: "b", expiresAt: now + 1 }
    };
    const pruned = pruneExpiredImageCache(cache, now);
    expect(pruned.a).toBeUndefined();
    expect(pruned.b).toBeDefined();
  });

  test("putImageCacheEntry writes entry with TTL", async () => {
    const entry = { imageId: "x", mimeType: "image/png", data: "data" };
    await putImageCacheEntry(entry, 1000);
    expect((global as any).chrome.storage.local.set).toHaveBeenCalled();
  });

  test("getImageCacheEntry returns null when expired", async () => {
    const now = 1000;
    (global as any).chrome.storage.local.get.mockResolvedValue({
      [IMAGE_CACHE_KEY]: {
        x: { imageId: "x", expiresAt: now - 1 }
      }
    });
    const res = await getImageCacheEntry("x", now);
    expect(res).toBeNull();
  });
});
