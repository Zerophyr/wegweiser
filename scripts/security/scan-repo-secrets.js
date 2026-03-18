#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const path = require("path");
const {
  scanContent,
  printFindings,
  shouldSkipFile,
  readUtf8Safe
} = require("./scan-common.js");

function runGit(repoRoot, args) {
  return execFileSync("git", args, { encoding: "utf8", cwd: repoRoot })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCandidateFiles(repoRoot) {
  const tracked = runGit(repoRoot, ["ls-files"]);
  const untracked = runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].filter((filePath) => !shouldSkipFile(filePath));
}

function runNodeFallbackScan(repoRoot) {
  const files = getCandidateFiles(repoRoot);
  const findings = [];

  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = readUtf8Safe(absolutePath);
    if (content == null) continue;
    findings.push(...scanContent(content, relativePath));
  }

  if (findings.length > 0) {
    printFindings(findings);
    return 1;
  }

  console.log(`Security scan passed via fallback scanner. Checked ${files.length} file(s).`);
  return 0;
}

function createScanWorkspace(repoRoot) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wegweiser-secret-scan-"));
  const files = getCandidateFiles(repoRoot);

  for (const relativePath of files) {
    const sourcePath = path.join(repoRoot, relativePath);
    const destinationPath = path.join(workspaceRoot, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }

  const configPath = path.join(workspaceRoot, ".gitleaks.toml");
  fs.copyFileSync(path.join(repoRoot, ".gitleaks.toml"), configPath);

  return {
    workspaceRoot,
    configPath,
    fileCount: files.length
  };
}

function runGitleaks(repoRoot) {
  const { workspaceRoot, configPath, fileCount } = createScanWorkspace(repoRoot);
  try {
    execFileSync(
      "gitleaks",
      ["detect", "--no-git", "--source", workspaceRoot, "--config", configPath],
      { stdio: "inherit" }
    );
    console.log(`Security scan passed via gitleaks. Checked ${fileCount} file(s).`);
    return { usedGitleaks: true, exitCode: 0 };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { usedGitleaks: false, exitCode: 0 };
    }
    return {
      usedGitleaks: true,
      exitCode: typeof error.status === "number" && error.status > 0 ? error.status : 1
    };
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const gitleaksResult = runGitleaks(repoRoot);
  if (gitleaksResult.usedGitleaks) {
    if (gitleaksResult.exitCode !== 0) {
      process.exitCode = gitleaksResult.exitCode;
    }
    return;
  }
  process.exitCode = runNodeFallbackScan(repoRoot);
}

main();
