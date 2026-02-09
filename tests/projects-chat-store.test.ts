export {};
let projectsLoaded = false;

const win = window as any;

function loadProjects() {
  if (projectsLoaded) return;
  win.__TEST__ = true;
  win.chatStore = {
    getThreads: jest.fn().mockResolvedValue([
      { id: "t1", projectId: "p1", title: "Thread", createdAt: 1, updatedAt: 2 }
    ]),
    getMessages: jest.fn().mockResolvedValue([
      { id: "m1", threadId: "t1", role: "user", content: "Hi" }
    ]),
    getSummary: jest.fn().mockResolvedValue({
      threadId: "t1",
      summary: "Summary",
      summaryUpdatedAt: 10
    }),
    getArchivedMessages: jest.fn().mockResolvedValue({
      threadId: "t1",
      archivedMessages: [{ id: "a1", threadId: "t1", role: "assistant", content: "Old" }],
      archivedUpdatedAt: 11
    })
  };
  require("../src/projects/projects.js");
  projectsLoaded = true;
}

test("loadThreads hydrates messages, summary, and archives from chat store", async () => {
  loadProjects();
  const threads = await win.loadThreads?.();
  expect(threads).toHaveLength(1);
  expect(threads[0].messages).toHaveLength(1);
  expect(threads[0].summary).toBe("Summary");
  expect(threads[0].archivedMessages).toHaveLength(1);
});
