export {};

const {
  resolveProjectCardClickAction,
  resolveThreadItemClickAction
} = require("../src/projects/projects-click-actions-utils.js");

describe("projects click actions utils", () => {
  test("resolveProjectCardClickAction returns edit action", () => {
    document.body.innerHTML = `
      <div class="project-card" data-project-id="p1">
        <button data-action="edit" data-project-id="p1"><span id="inner"></span></button>
      </div>
    `;
    const card = document.querySelector(".project-card");
    const target = document.getElementById("inner");
    const action = resolveProjectCardClickAction(target, card);
    expect(action).toEqual({ type: "edit", projectId: "p1" });
  });

  test("resolveProjectCardClickAction returns open action on plain card click", () => {
    document.body.innerHTML = `<div class="project-card" data-project-id="p9"><span id="plain"></span></div>`;
    const card = document.querySelector(".project-card");
    const target = document.getElementById("plain");
    const action = resolveProjectCardClickAction(target, card);
    expect(action).toEqual({ type: "open", projectId: "p9" });
  });

  test("resolveThreadItemClickAction returns export action", () => {
    document.body.innerHTML = `
      <div class="thread-item" data-thread-id="t1">
        <button data-action="export" data-thread-id="t1" data-format="pdf"><span id="exp"></span></button>
      </div>
    `;
    const item = document.querySelector(".thread-item");
    const target = document.getElementById("exp");
    const action = resolveThreadItemClickAction(target, item);
    expect(action).toEqual({ type: "export", threadId: "t1", format: "pdf" });
  });
});
