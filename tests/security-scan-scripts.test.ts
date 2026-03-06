export {};
const fs = require("fs");
const path = require("path");

describe("security scan scripts", () => {
  const repoScanPath = path.join(__dirname, "..", "scripts", "security", "scan-repo-secrets.js");
  const stagedScanPath = path.join(__dirname, "..", "scripts", "security", "scan-staged-secrets.js");
  const commonPath = path.join(__dirname, "..", "scripts", "security", "scan-common.js");
  const gitleaksPath = path.join(__dirname, "..", ".gitleaks.toml");

  test("scripts exist", () => {
    expect(fs.existsSync(repoScanPath)).toBe(true);
    expect(fs.existsSync(stagedScanPath)).toBe(true);
    expect(fs.existsSync(commonPath)).toBe(true);
    expect(fs.existsSync(gitleaksPath)).toBe(true);
  });

  test("common scanner contains key secret patterns", () => {
    const content = fs.readFileSync(commonPath, "utf8");
    expect(content).toMatch(/ghp_\[A-Za-z0-9\]\{36\}/);
    expect(content).toMatch(/github_pat_\[A-Za-z0-9_\]\{20,/);
    expect(content).toMatch(/sk-or-v1-\[A-Za-z0-9\]\{40,/);
    expect(content).toMatch(/PRIVATE KEY/);
  });

  test("staged scan reads git index blob content without shell interpolation", () => {
    const content = fs.readFileSync(stagedScanPath, "utf8");
    expect(content).toMatch(/execFileSync/);
    expect(content).toMatch(/execFileSync\("git",\s*\["diff",\s*"--cached",\s*"--name-only",\s*"--diff-filter=ACMR"\]/);
    expect(content).toMatch(/execFileSync\("git",\s*\["show",\s*`:\$\{filePath\}`\]/);
    expect(content).not.toMatch(/execSync\(`git show/);
  });

  test("repo scan checks tracked and untracked files", () => {
    const content = fs.readFileSync(repoScanPath, "utf8");
    expect(content).toMatch(/git ls-files/);
    expect(content).toMatch(/--others --exclude-standard/);
  });

  test("gitleaks rules include broader token coverage", () => {
    const content = fs.readFileSync(gitleaksPath, "utf8");
    expect(content).toMatch(/id = "bearer-token"/);
    expect(content).toMatch(/id = "jwt-token"/);
    expect(content).toMatch(/id = "aws-access-key-id"/);
    expect(content).toMatch(/id = "anthropic-api-key"/);
    expect(content).toMatch(/id = "openai-api-key"/);
    expect(content).toMatch(/id = "keyword-high-entropy-assignment"/);
  });
});
