export {};
const fs = require("fs");
const path = require("path");

describe("release script scaffold", () => {
  const releasePath = path.join(__dirname, "../scripts/release.js");

  test("release script exists", () => {
    expect(fs.existsSync(releasePath)).toBe(true);
  });

  test("release script mentions dist output", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).toMatch(/dist/);
  });

  test("release script checks for clean git status", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).toMatch(/git status --porcelain/);
  });

  test("release script handles PEM cleanup and zip fallback", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).toMatch(/\.pem/);
    expect(content).toMatch(/Compress-Archive/);
  });

  test("release script validates signing env pairs and path existence", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).toMatch(/CRX signing requires both CWS_PRIVATE_KEY_PATH and CHROME_PATH/);
    expect(content).toMatch(/resolveExistingPath/);
    expect(content).toMatch(/fs\.existsSync\(resolved\)/);
  });

  test("release script does not log raw env variables", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).not.toMatch(/console\.log\([^)]*process\.env/);
    expect(content).not.toMatch(/CWS_PRIVATE_KEY_PATH=/);
    expect(content).not.toMatch(/CHROME_PATH=/);
  });

  test("release script guards TypeScript build to avoid tests-only config", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).toMatch(/shouldRunTsBuild/);
    expect(content).toMatch(/src/);
  });

  test("release script does not auto-bump versions", () => {
    const content = fs.readFileSync(releasePath, "utf8");
    expect(content).not.toMatch(/bumpVersion/);
    expect(content).not.toMatch(/Bumping version/);
  });
});
