export {};

const {
  closeProjectsExportMenus,
  toggleProjectsExportMenu
} = require("../src/projects/projects-export-menu-utils.js");

describe("projects export menu utils", () => {
  test("closeProjectsExportMenus closes all open menus", () => {
    document.body.innerHTML = `
      <div class="export-menu open"></div>
      <div class="export-menu open"></div>
    `;
    closeProjectsExportMenus(document);
    expect(document.querySelectorAll(".export-menu.open").length).toBe(0);
  });

  test("toggleProjectsExportMenu opens target menu and closes others", () => {
    document.body.innerHTML = `
      <div class="export-menu open" id="a"><button class="export-btn" id="btn-a"></button></div>
      <div class="export-menu" id="b"><button class="export-btn" id="btn-b"></button></div>
    `;
    const btnB = document.getElementById("btn-b");
    const isOpen = toggleProjectsExportMenu(btnB, document);
    expect(isOpen).toBe(true);
    expect(document.getElementById("a")?.classList.contains("open")).toBe(false);
    expect(document.getElementById("b")?.classList.contains("open")).toBe(true);
  });
});
