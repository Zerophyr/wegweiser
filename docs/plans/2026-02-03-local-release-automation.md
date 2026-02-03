# Local Release Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local release script that bumps versions, requires tests to pass, and produces both Chrome Web Store upload ZIP and optional signed artifact.

**Architecture:** A Node.js release script (`scripts/release.mjs`) orchestrates test run, version bump, optional TS build, and packaging. It writes artifacts to `dist/` and supports optional signing via environment variables.

**Tech Stack:** Node.js, npm scripts, plain JS (ESM), existing Jest tests.

---

### Task 1: Add release version bump tests (TDD)

**Files:**
- Create: `tests/release-version.test.ts`
- Create: `scripts/release-utils.mjs`

**Step 1: Write the failing test**

```ts
import { bumpVersion } from "../scripts/release-utils.mjs";

describe("bumpVersion", () => {
  test("patch bump increments patch", () => {
    expect(bumpVersion("1.1.1", "patch")).toBe("1.1.2");
  });

  test("minor bump increments minor and resets patch", () => {
    expect(bumpVersion("1.1.1", "minor")).toBe("1.2.0");
  });

  test("major bump increments major and resets minor/patch", () => {
    expect(bumpVersion("1.1.1", "major")).toBe("2.0.0");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/release-version.test.ts`
Expected: FAIL because `scripts/release-utils.mjs` doesn’t exist.

**Step 3: Write minimal implementation**

```js
export function bumpVersion(version, type = "patch") {
  const parts = String(version).split(".").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error("Invalid version");
  }
  let [major, minor, patch] = parts;
  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/release-version.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/release-utils.mjs tests/release-version.test.ts
git commit -m "test: add release version bump helper"
```

---

### Task 2: Add release script (TDD for file output + dry-run)

**Files:**
- Create: `tests/release-script.test.ts`
- Create: `scripts/release.mjs`

**Step 1: Write the failing test**

```ts
const fs = require("fs");
const path = require("path");

describe("release script scaffold", () => {
  test("release script exists", () => {
    const file = path.join(__dirname, "../scripts/release.mjs");
    expect(fs.existsSync(file)).toBe(true);
  });

  test("release script mentions dist output", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../scripts/release.mjs"),
      "utf8"
    );
    expect(content).toMatch(/dist/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/release-script.test.ts`
Expected: FAIL (script missing)

**Step 3: Write minimal implementation**

Create `scripts/release.mjs` with:
- CLI parsing for `--patch`/`--minor`/`--major` and `--dry-run`
- `npm test` execution (child_process) and fail fast on non-zero
- Read `manifest.json` + `package.json`, ensure versions match
- Bump version using `bumpVersion`
- Write new versions (skip writes in `--dry-run`)
- Create `dist/` if missing
- Zip include list (manifest.json, icons/**, src/**)
- Optional signing if `CWS_PRIVATE_KEY_PATH` is set
- Output `dist/release.json`

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/release-script.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/release.mjs tests/release-script.test.ts
git commit -m "feat: add local release script"
```

---

### Task 3: Wire npm scripts + docs

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Add npm script**

Add:
```json
"release": "node scripts/release.mjs"
```

**Step 2: Update README**

Add a section “Release” describing:
- `npm run release` default patch bump
- `npm run release -- --minor|--major|--dry-run`
- Artifacts in `dist/`

**Step 3: Update CLAUDE.md**

Add a short “Release Automation” note under process/tooling.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json README.md CLAUDE.md
git commit -m "docs: add local release automation"
```

---

Plan complete and saved to `docs/plans/2026-02-03-local-release-automation.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
