#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  METRICS,
  normalizePath,
  readJson,
  loadConfig,
  collectCoverageMap,
  fileIncluded
} = require("./check-ratchet.js");

function parseArgs(argv) {
  const options = {
    config: null,
    coverage: "coverage/coverage-summary.json",
    out: "tests/coverage-baseline.json"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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
    if (arg === "--out") {
      options.out = argv[i + 1] || options.out;
      i += 1;
    }
  }

  return options;
}

function buildBaselineMap(summaryJson, config) {
  const coverageMap = collectCoverageMap(summaryJson);
  const baseline = {};

  Object.keys(coverageMap)
    .map((file) => normalizePath(file))
    .sort()
    .forEach((file) => {
      if (!fileIncluded(file, config)) return;
      const entry = {};
      METRICS.forEach((metric) => {
        entry[metric] = Number(coverageMap[file][metric]);
      });
      baseline[file] = entry;
    });

  return baseline;
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parentDir = path.dirname(resolved);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const config = loadConfig(options.config);
  const coverageSummary = readJson(options.coverage);
  const baseline = buildBaselineMap(coverageSummary, config);
  const outputPath = writeJson(options.out, baseline);
  console.log(`Coverage baseline updated: ${outputPath} (${Object.keys(baseline).length} files)`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Failed to update coverage baseline: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  buildBaselineMap,
  writeJson
};
