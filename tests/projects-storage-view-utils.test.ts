export {};

const {
  shouldUseCachedStorageUsage,
  buildStorageMeterViewState
} = require("../src/projects/projects-storage-view-utils.js");

describe("projects storage view utils", () => {
  test("shouldUseCachedStorageUsage returns true only for fresh cached values", () => {
    expect(shouldUseCachedStorageUsage({
      now: 10_000,
      lastUpdate: 0,
      maxAgeMs: 30_000,
      cachedUsage: null
    })).toBe(false);

    expect(shouldUseCachedStorageUsage({
      now: 10_000,
      lastUpdate: 9_000,
      maxAgeMs: 30_000,
      cachedUsage: { bytesUsed: 123 }
    })).toBe(true);
  });

  test("buildStorageMeterViewState computes fill and text", () => {
    const view = buildStorageMeterViewState({
      usage: { bytesUsed: 500, percentUsed: 25, quotaBytes: 2000 },
      buildStorageLabel: (label: string, bytes: number, quota: number) => `${label}:${bytes}/${quota}`
    });

    expect(view.width).toBe("25%");
    expect(view.text).toBe("IndexedDB Storage:500/2000");
    expect(view.warning).toBeNull();
  });

  test("buildStorageMeterViewState emits critical warning at 95%+", () => {
    const view = buildStorageMeterViewState({
      usage: { bytesUsed: 950, percentUsed: 95, quotaBytes: 1000 },
      buildStorageLabel: () => "x"
    });

    expect(view.warning).toEqual({
      level: "critical",
      message: "Storage full. Delete images or threads to free space."
    });
  });
});
