export {};

const {
  createProjectRecord,
  applyProjectUpdate,
  createThreadRecord,
  applyThreadUpdate,
  appendMessageToThread
} = require("../src/projects/projects-data-utils.js");

describe("projects data utils", () => {
  test("createProjectRecord builds a normalized project object", () => {
    const now = 1700;
    const project = createProjectRecord({
      data: { name: "Alpha", description: "Desc", icon: "🚀" },
      id: "project_1",
      now
    });

    expect(project).toEqual({
      id: "project_1",
      name: "Alpha",
      description: "Desc",
      icon: "🚀",
      model: "",
      modelProvider: null,
      modelDisplayName: "",
      customInstructions: "",
      webSearch: false,
      reasoning: false,
      createdAt: 1700,
      updatedAt: 1700
    });
  });

  test("applyProjectUpdate merges updates and refreshes timestamp", () => {
    const updated = applyProjectUpdate(
      { id: "project_1", name: "Old", updatedAt: 1000 },
      { name: "New" },
      2000
    );

    expect(updated).toEqual({
      id: "project_1",
      name: "New",
      updatedAt: 2000
    });
  });

  test("createThreadRecord uses defaults for a new thread", () => {
    const thread = createThreadRecord({
      id: "thread_1",
      projectId: "project_1",
      now: 5000
    });

    expect(thread).toEqual({
      id: "thread_1",
      projectId: "project_1",
      title: "New Thread",
      messages: [],
      summary: "",
      summaryUpdatedAt: null,
      archivedMessages: [],
      archivedUpdatedAt: null,
      createdAt: 5000,
      updatedAt: 5000
    });
  });

  test("applyThreadUpdate merges updates and refreshes timestamp", () => {
    const updated = applyThreadUpdate(
      { id: "thread_1", title: "Old", updatedAt: 1000 },
      { title: "New" },
      2000
    );

    expect(updated).toEqual({
      id: "thread_1",
      title: "New",
      updatedAt: 2000
    });
  });

  test("appendMessageToThread adds message and auto-titles first user message", () => {
    const result = appendMessageToThread({
      thread: {
        id: "thread_1",
        title: "New Thread",
        messages: [],
        updatedAt: 1000
      },
      message: { role: "user", content: "Plan migration strategy. Keep it simple." },
      now: 3000,
      generateThreadTitle: (content: string) => content.split(".")[0]
    });

    expect(result.messages).toHaveLength(1);
    expect(result.updatedAt).toBe(3000);
    expect(result.title).toBe("Plan migration strategy");
  });
});
