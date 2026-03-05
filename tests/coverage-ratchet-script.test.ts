export {};

const path = require("path");

const checkPath = path.join(__dirname, "..", "scripts", "coverage", "check-ratchet.js");
const updatePath = path.join(__dirname, "..", "scripts", "coverage", "update-baseline.js");
const ratchetPath = path.join(__dirname, "..", "scripts", "coverage", "ratchet-priority-thresholds.js");

const {
  evaluateRatchet,
  collectCoverageMap
} = require(checkPath);
const {
  buildBaselineMap
} = require(updatePath);
const {
  ratchetThresholds
} = require(ratchetPath);

function metric(pct: number) {
  return { pct };
}

describe("coverage ratchet scripts", () => {
  test("changed file dropping below baseline fails", () => {
    const coverage = {
      "src/shared/utils.js": { statements: 48, branches: 44, functions: 50, lines: 54 }
    };
    const baseline = {
      "src/shared/utils.js": { statements: 50, branches: 45, functions: 50, lines: 55 }
    };
    const config = {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"],
      priorityThresholds: {},
      newFileMin: { statements: 40, branches: 25, functions: 35, lines: 40 }
    };

    const result = evaluateRatchet({ coverage, baseline, changedFiles: ["src/shared/utils.js"], config });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/below baseline/i);
  });

  test("changed file meeting baseline passes", () => {
    const coverage = {
      "src/shared/utils.js": { statements: 50, branches: 45, functions: 50, lines: 55 }
    };
    const baseline = {
      "src/shared/utils.js": { statements: 50, branches: 45, functions: 50, lines: 55 }
    };
    const config = {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"],
      priorityThresholds: {},
      newFileMin: { statements: 40, branches: 25, functions: 35, lines: 40 }
    };

    const result = evaluateRatchet({ coverage, baseline, changedFiles: ["src/shared/utils.js"], config });
    expect(result.ok).toBe(true);
  });

  test("unchanged file below baseline does not fail no-regression check", () => {
    const coverage = {
      "src/shared/utils.js": { statements: 40, branches: 30, functions: 30, lines: 40 },
      "src/projects/projects.js": { statements: 20, branches: 10, functions: 10, lines: 20 }
    };
    const baseline = {
      "src/shared/utils.js": { statements: 50, branches: 45, functions: 50, lines: 55 },
      "src/projects/projects.js": { statements: 20, branches: 10, functions: 10, lines: 20 }
    };
    const config = {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"],
      priorityThresholds: {},
      newFileMin: { statements: 40, branches: 25, functions: 35, lines: 40 }
    };

    const result = evaluateRatchet({ coverage, baseline, changedFiles: ["src/projects/projects.js"], config });
    expect(result.ok).toBe(true);
  });

  test("priority module below floor fails", () => {
    const coverage = {
      "src/projects/projects-events-controller-utils.js": { statements: 40, branches: 20, functions: 25, lines: 44 }
    };
    const baseline = {};
    const config = {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"],
      priorityThresholds: {
        "src/projects/projects-events-controller-utils.js": { statements: 45, branches: 22, functions: 30, lines: 47 }
      },
      newFileMin: { statements: 40, branches: 25, functions: 35, lines: 40 }
    };

    const result = evaluateRatchet({ coverage, baseline, changedFiles: [], config });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/priority floor/i);
  });

  test("changed new file below minimum fails", () => {
    const coverage = {
      "src/new-file.js": { statements: 30, branches: 20, functions: 20, lines: 30 }
    };
    const baseline = {};
    const config = {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"],
      priorityThresholds: {},
      newFileMin: { statements: 40, branches: 25, functions: 35, lines: 40 }
    };

    const result = evaluateRatchet({ coverage, baseline, changedFiles: ["src/new-file.js"], config });
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toMatch(/new-file minimum/i);
  });

  test("excluded path is ignored", () => {
    const coverage = {
      "src/lib/vendor.js": { statements: 0, branches: 0, functions: 0, lines: 0 }
    };
    const baseline = {
      "src/lib/vendor.js": { statements: 90, branches: 90, functions: 90, lines: 90 }
    };
    const config = {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"],
      priorityThresholds: {},
      newFileMin: { statements: 40, branches: 25, functions: 35, lines: 40 }
    };

    const result = evaluateRatchet({ coverage, baseline, changedFiles: ["src/lib/vendor.js"], config });
    expect(result.ok).toBe(true);
  });

  test("buildBaselineMap creates deterministic file metrics map", () => {
    const summary = {
      total: { lines: metric(60), statements: metric(60), functions: metric(60), branches: metric(40) },
      "src/z.js": { lines: metric(75.4), statements: metric(80.1), functions: metric(67.7), branches: metric(55.55) },
      "src/a.js": { lines: metric(50.2), statements: metric(51.9), functions: metric(40), branches: metric(30.1) }
    };

    const baseline = buildBaselineMap(summary, {
      includeGlobs: ["src/**/*.js"],
      excludeGlobs: ["src/lib/**"]
    });

    expect(Object.keys(baseline)).toEqual(["src/a.js", "src/z.js"]);
    expect(baseline["src/z.js"].lines).toBe(75.4);
  });

  test("ratchetThresholds bumps floors but does not exceed measured coverage", () => {
    const config = {
      ratchetStep: { statements: 5, branches: 3, functions: 5, lines: 5 },
      priorityThresholds: {
        "src/shared/utils.js": { statements: 50, branches: 45, functions: 50, lines: 55 }
      }
    };

    const coverage = {
      "src/shared/utils.js": { statements: 52, branches: 46, functions: 80, lines: 57 }
    };

    const next = ratchetThresholds(config, coverage);
    expect(next.priorityThresholds["src/shared/utils.js"]).toEqual({
      statements: 52,
      branches: 46,
      functions: 55,
      lines: 57
    });
  });

  test("collectCoverageMap converts jest summary shape", () => {
    const summary = {
      total: { lines: metric(1), statements: metric(1), functions: metric(1), branches: metric(1) },
      "src/shared/utils.js": {
        lines: metric(55.55),
        statements: metric(50.01),
        functions: metric(49.99),
        branches: metric(40.4)
      }
    };

    const map = collectCoverageMap(summary);
    expect(map["src/shared/utils.js"]).toEqual({
      statements: 50.01,
      branches: 40.4,
      functions: 49.99,
      lines: 55.55
    });
  });
});
