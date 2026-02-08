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
  const stored = await chrome.storage.local.get([
    LEGACY_KEYS.SPACES,
    LEGACY_KEYS.THREADS,
    LEGACY_KEYS.COLLAPSE_ON_SPACES,
    NEW_KEYS.PROJECTS,
    NEW_KEYS.PROJECT_THREADS,
    NEW_KEYS.COLLAPSE_ON_PROJECTS
  ]);

  const hasNew = stored[NEW_KEYS.PROJECTS] !== undefined
    || stored[NEW_KEYS.PROJECT_THREADS] !== undefined
    || stored[NEW_KEYS.COLLAPSE_ON_PROJECTS] !== undefined;

  if (hasNew) return { migrated: false };

  const hasLegacy = stored[LEGACY_KEYS.SPACES] !== undefined
    || stored[LEGACY_KEYS.THREADS] !== undefined
    || stored[LEGACY_KEYS.COLLAPSE_ON_SPACES] !== undefined;

  if (!hasLegacy) return { migrated: false };

  await chrome.storage.local.set({
    [NEW_KEYS.PROJECTS]: stored[LEGACY_KEYS.SPACES] || [],
    [NEW_KEYS.PROJECT_THREADS]: stored[LEGACY_KEYS.THREADS] || {},
    [NEW_KEYS.COLLAPSE_ON_PROJECTS]: stored[LEGACY_KEYS.COLLAPSE_ON_SPACES]
  });

  return { migrated: true };
}

if (typeof module !== "undefined") {
  module.exports = { migrateLegacySpaceKeys };
}
