#!/usr/bin/env node
const { execFileSync } = require("child_process");
const path = require("path");
const {
  scanContent,
  printFindings,
  shouldSkipFile,
  readUtf8Safe
} = require("./scan-common.js");

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCandidateFiles() {
  const tracked = runGit(["ls-files"]);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].filter((filePath) => !shouldSkipFile(filePath));
}

function runNodeFallbackScan() {
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

  console.log(`Security scan passed via fallback scanner. Checked ${files.length} file(s).`);
}

function runGitleaks(repoRoot) {
  const configPath = path.join(repoRoot, ".gitleaks.toml");
  try {
    execFileSync(
      "gitleaks",
      ["detect", "--no-git", "--source", repoRoot, "--config", configPath],
      { stdio: "inherit" }
    );
    console.log("Security scan passed via gitleaks.");
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    process.exit(typeof error.status === "number" && error.status > 0 ? error.status : 1);
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const usedGitleaks = runGitleaks(repoRoot);
  if (usedGitleaks) {
    return;
  }
  runNodeFallbackScan();
}

main();
