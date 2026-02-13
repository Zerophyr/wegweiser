export {};

const {
  applyViewSelection,
  getProjectsListVisibilityState,
  sortProjectsByUpdatedAt
} = require("../src/projects/projects-view-utils.js");

describe("projects view utils", () => {
  test("applyViewSelection toggles active classes and resets context for list", () => {
    document.body.innerHTML = `
      <div id="list" class="view active"></div>
      <div id="project" class="view"></div>
    `;
    const listView = document.getElementById("list");
    const projectView = document.getElementById("project");

    const result = applyViewSelection("list", {
      listView,
      projectView
    });

    expect(listView?.classList.contains("active")).toBe(true);
    expect(projectView?.classList.contains("active")).toBe(false);
    expect(result.shouldResetSelection).toBe(true);
  });

  test("applyViewSelection toggles active classes for project view", () => {
    document.body.innerHTML = `
      <div id="list" class="view active"></div>
      <div id="project" class="view"></div>
    `;
    const listView = document.getElementById("list");
    const projectView = document.getElementById("project");

    const result = applyViewSelection("Project", {
      listView,
      projectView
    });

    expect(listView?.classList.contains("active")).toBe(false);
    expect(projectView?.classList.contains("active")).toBe(true);
    expect(result.shouldResetSelection).toBe(false);
  });

  test("getProjectsListVisibilityState returns empty state visibility for zero projects", () => {
    const state = getProjectsListVisibilityState([]);
    expect(state.showEmpty).toBe(true);
    expect(state.gridDisplay).toBe("none");
    expect(state.emptyDisplay).toBe("flex");
  });

  test("sortProjectsByUpdatedAt sorts descending", () => {
    const sorted = sortProjectsByUpdatedAt([
      { id: "a", updatedAt: 5 },
      { id: "b", updatedAt: 10 },
      { id: "c", updatedAt: 1 }
    ]);
    expect(sorted.map((p: any) => p.id)).toEqual(["b", "a", "c"]);
  });
});
