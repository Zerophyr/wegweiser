#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const METRICS = ["statements", "branches", "functions", "lines"];

const defaultConfig = {
  includeGlobs: ["src/**/*.js"],
  excludeGlobs: ["src/lib/**", "src/image-viewer/**"],
  newFileMin: {
    statements: 40,
    branches: 25,
    functions: 35,
    lines: 40
  },
  ratchetStep: {
    statements: 5,
    branches: 3,
    functions: 5,
    lines: 5
  },
  priorityThresholds: {
    "src/projects/projects-events-controller-utils.js": { statements: 45, branches: 22, functions: 30, lines: 47 },
    "src/projects/projects-ui-controller-utils.js": { statements: 63, branches: 36, functions: 70, lines: 67 },
    "src/projects/projects-storage-controller-utils.js": { statements: 33, branches: 28, functions: 21, lines: 35 },
    "src/projects/projects-modal-controller-utils.js": { statements: 25, branches: 19, functions: 29, lines: 26 },
    "src/sidepanel/sidepanel-prompt-controller-utils.js": { statements: 32, branches: 22, functions: 24, lines: 35 },
    "src/modules/sources.js": { statements: 85, branches: 60, functions: 80, lines: 89 },
    "src/shared/utils.js": { statements: 50, branches: 45, functions: 50, lines: 55 }
  }
};

function normalizePath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function roundPct(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function parseArgs(argv) {
  const options = {
    staged: false,
    base: null,
    head: null,
    config: null,
    coverage: "coverage/coverage-summary.json",
    baseline: "tests/coverage-baseline.json",
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
      continue;
    }
    if (arg === "--coverage") {
      options.coverage = argv[i + 1] || options.coverage;
      i += 1;
      continue;
    }
    if (arg === "--baseline") {
      options.baseline = argv[i + 1] || options.baseline;
      i += 1;
    }
  }

  return options;
}

