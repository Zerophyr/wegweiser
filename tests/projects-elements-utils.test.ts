export {};

const {
  collectProjectsElements
} = require("../src/projects/projects-elements-utils.js");

describe("projects elements utils", () => {
  test("collectProjectsElements maps required element ids", () => {
    document.body.innerHTML = `
      <div id="projects-list-view"></div>
      <div id="project-view"></div>
      <div id="projects-grid"></div>
      <button id="create-project-btn"></button>
      <div id="chat-messages"></div>
      <button id="send-btn"></button>
      <button id="stop-btn"></button>
      <div class="projects-context-badge"></div>
    `;

    const elements = collectProjectsElements(document);
    expect(elements.ProjectsListView?.id).toBe("projects-list-view");
    expect(elements.ProjectView?.id).toBe("project-view");
    expect(elements.ProjectsGrid?.id).toBe("projects-grid");
    expect(elements.createProjectBtn?.id).toBe("create-project-btn");
    expect(elements.chatMessages?.id).toBe("chat-messages");
    expect(elements.sendBtn?.id).toBe("send-btn");
    expect(elements.stopBtn?.id).toBe("stop-btn");
    expect(elements.ProjectsContextBadge?.className).toBe("projects-context-badge");
  });
});
