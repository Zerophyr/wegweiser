#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  METRICS,
  normalizePath,
  readJson,
  loadConfig,
  collectCoverageMap
} = require("./check-ratchet.js");

function parseArgs(argv) {
  const options = {
    config: null,
    coverage: "coverage/coverage-summary.json"
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
    }
  }

  return options;
}

function roundPct(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function ratchetThresholds(config, coverageMap) {
  const next = JSON.parse(JSON.stringify(config || {}));
  next.priorityThresholds = next.priorityThresholds || {};
  next.ratchetStep = next.ratchetStep || {};

  Object.keys(next.priorityThresholds)
    .sort()
    .forEach((file) => {
      const normalized = normalizePath(file);
      const current = next.priorityThresholds[file] || {};
      const measured = coverageMap[normalized] || {};

      METRICS.forEach((metric) => {
        const currentValue = Number(current[metric] || 0);
        const step = Number(next.ratchetStep[metric] || 0);
        const measuredValue = Number(measured[metric]);
        if (!Number.isFinite(measuredValue)) {
          current[metric] = roundPct(currentValue);
          return;
        }
        const target = Math.min(measuredValue, currentValue + step);
        current[metric] = roundPct(Math.max(currentValue, target));
      });

      next.priorityThresholds[file] = current;
    });

  return next;
}

function writeConfig(configPath, config) {
  const resolved = configPath
    ? path.resolve(configPath)
    : path.resolve(__dirname, "..", "..", "tests", "coverage-ratchet.config.json");
  fs.writeFileSync(resolved, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return resolved;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const config = loadConfig(options.config);
  const coverageSummary = readJson(options.coverage);
  const coverageMap = collectCoverageMap(coverageSummary);
  const nextConfig = ratchetThresholds(config, coverageMap);
  const outPath = writeConfig(options.config, nextConfig);
  console.log(`Coverage priority thresholds ratcheted in ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Failed to ratchet priority thresholds: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  ratchetThresholds,
  writeConfig
};
