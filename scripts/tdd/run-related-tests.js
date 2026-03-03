#!/usr/bin/env node
const { spawnSync } = require("child_process");
const {
  parseArgs,
  loadConfig,
  getChangedFilesFromGit,
  getSourceFiles
} = require("./check-test-impact.js");

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const config = loadConfig(options.config);
  const changedFiles = getChangedFilesFromGit(options);
  const sourceFiles = getSourceFiles(changedFiles, config);

  if (sourceFiles.length === 0) {
    console.log("No source changes detected; skipping related tests.");
    return;
  }

  const jestArgs = ["jest", "--findRelatedTests", ...sourceFiles, "--runInBand"];
  const result = spawnSync("npx", jestArgs, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }
  process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Related test run failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  main
};
