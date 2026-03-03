#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const defaultConfig = {
  sourceRoot: "src/",
  testRoot: "tests/",
  ignoredSourceGlobs: [
    "src/lib/**",
    "src/image-viewer/**"
  ],
  alwaysRelatedTestGlobs: [
    "tests/browser/**",
    "tests/**/*.integration.test.ts"
  ],
  areaAliases: {
    background: ["background", "runtime"],
    sidepanel: ["sidepanel", "runtime"],
    projects: ["projects", "runtime"],
    options: ["options", "runtime", "provider", "model"],
    modules: ["markdown", "models", "model", "provider", "toast", "source", "sources", "stream", "reasoning", "runtime", "safe"],
    shared: ["chat", "store", "encrypted", "crypto", "image", "utils", "runtime"],
    "image-viewer": ["image", "viewer", "runtime"]
  }
};

function normalizePath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function parseArgs(argv) {
  const options = {
    staged: false,
    base: null,
    head: null,
    config: null,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--staged") {
      options.staged = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--base") {
      options.base = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--head") {
      options.head = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--config") {
      options.config = argv[i + 1] || null;
      i += 1;
    }
  }

  return options;
}

function mergeConfig(base, loaded) {
  const merged = {
    ...base,
    ...loaded
  };

  merged.ignoredSourceGlobs = Array.isArray(loaded.ignoredSourceGlobs)
    ? loaded.ignoredSourceGlobs
    : [...base.ignoredSourceGlobs];
  merged.alwaysRelatedTestGlobs = Array.isArray(loaded.alwaysRelatedTestGlobs)
    ? loaded.alwaysRelatedTestGlobs
    : [...base.alwaysRelatedTestGlobs];
  merged.areaAliases = {
    ...base.areaAliases,
    ...(loaded.areaAliases || {})
  };

  return merged;
}

function loadConfig(configPath) {
  const resolved = configPath
    ? path.resolve(configPath)
    : path.resolve(__dirname, "tdd-check.config.json");

  if (!fs.existsSync(resolved)) {
    return { ...defaultConfig };
  }

  try {
    const raw = fs.readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw);
    return mergeConfig(defaultConfig, parsed);
  } catch (error) {
    throw new Error(`Failed to read TDD config at ${resolved}: ${error.message}`);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern) {
  const normalized = normalizePath(pattern);
  const withPlaceholder = normalized.replace(/\*\*/g, "__DOUBLE_STAR__");
  const escaped = escapeRegex(withPlaceholder).replace(/\*/g, "[^/]*").replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesAnyGlob(filePath, globs) {
  const normalized = normalizePath(filePath);
  return globs.some((pattern) => globToRegex(pattern).test(normalized));
}

function getChangedFilesFromGit(options = {}, execFn = execSync) {
  const staged = options.staged === true;
  const base = options.base || process.env.TDD_BASE || process.env.GITHUB_BASE_SHA || null;
  const head = options.head || process.env.TDD_HEAD || process.env.GITHUB_SHA || null;

  let command = "";
  if (staged) {
    command = "git diff --cached --name-only --diff-filter=ACMR";
  } else if (base && head) {
    command = `git diff --name-only ${base}...${head} --diff-filter=ACMR`;
  } else {
    command = "git diff --name-only HEAD~1...HEAD --diff-filter=ACMR";
  }

  const output = execFn(command, { encoding: "utf8" });
  return String(output)
    .split(/\r?\n/)
    .map((line) => normalizePath(line))
    .filter(Boolean);
}

function getSourceArea(filePath, config) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(config.sourceRoot)) return null;
  const remainder = normalized.slice(config.sourceRoot.length);
  const [area] = remainder.split("/");
  return area || null;
}

function getSourceFiles(changedFiles, config) {
  return changedFiles
    .map((file) => normalizePath(file))
    .filter((file) => file.startsWith(config.sourceRoot))
    .filter((file) => !matchesAnyGlob(file, config.ignoredSourceGlobs));
}

function getIgnoredSourceFiles(changedFiles, config) {
  return changedFiles
    .map((file) => normalizePath(file))
    .filter((file) => file.startsWith(config.sourceRoot))
    .filter((file) => matchesAnyGlob(file, config.ignoredSourceGlobs));
}

function getTestFiles(changedFiles, config) {
  return changedFiles
    .map((file) => normalizePath(file))
    .filter((file) => file.startsWith(config.testRoot));
}

