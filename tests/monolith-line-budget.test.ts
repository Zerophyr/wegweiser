const fs = require("fs");
const path = require("path");

describe("monolith line budget", () => {
  const limits: Array<{ relPath: string; maxLines: number }> = [
    { relPath: "src/projects/projects.js", maxLines: 820 },
    { relPath: "src/sidepanel/sidepanel.js", maxLines: 700 },
    { relPath: "src/background/background.js", maxLines: 900 },
    { relPath: "src/options/options.js", maxLines: 850 },
    { relPath: "src/shared/chat-store.js", maxLines: 320 }
  ];

  test.each(limits)("$relPath stays <= $maxLines lines", ({ relPath, maxLines }) => {
    const filePath = path.join(__dirname, "..", relPath);
    const lineCount = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
    expect(lineCount).toBeLessThanOrEqual(maxLines);
  });
});
