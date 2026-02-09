export {};
let projectsLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  buildProjectsContextData?: (thread: any) => {
    summary: string;
    liveMessages: any[];
    archivedMessages: any[];
  };
  buildContextBadgeLabel?: (contextSize: number) => string;
};

function loadProjects() {
  if (projectsLoaded) return;
  win.__TEST__ = true;
  require("../src/projects/projects.js");
  projectsLoaded = true;
}

describe("projects context modal helpers", () => {
  beforeEach(() => {
    loadProjects();
  });

  test("buildProjectsContextData returns summary + live + archived messages", () => {
    const thread = {
      summary: "Summary text",
      messages: [
        { role: "user", content: "A" },
        { role: "assistant", content: "B" },
        { role: "user", content: "C" }
      ],
      archivedMessages: [{ role: "user", content: "Old" }]
    };

    const result = win.buildProjectsContextData?.(thread);

    expect(result?.summary).toBe("Summary text");
    expect(result?.liveMessages.length).toBe(3);
    expect(result?.archivedMessages.length).toBe(1);
  });

  test("buildContextBadgeLabel returns Q&A count or empty string", () => {
    const labelTwo = win.buildContextBadgeLabel?.(4);
    const labelNone = win.buildContextBadgeLabel?.(1);

    expect(labelTwo).toBe("2 Q&A");
    expect(labelNone).toBe("");
  });
});

