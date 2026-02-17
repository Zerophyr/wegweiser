export {};
const fs = require("fs");
const path = require("path");

function readFile(relPath: string) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

function getInnerHtmlTargets(content: string) {
  const targets = new Set<string>();
  const regex = /([A-Za-z0-9_$.]+)\.innerHTML\s*=/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    targets.add(match[1]);
  }
  return [...targets].sort();
}

describe("sink inventory", () => {
  const sinkClasses: Array<{ relPath: string; sinkClass: string; expectedTargets: string[] }> = [
    {
      relPath: "src/sidepanel/sidepanel-prompt-controller-utils.js",
      sinkClass: "safe-helper",
      expectedTargets: []
    },
    {
      relPath: "src/sidepanel/sidepanel-summarize-controller-utils.js",
      sinkClass: "safe-helper",
      expectedTargets: []
    },
    {
      relPath: "src/modules/context-viz.js",
      sinkClass: "safe-helper",
      expectedTargets: []
    },
    {
      relPath: "src/modules/sources.js",
      sinkClass: "safe-helper",
      expectedTargets: []
    },
    {
      relPath: "src/projects/projects-stream-utils.js",
      sinkClass: "trusted-static-template",
      expectedTargets: ["messageDiv", "ui.content"]
    },
    {
      relPath: "src/projects/projects-message-flow-utils.js",
      sinkClass: "trusted-static-template",
      expectedTargets: ["tempWrapper"]
    },
    {
      relPath: "src/projects/projects-archive-view-utils.js",
      sinkClass: "safe-helper",
      expectedTargets: []
    },
    {
      relPath: "src/projects/projects-render-controller-utils.js",
      sinkClass: "trusted-render-orchestration",
      expectedTargets: ["chatMessagesEl", "deps.elements.ProjectsGrid", "deps.elements.threadList"]
    },
    {
      relPath: "src/projects/projects.js",
      sinkClass: "orchestration-no-direct-innerhtml",
      expectedTargets: []
    },
    {
      relPath: "src/projects/projects-model-select-utils.js",
      sinkClass: "dom-only-options-render",
      expectedTargets: []
    }
  ];

  test.each(sinkClasses)("$relPath is classified as $sinkClass", ({ relPath, expectedTargets }) => {
    const content = readFile(relPath);
    expect(getInnerHtmlTargets(content)).toEqual(expectedTargets.sort());
  });

  test("clear-only paths avoid innerHTML writes", () => {
    const projectsImages = readFile("src/projects/projects-image-utils.js");
    const sidepanelPersistence = readFile("src/sidepanel/sidepanel-answer-persistence-controller-utils.js");

    expect(getInnerHtmlTargets(projectsImages)).toEqual([]);
    expect(getInnerHtmlTargets(sidepanelPersistence)).toEqual([]);
    expect(projectsImages).toMatch(/replaceChildren\(\)/);
    expect(sidepanelPersistence).toMatch(/answerEl\.replaceChildren\(\)/);
  });
});