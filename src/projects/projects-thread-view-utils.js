// projects-thread-view-utils.js - Helpers for Projects thread list view state

function sortThreadsByUpdatedAt(threads) {
  const safeThreads = Array.isArray(threads) ? threads.slice() : [];
  safeThreads.sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
  return safeThreads;
}

function getThreadListViewState(threads) {
  const sorted = sortThreadsByUpdatedAt(threads);
  return {
    threads: sorted,
    isEmpty: sorted.length === 0
  };
}

const projectsThreadViewUtils = {
  sortThreadsByUpdatedAt,
  getThreadListViewState
};

if (typeof window !== "undefined") {
  window.projectsThreadViewUtils = projectsThreadViewUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsThreadViewUtils;
}
