// projects-migration.js - migrate legacy Spaces storage keys to Projects

const LEGACY_KEYS = {
  SPACES: "or_spaces",
  THREADS: "or_threads",
  COLLAPSE_ON_SPACES: "or_collapse_on_spaces"
};

const NEW_KEYS = {
  PROJECTS: "or_projects",
  PROJECT_THREADS: "or_project_threads",
  COLLAPSE_ON_PROJECTS: "or_collapse_on_projects"
};

async function migrateLegacySpaceKeys() {
  const getStorage = (keys) => (
    typeof globalThis !== "undefined" && typeof globalThis.getEncrypted === "function"
      ? globalThis.getEncrypted(keys)
      : chrome.storage.local.get(keys)
  );
  const setStorage = (values) => (
    typeof globalThis !== "undefined" && typeof globalThis.setEncrypted === "function"
      ? globalThis.setEncrypted(values)
      : chrome.storage.local.set(values)
  );

  const stored = await getStorage([
    LEGACY_KEYS.SPACES,
    LEGACY_KEYS.THREADS,
    LEGACY_KEYS.COLLAPSE_ON_SPACES,
    NEW_KEYS.PROJECTS,
    NEW_KEYS.PROJECT_THREADS,
    NEW_KEYS.COLLAPSE_ON_PROJECTS
  ]);

  const hasLegacy = stored[LEGACY_KEYS.SPACES] !== undefined
    || stored[LEGACY_KEYS.THREADS] !== undefined
    || stored[LEGACY_KEYS.COLLAPSE_ON_SPACES] !== undefined;

  if (!hasLegacy) return { migrated: false };

  const normalizeProjects = (value) => (
    Array.isArray(value) ? value.filter(Boolean) : []
  );

  const normalizeThreads = (value) => {
    const threads = [];
    const pushThread = (thread, fallbackProjectId) => {
      if (!thread || typeof thread !== "object") return;
      const normalized = { ...thread };
      if (normalized.projectId === undefined) {
        normalized.projectId = normalized.ProjectId || fallbackProjectId;
      }
      delete normalized.ProjectId;
      threads.push(normalized);
    };

    if (Array.isArray(value)) {
      value.forEach((thread) => pushThread(thread));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, list]) => {
        if (!Array.isArray(list)) return;
        list.forEach((thread) => pushThread(thread, key));
      });
    }
    return threads;
  };

  const mergeById = (primary, secondary) => {
    const result = Array.isArray(primary) ? [...primary] : [];
    const seen = new Set(result.map((item) => item?.id).filter(Boolean));
    secondary.forEach((item) => {
      const id = item?.id;
      if (id && seen.has(id)) return;
      result.push(item);
      if (id) seen.add(id);
    });
    return result;
  };

  const existingProjects = normalizeProjects(stored[NEW_KEYS.PROJECTS]);
  const legacyProjects = normalizeProjects(stored[LEGACY_KEYS.SPACES]);
  const existingThreads = normalizeThreads(stored[NEW_KEYS.PROJECT_THREADS]);
  const legacyThreads = normalizeThreads(stored[LEGACY_KEYS.THREADS]);

  const payload = {};
  let migrated = false;

  if (legacyProjects.length) {
    const mergedProjects = mergeById(existingProjects, legacyProjects);
    if (mergedProjects.length !== existingProjects.length || stored[NEW_KEYS.PROJECTS] === undefined) {
      payload[NEW_KEYS.PROJECTS] = mergedProjects;
      migrated = true;
    }
  }

  if (legacyThreads.length) {
    const mergedThreads = mergeById(existingThreads, legacyThreads);
    if (mergedThreads.length !== existingThreads.length || stored[NEW_KEYS.PROJECT_THREADS] === undefined) {
      payload[NEW_KEYS.PROJECT_THREADS] = mergedThreads;
      migrated = true;
    }
  }

  if (stored[LEGACY_KEYS.COLLAPSE_ON_SPACES] !== undefined
    && stored[NEW_KEYS.COLLAPSE_ON_PROJECTS] === undefined) {
    payload[NEW_KEYS.COLLAPSE_ON_PROJECTS] = stored[LEGACY_KEYS.COLLAPSE_ON_SPACES];
    migrated = true;
  }

  if (!migrated) return { migrated: false };

  await setStorage(payload);

  if (typeof chrome?.storage?.local?.remove === "function") {
    try {
      await chrome.storage.local.remove([
        LEGACY_KEYS.SPACES,
        LEGACY_KEYS.THREADS,
        LEGACY_KEYS.COLLAPSE_ON_SPACES
      ]);
    } catch (err) {
      console.warn("Failed to remove legacy space keys:", err);
    }
  }

  return { migrated: true };
}

if (typeof globalThis !== "undefined") {
  globalThis.migrateLegacySpaceKeys = migrateLegacySpaceKeys;
}

if (typeof module !== "undefined") {
  module.exports = { migrateLegacySpaceKeys };
}
