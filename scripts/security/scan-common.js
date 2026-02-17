const fs = require("fs");
const path = require("path");

const SECRET_PATTERNS = [
  {
    name: "GitHub classic PAT",
    regex: /\bghp_[A-Za-z0-9]{36}\b/g
  },
  {
    name: "GitHub fine-grained PAT",
    regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g
  },
  {
    name: "Git credentials in URL",
    regex: /https?:\/\/[^\s\/@:]+:[^\s\/@]+@github\.com/gi
  },
  {
    name: "Private key material",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  },
  {
    name: "Hardcoded secret assignment",
    regex: /\b(?:api[_-]?key|token|secret|password|passwd)\b\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/gi
  }
];

const DEFAULT_IGNORES = [
  ".git/",
  "node_modules/",
  "dist/",
  "coverage/",
  "build/",
  "icons/",
  ".worktrees/"
];

function shouldSkipFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized) return true;
  if (DEFAULT_IGNORES.some((prefix) => normalized.startsWith(prefix))) return true;
  if (normalized.endsWith(".png") || normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".gif") || normalized.endsWith(".ico")) {
    return true;
  }
  return false;
}

function redact(value) {
  if (!value) return "[redacted]";
  const str = String(value);
  if (str.length <= 8) return "[redacted]";
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

function scanContent(content, filePath) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const index = match.index;
      const before = content.slice(0, index);
      const lineNumber = before.split(/\r?\n/).length;
      const lineText = lines[lineNumber - 1] || "";
      findings.push({
        filePath,
        lineNumber,
        type: pattern.name,
        snippet: redact(match[0]),
        lineText: lineText.trim()
      });
    }
  }

  return findings;
}

function printFindings(findings) {
  if (findings.length === 0) return;
  console.error(`\nSecret scan failed. Found ${findings.length} potential secret(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.filePath}:${finding.lineNumber} [${finding.type}] ${finding.snippet}`);
    if (finding.lineText) {
      console.error(`  ${finding.lineText}`);
    }
  }
  console.error("\nRemediation: remove the secret, rotate credentials, and run security scan again.");
}

function readUtf8Safe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return null;
  }
}

module.exports = {
  scanContent,
  printFindings,
  shouldSkipFile,
  readUtf8Safe
};
