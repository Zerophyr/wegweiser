export {};

const {
  showProjectsStorageWarning,
  hideProjectsStorageWarning
} = require("../src/projects/projects-storage-warning-utils.js");

describe("projects storage warning utils", () => {
  test("showProjectsStorageWarning applies class, display and message", () => {
    const warningEl: any = { className: "", style: { display: "" } };
    const messageEl: any = { textContent: "" };
    showProjectsStorageWarning(warningEl, messageEl, "high", "Storage almost full.");
    expect(warningEl.className).toBe("storage-warning high");
    expect(warningEl.style.display).toBe("flex");
    expect(messageEl.textContent).toBe("Storage almost full.");
  });

  test("hideProjectsStorageWarning hides warning element", () => {
    const warningEl: any = { style: { display: "flex" } };
    hideProjectsStorageWarning(warningEl);
    expect(warningEl.style.display).toBe("none");
  });
});
