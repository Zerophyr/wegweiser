const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const configPath = path.join(__dirname, "line-budget.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
  maxLines: number;
  includeGlob: string;
  excludeGlobs: string[];
  maxCharsPerLine?: number;
  longLineAllowlist?: string[];
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function shouldExclude(relPath: string, excludeGlobs: string[]): boolean {
  return excludeGlobs.some((glob) => {
    if (glob.endsWith("/**")) {
      return relPath.startsWith(glob.slice(0, -2));
    }
    return relPath === glob;
  });
}

function collectJsFiles(startDir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(startDir, { withFileTypes: true }) as Array<{
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
  }>;

  entries.forEach((entry) => {
    const fullPath = path.join(startDir, entry.name);
    const relPath = normalizePath(path.relative(repoRoot, fullPath));
    if (entry.isDirectory()) {
      if (shouldExclude(`${relPath}/`, config.excludeGlobs)) {
        return;
      }
      out.push(...collectJsFiles(fullPath));
      return;
    }
    if (entry.isFile() && fullPath.endsWith(".js") && !shouldExclude(relPath, config.excludeGlobs)) {
      out.push(relPath);
    }
  });

  return out;
}

describe("line budget", () => {
  const srcDir = path.join(repoRoot, "src");
  const files = collectJsFiles(srcDir).sort();

  test("defines long-line guard config", () => {
    expect(config.maxCharsPerLine).toBeGreaterThan(0);
    expect(Array.isArray(config.longLineAllowlist)).toBe(true);
  });

  test("tracks at least one file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)("%s stays <= max lines", (relPath: string) => {
    const filePath = path.join(repoRoot, relPath);
    const lineCount = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
    expect(lineCount).toBeLessThanOrEqual(config.maxLines);
  });

  test.each(files)("%s does not bypass budget via minified long lines", (relPath: string) => {
    const maxCharsPerLine = Number(config.maxCharsPerLine || 0);
    if (!maxCharsPerLine) return;

    const allowlist = new Set((config.longLineAllowlist || []).map((p) => normalizePath(p)));
    const filePath = path.join(repoRoot, relPath);
    const maxObserved = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .reduce((max: number, line: string) => Math.max(max, line.length), 0);

    if (allowlist.has(relPath)) {
      expect(maxObserved).toBeGreaterThan(maxCharsPerLine);
      return;
    }

    expect(maxObserved).toBeLessThanOrEqual(maxCharsPerLine);
  });

  test("long-line allowlist only contains tracked JS files", () => {
    const allowlist = (config.longLineAllowlist || []).map((p) => normalizePath(p));
    allowlist.forEach((entry) => {
      expect(files).toContain(entry);
    });
  });
});
