export {};
let projectsLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  __PROJECTS_LOADED__?: boolean;
  appendArchivedMessages?: (currentArchive: any[], newMessages: any[]) => any[];
  renderChatMessages?: (messages: any[], thread?: any) => void;
};

function loadProjects() {
  if (projectsLoaded) return;
  win.__TEST__ = true;
  (global as any).applyMarkdownStyles = (text: string) => text;
  require("../src/projects/projects.js");
  projectsLoaded = true;
}

describe("projects archive helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-messages"></div>';
    loadProjects();
  });

  test("appendArchivedMessages appends in order", () => {
    const current = [{ role: "user", content: "a" }];
    const incoming = [{ role: "assistant", content: "b" }];
    const result = win.appendArchivedMessages?.(current, incoming) || [];
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe("b");
  });

  test("renderChatMessages shows archive toggle when archived messages exist", () => {
    win.renderChatMessages?.(
      [{ role: "assistant", content: "Hi", meta: { createdAt: Date.now() } }],
      { archivedMessages: [{ role: "user", content: "Old" }] }
    );
    expect(document.querySelector(".chat-archive-toggle")).not.toBeNull();
  });
});

