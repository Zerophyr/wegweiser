export {};
const fs = require("fs");
const path = require("path");

describe("security scan scripts", () => {
  const repoScanPath = path.join(__dirname, "..", "scripts", "security", "scan-repo-secrets.js");
  const stagedScanPath = path.join(__dirname, "..", "scripts", "security", "scan-staged-secrets.js");
  const commonPath = path.join(__dirname, "..", "scripts", "security", "scan-common.js");
  const workflowPath = path.join(__dirname, "..", ".github", "workflows", "security.yml");
  const historyWorkflowPath = path.join(__dirname, "..", ".github", "workflows", "security-history.yml");
  const gitleaksPath = path.join(__dirname, "..", ".gitleaks.toml");

  test("scripts and workflow exist", () => {
    expect(fs.existsSync(repoScanPath)).toBe(true);
    expect(fs.existsSync(stagedScanPath)).toBe(true);
    expect(fs.existsSync(commonPath)).toBe(true);
    expect(fs.existsSync(workflowPath)).toBe(true);
    expect(fs.existsSync(historyWorkflowPath)).toBe(true);
    expect(fs.existsSync(gitleaksPath)).toBe(true);
  });

  test("common scanner contains expanded key patterns for local fallback scans", () => {
    const content = fs.readFileSync(commonPath, "utf8");
    expect(content).toMatch(/ghp_\[A-Za-z0-9\]\{36\}/);
    expect(content).toMatch(/github_pat_\[A-Za-z0-9_\]\{20,/);
    expect(content).toMatch(/sk-or-v1-\[A-Za-z0-9\]\{40,/);
    expect(content).toMatch(/Bearer/);
    expect(content).toMatch(/AKIA/);
    expect(content).toMatch(/sk-ant-/);
    expect(content).toMatch(/sk-\(\?:proj\|live\|test\)/);
    expect(content).toMatch(/PRIVATE KEY/);
  });

  test("staged scan reads git index blob content without shell interpolation", () => {
    const content = fs.readFileSync(stagedScanPath, "utf8");
    expect(content).toMatch(/execFileSync/);
    expect(content).toMatch(/execFileSync\("git",\s*\["diff",\s*"--cached",\s*"--name-only",\s*"--diff-filter=ACMR"\]/);
    expect(content).toMatch(/execFileSync\("git",\s*\["show",\s*`:\$\{filePath\}`\]/);
    expect(content).not.toMatch(/execSync\(`git show/);
  });

  test("repo scan prefers gitleaks with the tracked config and cleans up temp workspaces", () => {
    const content = fs.readFileSync(repoScanPath, "utf8");
    expect(content).toMatch(/gitleaks/);
    expect(content).toMatch(/--config/);
    expect(content).toMatch(/\.gitleaks\.toml/);
    expect(content).toMatch(/--no-git/);
    expect(content).toMatch(/--source/);
    expect(content).toMatch(/mkdtempSync/);
    expect(content).toMatch(/fs\.rmSync/);
    expect(content).not.toMatch(/process\.exit\(/);
  });

  test("security workflow installs gitleaks via Go and runs the repository scan", () => {
    const content = fs.readFileSync(workflowPath, "utf8");
    expect(content).toMatch(/npm run security:scan/);
    expect(content).toMatch(/actions\/setup-go@/);
    expect(content).toMatch(/go install github\.com\/gitleaks\/gitleaks\/v8@v8\.24\.3/);
    expect(content).not.toMatch(/curl -sSL .*gitleaks/);
  });


  test("history workflow also installs gitleaks via Go and uses the tracked config", () => {
    const content = fs.readFileSync(historyWorkflowPath, "utf8");
    expect(content).toMatch(/actions\/setup-go@/);
    expect(content).toMatch(/go install github\.com\/gitleaks\/gitleaks\/v8@v8\.24\.3/);
    expect(content).toMatch(/--config \.gitleaks\.toml/);
    expect(content).not.toMatch(/curl -sSL .*gitleaks/);
  });

  test("gitleaks rules include broader token coverage without a blanket tests allowlist", () => {
    const content = fs.readFileSync(gitleaksPath, "utf8");
    expect(content).toMatch(/id = "bearer-token"/);
    expect(content).toMatch(/id = "jwt-token"/);
    expect(content).toMatch(/id = "aws-access-key-id"/);
    expect(content).toMatch(/id = "anthropic-api-key"/);
    expect(content).toMatch(/id = "openai-api-key"/);
    expect(content).toMatch(/id = "keyword-high-entropy-assignment"/);
    expect(content).not.toMatch(/'''tests\/\.\*'''/);
    expect(content).toMatch(/SMOKE_TEST_KEY_PLACEHOLDER/);
  });
});
