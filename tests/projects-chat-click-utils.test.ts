export {};

const {
  resolveChatMessageClickAction
} = require("../src/projects/projects-chat-click-utils.js");

describe("projects chat click utils", () => {
  test("detects archive toggle click", () => {
    document.body.innerHTML = `<button class="chat-archive-toggle"><span id="inner"></span></button>`;
    const target = document.getElementById("inner");
    const action = resolveChatMessageClickAction(target);
    expect(action).toEqual({ type: "archive-toggle" });
  });

  test("detects export button click with menu element", () => {
    document.body.innerHTML = `
      <div class="export-menu">
        <button class="export-btn"><span id="exp"></span></button>
      </div>
    `;
    const target = document.getElementById("exp");
    const action = resolveChatMessageClickAction(target);
    expect(action.type).toBe("export-menu-toggle");
    expect(action.menu).not.toBeNull();
  });

  test("detects export option click and format", () => {
    document.body.innerHTML = `<button class="export-option" data-format="pdf" id="opt"></button>`;
    const target = document.getElementById("opt");
    const action = resolveChatMessageClickAction(target);
    expect(action).toEqual({ type: "export-option", format: "pdf" });
  });
});
