export {};
const { prepareImageCacheEntry } = require("../src/shared/image-cache.js");
const { putImageCacheEntry } = require("../src/shared/image-cache.js");

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

describe("image cache trimming", () => {
  test("removes metadata for trimmed images", async () => {
    const storageData: Record<string, any> = {};
    const get = jest.fn(async (defaults) => {
      const result = { ...defaults };
      Object.keys(defaults).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(storageData, key)) {
          result[key] = storageData[key];
        }
      });
      return result;
    });
    const set = jest.fn(async (update) => {
      Object.assign(storageData, update);
    });

    const globalAny = global as any;
    globalAny.chrome = {
      storage: {
        local: { get, set }
      }
    } as any;
    globalAny.STORAGE_KEYS = {
      IMAGE_CACHE: "or_image_cache",
      IMAGE_CACHE_LIMIT_MB: "or_image_cache_limit_mb"
    };
    globalAny.DEFAULTS = { IMAGE_CACHE_LIMIT_MB: 512 };
    globalAny.CACHE_TTL = { IMAGE: 1000 };
    globalAny.putImageStoreEntry = jest.fn().mockResolvedValue(undefined);
    globalAny.getImageStoreEntry = jest.fn().mockResolvedValue(null);
    globalAny.cleanupImageStore = jest.fn().mockResolvedValue(null);
    globalAny.trimImageStoreToMaxBytes = jest.fn().mockResolvedValue({
      removedIds: ["img-old"]
    });

    const now = Date.now();
    storageData.or_image_cache = {
      "img-old": {
        imageId: "img-old",
        createdAt: now - 1000,
        expiresAt: now + 100000,
        hasData: true
      }
    };

    await putImageCacheEntry({
      imageId: "img-new",
      dataUrl: "data:image/png;base64,new",
      createdAt: now,
      expiresAt: now + 100000
    }, now);

    expect(storageData.or_image_cache["img-old"]).toBeUndefined();
    expect(storageData.or_image_cache["img-new"]).toBeDefined();
  });
});

