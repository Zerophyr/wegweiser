#!/usr/bin/env node
const { execSync } = require("child_process");
const {
  scanContent,
  printFindings,
  shouldSkipFile
} = require("./scan-common.js");

function getStagedFiles() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((filePath) => !shouldSkipFile(filePath));
}

function readStagedFile(filePath) {
  try {
    return execSync(`git show :"${filePath}"`, { encoding: "utf8" });
  } catch (_) {
    return null;
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log("No staged files to scan.");
    return;
  }

  const findings = [];
  for (const filePath of stagedFiles) {
    const content = readStagedFile(filePath);
    if (content == null) continue;
    findings.push(...scanContent(content, filePath));
  }

  if (findings.length > 0) {
    printFindings(findings);
    process.exit(1);
  }

  console.log(`Staged secret scan passed. Checked ${stagedFiles.length} file(s).`);
}

main();
