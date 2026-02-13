// projects-storage-view-utils.js - Presentation helpers for Projects storage meter/warnings

function shouldUseCachedStorageUsage({ now, lastUpdate, maxAgeMs, cachedUsage } = {}) {
  if (!cachedUsage) return false;
  if (!Number.isFinite(now) || !Number.isFinite(lastUpdate) || !Number.isFinite(maxAgeMs)) return false;
  return (now - lastUpdate) < maxAgeMs;
}

function getStorageFillClass(percentUsed) {
  if (percentUsed >= 85) return "danger";
  if (percentUsed >= 70) return "warning";
  return "";
}

function getStorageWarning(percentUsed) {
  if (percentUsed >= 95) {
    return {
      level: "critical",
      message: "Storage full. Delete images or threads to free space."
    };
  }
  if (percentUsed >= 85) {
    return {
      level: "high",
      message: "Storage almost full. Delete images or threads to continue using Projects."
    };
  }
  if (percentUsed >= 70) {
    return {
      level: "medium",
      message: "Storage is filling up. Consider deleting old threads or images."
    };
  }
  return null;
}

function buildStorageMeterViewState({ usage, buildStorageLabel } = {}) {
  const safeUsage = usage || { bytesUsed: 0, percentUsed: 0, quotaBytes: null };
  const percentUsed = typeof safeUsage.percentUsed === "number" ? safeUsage.percentUsed : 0;
  return {
    text: (typeof buildStorageLabel === "function")
      ? buildStorageLabel("IndexedDB Storage", safeUsage.bytesUsed, safeUsage.quotaBytes)
      : "",
    width: `${Math.min(percentUsed, 100)}%`,
    fillClass: getStorageFillClass(percentUsed),
    warning: getStorageWarning(percentUsed)
  };
}

const projectsStorageViewUtils = {
  shouldUseCachedStorageUsage,
  getStorageFillClass,
  getStorageWarning,
  buildStorageMeterViewState
};

if (typeof window !== "undefined") {
  window.projectsStorageViewUtils = projectsStorageViewUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStorageViewUtils;
}
