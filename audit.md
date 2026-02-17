# Security Audit Report: Wegweiser Extension

Audit Date: 2026-02-17
Auditor: Security Review Mode
Project: Wegweiser Chrome Extension v1.2.0

---

## Executive Summary

The critical PAT leak finding from earlier audits is remediated in the current workspace state.
Current posture is strong for secret hygiene and runtime sanitization, with remaining risk concentrated in maintainability and regression detection depth.

Findings count:
- Critical: 0
- Moderate: 2
- Low: 2
- Positive controls: 6

---

## Verified Baseline (Current State)

1. Git remote authentication is SSH-only.
   - `origin` -> `git@github.com:Zerophyr/wegweiser.git`
2. Secret scanning controls are active in-repo.
   - Pre-commit hook: `.githooks/pre-commit`
   - Local scanners: `scripts/security/scan-staged-secrets.js`, `scripts/security/scan-repo-secrets.js`
   - CI gate: `.github/workflows/security.yml`
3. Release signing env handling is hardened.
   - `scripts/release.js` validates `CWS_PRIVATE_KEY_PATH` + `CHROME_PATH` pair and path existence.
   - Logs do not print raw signing env values.
4. Sanitization and sink coverage are expanded and tested.
   - Safe HTML paths and sink inventory tests are present in `tests/safe-html-sinks.test.ts` and `tests/sink-inventory.test.ts`.
5. Monolith budgets are currently within configured thresholds.
   - `src/background/background.js`: 880 lines
   - `src/projects/projects.js`: 802 lines
   - `src/sidepanel/sidepanel.js`: 680 lines
   - `src/options/options.js`: 798 lines
   - `src/shared/chat-store.js`: 320 lines
6. Full automated test suite passed in this workspace.
   - Jest: 127/127 suites, 439/439 tests.

---

## Findings

### MODERATE-1: Remaining orchestration complexity

Affected files:
- `src/background/background.js`
- `src/projects/projects.js`
- `src/sidepanel/sidepanel.js`

Context:
Core files are now below budget, but still act as high-traffic composition roots with dense event wiring. This remains a regression-risk area when introducing future behavior changes.

Risk:
- Medium maintainability risk
- Medium chance of behavior regressions during feature work

Recommendation:
- Continue targeted extraction only where tests already exist (runtime listeners, stream lifecycle boundaries, render orchestration adapters).
- Tighten budgets incrementally only after stable test additions.

### MODERATE-2: Limited browser-level integration checks

Context:
Current integration tests are runtime-harness based and strong, but there is no browser automation smoke gate validating real extension pages end-to-end in CI.

Risk:
- Medium chance of missing DOM/runtime wiring regressions (especially across Options -> Sidepanel/Projects synchronization and stop-stream timing).

Recommendation:
- Add a minimal browser smoke suite (Playwright or equivalent) for:
  1. Options model change -> Sidepanel model sync
  2. Projects thread open + stream start/stop
  3. Model dropdown open/search/select across pages

### LOW-1: Secret history scan not enforced in CI

Context:
Working tree scans are enforced. Historical scan command exists in docs but is not currently a scheduled CI control.

Risk:
- Low operational risk (mainly for retrospective detection of accidental historic leak patterns).

Recommendation:
- Add a scheduled (weekly) CI job for optional history scan with documented handling of false positives.

### LOW-2: Residual trusted-template sink surface

Context:
High/medium-risk sinks are hardened. A small set of trusted static template paths remains by design.

Risk:
- Low direct security risk today
- Medium long-term drift risk if those paths become dynamic without tests

Recommendation:
- Keep sink inventory tests current.
- Convert remaining trusted-template paths to helper-based DOM construction opportunistically during touched-file work.

---

## Positive Security Controls

1. Encrypted sensitive storage with AES-GCM in shared crypto/storage modules.
2. Centralized HTML sanitization and sink helper usage.
3. Strict extension CSP in `manifest.json`.
4. SSH-only contributor workflow documented in `README.md`.
5. Secret scanning in pre-commit and CI workflow.
6. Release-signing path validation and non-secretive error/log behavior.

---

## Priority Improvement Backlog (Next)

P1:
1. Add browser-level CI smoke tests for Options/Sidepanel/Projects critical flows.
2. Add stream-stop disconnect/retry browser smoke assertion.

P2:
1. Add scheduled secret history scan workflow.
2. Continue low-risk sink conversion in touched modules.

P3:
1. Incrementally reduce coupling in orchestration roots where tests already cover behavior.
2. Reassess and tighten line budgets only after P1/P2 are stable.

---

## References

- `README.md`
- `SECURITY.md`
- `.github/workflows/security.yml`
- `scripts/security/scan-repo-secrets.js`
- `scripts/security/scan-staged-secrets.js`
- `scripts/release.js`
