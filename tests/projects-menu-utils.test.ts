export {};

const {
  closeProjectsDropdownMenus,
  toggleProjectsDropdownMenu
} = require("../src/projects/projects-menu-utils.js");

describe("projects menu utils", () => {
  test("closeProjectsDropdownMenus hides all .menu-items", () => {
    document.body.innerHTML = `
      <div class="menu-items" style="display:block"></div>
      <div class="menu-items" style="display:block"></div>
    `;
    closeProjectsDropdownMenus(document);
    const menus = Array.from(document.querySelectorAll(".menu-items")) as HTMLElement[];
    expect(menus.every((m) => m.style.display === "none")).toBe(true);
  });

  test("toggleProjectsDropdownMenu closes others and toggles target", () => {
    document.body.innerHTML = `
      <div class="menu-dropdown">
        <button id="a"></button><div class="menu-items" style="display:block"></div>
      </div>
      <div class="menu-dropdown">
        <button id="b"></button><div class="menu-items" style="display:none"></div>
      </div>
    `;
    const a = document.getElementById("a");
    const b = document.getElementById("b");
    toggleProjectsDropdownMenu(b, document);
    const aMenu = a?.nextElementSibling as HTMLElement;
    const bMenu = b?.nextElementSibling as HTMLElement;
    expect(aMenu.style.display).toBe("none");
    expect(bMenu.style.display).toBe("block");
  });
});