function getAreaAliases(area, config) {
  const aliases = new Set([area]);
  const configured = config.areaAliases?.[area];
  if (Array.isArray(configured)) {
    configured.forEach((entry) => aliases.add(String(entry).toLowerCase()));
  }
  return [...aliases];
}

function getTestTokenSet(testFile) {
  const normalized = normalizePath(testFile).toLowerCase();
  const baseName = normalized.split("/").pop() || normalized;
  const tokenSet = new Set(baseName.split(/[^a-z0-9]+/).filter(Boolean));

  normalized
    .split("/")
    .forEach((segment) => {
      segment
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .forEach((token) => tokenSet.add(token));
    });

  return tokenSet;
}

function isAlwaysRelatedTest(testFile, config) {
  return matchesAnyGlob(testFile, config.alwaysRelatedTestGlobs);
}

function isRelatedTestForAreas(testFile, sourceAreas, config) {
  if (isAlwaysRelatedTest(testFile, config)) return true;

  const tokens = getTestTokenSet(testFile);
  for (const area of sourceAreas) {
    const aliases = getAreaAliases(area, config);
    if (aliases.some((alias) => tokens.has(alias.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

function evaluateImpact(changedFiles, config = defaultConfig) {
  const normalizedChanged = (Array.isArray(changedFiles) ? changedFiles : [])
    .map((file) => normalizePath(file))
    .filter(Boolean);

  const sourceFiles = getSourceFiles(normalizedChanged, config);
  const ignoredSourceFiles = getIgnoredSourceFiles(normalizedChanged, config);
  const testFiles = getTestFiles(normalizedChanged, config);

  if (sourceFiles.length === 0) {
    if (ignoredSourceFiles.length > 0) {
      return {
        ok: true,
        reason: "All source changes are ignored by config.",
        sourceFiles,
        ignoredSourceFiles,
        testFiles,
        relatedTestFiles: []
      };
    }

    return {
      ok: true,
      reason: "No source changes detected.",
      sourceFiles,
      ignoredSourceFiles,
      testFiles,
      relatedTestFiles: []
    };
  }

  if (testFiles.length === 0) {
    return {
      ok: false,
      reason: "No test changes detected for source changes.",
      sourceFiles,
      ignoredSourceFiles,
      testFiles,
      relatedTestFiles: []
    };
  }

  const sourceAreas = [...new Set(sourceFiles.map((file) => getSourceArea(file, config)).filter(Boolean))];
  const relatedTestFiles = testFiles.filter((testFile) => isRelatedTestForAreas(testFile, sourceAreas, config));

  if (relatedTestFiles.length === 0) {
    return {
      ok: false,
      reason: "No related test changes detected for touched source areas.",
      sourceFiles,
      ignoredSourceFiles,
      testFiles,
      sourceAreas,
      relatedTestFiles
    };
  }

  return {
    ok: true,
    reason: "Related test changes detected.",
    sourceFiles,
    ignoredSourceFiles,
    testFiles,
    sourceAreas,
    relatedTestFiles
  };
}

function formatResult(result) {
  const lines = [result.reason];

  if (Array.isArray(result.sourceAreas) && result.sourceAreas.length > 0) {
    lines.push(`Source areas: ${result.sourceAreas.join(", ")}`);
  }

  if (Array.isArray(result.sourceFiles) && result.sourceFiles.length > 0) {
    lines.push(`Source files (${result.sourceFiles.length}):`);
    result.sourceFiles.forEach((file) => lines.push(`  - ${file}`));
  }

  if (Array.isArray(result.testFiles) && result.testFiles.length > 0) {
    lines.push(`Test files changed (${result.testFiles.length}):`);
    result.testFiles.forEach((file) => lines.push(`  - ${file}`));
  }

  if (Array.isArray(result.relatedTestFiles) && result.relatedTestFiles.length > 0) {
    lines.push(`Related tests (${result.relatedTestFiles.length}):`);
    result.relatedTestFiles.forEach((file) => lines.push(`  - ${file}`));
  }

  return lines.join("\n");
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const config = loadConfig(options.config);
  const changedFiles = getChangedFilesFromGit(options);
  const result = evaluateImpact(changedFiles, config);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatResult(result));
  }

  if (!result.ok) {
    process.exit(1);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`TDD check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  defaultConfig,
  normalizePath,
  parseArgs,
  loadConfig,
  getChangedFilesFromGit,
  getSourceFiles,
  getTestFiles,
  evaluateImpact,
  isRelatedTestForAreas,
  isAlwaysRelatedTest,
  formatResult
};
