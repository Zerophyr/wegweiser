#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const {
  scanContent,
  printFindings,
  shouldSkipFile,
  readUtf8Safe
} = require("./scan-common.js");

function runGit(command) {
  return execSync(command, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCandidateFiles() {
  const tracked = runGit("git ls-files");
  const untracked = runGit("git ls-files --others --exclude-standard");
  return [...new Set([...tracked, ...untracked])].filter((filePath) => !shouldSkipFile(filePath));
}

function main() {
  const files = getCandidateFiles();
  const findings = [];

  for (const relativePath of files) {
    const absolutePath = path.resolve(relativePath);
    const content = readUtf8Safe(absolutePath);
    if (content == null) continue;
    findings.push(...scanContent(content, relativePath));
  }

  if (findings.length > 0) {
    printFindings(findings);
    process.exit(1);
  }

  console.log(`Security scan passed. Checked ${files.length} file(s).`);
}

main();
