export {};
const {
  closeExportMenus,
  getExportPayload
} = require("../src/sidepanel/sidepanel-export-utils.js");

describe("sidepanel export utils", () => {
  test("closes open export menus", () => {
    document.body.innerHTML = `
      <div class="export-menu open"></div>
      <div class="export-menu open"></div>
    `;
    closeExportMenus(document);
    expect(document.querySelectorAll(".export-menu.open").length).toBe(0);
  });

  test("extracts export payload text/html", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<div class="answer-content"><b>Hello</b></div>`;
    const payload = getExportPayload(wrapper);
    expect(payload.text).toContain("Hello");
    expect(payload.html).toContain("<b>Hello</b>");
  });
});
