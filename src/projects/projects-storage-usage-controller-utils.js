// projects-storage-usage-controller-utils.js - storage meter controller for Projects

function createProjectsStorageUsageController(deps) {
  const state = {
    cachedUsage: null,
    lastUpdate: 0,
    inflight: null
  };

  async function renderStorageUsage() {
    if (!deps.elements.storageFillImages || !deps.elements.storageTextImages) {
      return;
    }

    const now = Date.now();
    const maxAgeMs = 30_000;
    const hasFreshCache = deps.shouldUseCachedStorageUsage({
      now,
      lastUpdate: state.lastUpdate,
      maxAgeMs,
      cachedUsage: state.cachedUsage
    });

    if (!hasFreshCache) {
      if (!state.inflight) {
        state.inflight = (async () => {
          const settings = await deps.getLocalStorage([deps.storageKeys.IMAGE_CACHE_LIMIT_MB]);
          const limitMb = deps.normalizeImageCacheLimitMb(Number(settings?.[deps.storageKeys.IMAGE_CACHE_LIMIT_MB]));
          const quotaBytesOverride = limitMb * 1024 * 1024;
          return deps.getIndexedDbStorageUsage({
            getImageStoreStats: deps.getImageStoreStats,
            getChatStoreStats: deps.getChatStoreStats,
            chatStore: deps.chatStore,
            quotaBytesOverride
          });
        })().then((usage) => {
          state.cachedUsage = usage;
          state.lastUpdate = Date.now();
          return usage;
        }).finally(() => {
          state.inflight = null;
        });
      }
      state.cachedUsage = await state.inflight;
    }

    const storageUsage = state.cachedUsage || { bytesUsed: 0, percentUsed: 0, quotaBytes: null };
    const meterState = deps.buildStorageMeterViewState({ usage: storageUsage, buildStorageLabel: deps.buildStorageLabel });

    deps.elements.storageTextImages.textContent = meterState.text;
    deps.elements.storageFillImages.style.width = meterState.width;
    deps.elements.storageFillImages.classList.remove("warning", "danger");
    if (meterState.fillClass) {
      deps.elements.storageFillImages.classList.add(meterState.fillClass);
    }

    if (meterState.warning) {
      deps.showStorageWarning(meterState.warning.level, meterState.warning.message);
    } else {
      deps.hideStorageWarning();
    }
  }

  function invalidateStorageUsageCache() {
    state.cachedUsage = null;
    state.lastUpdate = 0;
  }

  return {
    renderStorageUsage,
    invalidateStorageUsageCache
  };
}

const projectsStorageUsageControllerUtils = {
  createProjectsStorageUsageController
};

if (typeof window !== "undefined") {
  window.projectsStorageUsageControllerUtils = projectsStorageUsageControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStorageUsageControllerUtils;
}