function readJson(filePath, fallback = null) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    if (fallback !== null) return fallback;
    throw new Error(`Missing JSON file: ${resolved}`);
  }

  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse JSON at ${resolved}: ${error.message}`);
  }
}

function loadConfig(configPath) {
  const resolved = configPath
    ? path.resolve(configPath)
    : path.resolve(__dirname, "..", "..", "tests", "coverage-ratchet.config.json");

  if (!fs.existsSync(resolved)) {
    return { ...defaultConfig };
  }

  const parsed = readJson(resolved, {});
  return {
    ...defaultConfig,
    ...parsed,
    includeGlobs: Array.isArray(parsed.includeGlobs) ? parsed.includeGlobs : [...defaultConfig.includeGlobs],
    excludeGlobs: Array.isArray(parsed.excludeGlobs) ? parsed.excludeGlobs : [...defaultConfig.excludeGlobs],
    newFileMin: {
      ...defaultConfig.newFileMin,
      ...(parsed.newFileMin || {})
    },
    ratchetStep: {
      ...defaultConfig.ratchetStep,
      ...(parsed.ratchetStep || {})
    },
    priorityThresholds: {
      ...defaultConfig.priorityThresholds,
      ...(parsed.priorityThresholds || {})
    }
  };
}

function globToRegex(pattern) {
  const normalized = normalizePath(pattern);
  let regex = "^";
  let index = 0;

  while (index < normalized.length) {
    const nextThree = normalized.slice(index, index + 3);
    const nextTwo = normalized.slice(index, index + 2);
    const char = normalized[index];

    if (nextThree === "**/") {
      regex += "(?:.*/)?";
      index += 3;
      continue;
    }

    if (nextTwo === "**") {
      regex += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      regex += "[^/]*";
      index += 1;
      continue;
    }

    if (/[|\\{}()[\]^$+?.]/.test(char)) {
      regex += `\\${char}`;
    } else {
      regex += char;
    }
    index += 1;
  }

  regex += "$";
  return new RegExp(regex, "i");
}

function matchesAnyGlob(filePath, globs) {
  const normalized = normalizePath(filePath);
  return (globs || []).some((glob) => globToRegex(glob).test(normalized));
}

function fileIncluded(filePath, config) {
  const normalized = normalizePath(filePath);
  if (!matchesAnyGlob(normalized, config.includeGlobs)) return false;
  if (matchesAnyGlob(normalized, config.excludeGlobs)) return false;
  return true;
}

function toRepoRelative(filePath) {
  if (!filePath) return "";
  const normalized = normalizePath(filePath);
  if (!path.isAbsolute(normalized)) return normalized;
  const relative = path.relative(process.cwd(), normalized);
  return normalizePath(relative);
}

function collectCoverageMap(summaryJson) {
  const map = {};
  Object.entries(summaryJson || {}).forEach(([key, metrics]) => {
    const filePath = toRepoRelative(key);
    if (!filePath || filePath === "total") return;
    if (!metrics || typeof metrics !== "object") return;

    const entry = {};
    METRICS.forEach((metric) => {
      const pct = metrics?.[metric]?.pct;
      entry[metric] = roundPct(Number(pct));
    });
    map[filePath] = entry;
  });
  return map;
}

function getChangedFilesFromGit(options = {}, execFn = execSync) {
  const staged = options.staged === true;
  const base = options.base || process.env.COVERAGE_BASE || process.env.GITHUB_BASE_SHA || null;
  const head = options.head || process.env.COVERAGE_HEAD || process.env.GITHUB_SHA || null;

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

function compareMetric(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return actual + 0.001 >= expected;
}

function evaluateRatchet({ coverage = {}, baseline = {}, changedFiles = [], config = defaultConfig }) {
  const failures = [];
  const warnings = [];
  const checkedChangedFiles = [];

  const normalizedChanged = [...new Set((changedFiles || []).map((file) => normalizePath(file)).filter(Boolean))];

  normalizedChanged.forEach((file) => {
    if (!fileIncluded(file, config)) return;
    checkedChangedFiles.push(file);

    const measured = coverage[file];
    const baselineMetrics = baseline[file];
    if (!measured) {
      if (baselineMetrics) {
        failures.push(`${file}: missing coverage entry in coverage summary.`);
      } else {
        warnings.push(`${file}: missing coverage entry; skipping no-regression check.`);
      }
      return;
    }

    if (baselineMetrics) {
      METRICS.forEach((metric) => {
        const expected = Number(baselineMetrics[metric]);
        const actual = Number(measured[metric]);
        if (!compareMetric(actual, expected)) {
          failures.push(`${file}: ${metric} ${actual}% is below baseline ${expected}%.`);
        }
      });
      return;
    }

    METRICS.forEach((metric) => {
      const minimum = Number(config.newFileMin?.[metric]);
      const actual = Number(measured[metric]);
      if (!compareMetric(actual, minimum)) {
        failures.push(`${file}: ${metric} ${actual}% is below new-file minimum ${minimum}%.`);
      }
    });
  });

  Object.entries(config.priorityThresholds || {}).forEach(([file, thresholds]) => {
    const normalizedFile = normalizePath(file);
    if (!fileIncluded(normalizedFile, config)) return;

    const measured = coverage[normalizedFile];
    if (!measured) {
      failures.push(`${normalizedFile}: missing coverage entry for priority floor check.`);
      return;
    }

    METRICS.forEach((metric) => {
      const floor = Number(thresholds?.[metric]);
      const actual = Number(measured[metric]);
      if (!compareMetric(actual, floor)) {
        failures.push(`${normalizedFile}: ${metric} ${actual}% is below priority floor ${floor}%.`);
      }
    });
  });

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    checkedChangedFiles
  };
}

function formatResult(result) {
  if (result.ok) {
    const scopeLine = result.checkedChangedFiles.length > 0
      ? `Checked changed files: ${result.checkedChangedFiles.length}.`
      : "No included changed files detected; priority floors verified.";
    return `Coverage ratchet passed.\n${scopeLine}`;
  }

  return [
    "Coverage ratchet failed:",
    ...result.failures.map((line) => `  - ${line}`)
  ].join("\n");
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const config = loadConfig(options.config);
  const coverageSummary = readJson(options.coverage);
  const baseline = readJson(options.baseline, {});

  const coverage = collectCoverageMap(coverageSummary);
  const changedFiles = getChangedFilesFromGit(options);
  const result = evaluateRatchet({ coverage, baseline, changedFiles, config });

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
    console.error(`Coverage ratchet check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  METRICS,
  defaultConfig,
  normalizePath,
  parseArgs,
  readJson,
  loadConfig,
  globToRegex,
  matchesAnyGlob,
  fileIncluded,
  collectCoverageMap,
  getChangedFilesFromGit,
  evaluateRatchet,
  formatResult
};
