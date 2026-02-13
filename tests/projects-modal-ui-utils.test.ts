export {};

const {
  setModalVisibility,
  shouldCloseModalOnBackdropClick,
  isEscapeCloseEvent
} = require("../src/projects/projects-modal-ui-utils.js");

describe("projects modal ui utils", () => {
  test("setModalVisibility toggles display style", () => {
    const modal = document.createElement("div");
    setModalVisibility(modal, true);
    expect(modal.style.display).toBe("flex");
    setModalVisibility(modal, false);
    expect(modal.style.display).toBe("none");
  });

  test("shouldCloseModalOnBackdropClick returns true only when target is modal", () => {
    const modal = document.createElement("div");
    const child = document.createElement("span");
    modal.appendChild(child);
    expect(shouldCloseModalOnBackdropClick({ target: modal }, modal)).toBe(true);
    expect(shouldCloseModalOnBackdropClick({ target: child }, modal)).toBe(false);
  });

  test("isEscapeCloseEvent checks Escape key", () => {
    expect(isEscapeCloseEvent({ key: "Escape" })).toBe(true);
    expect(isEscapeCloseEvent({ key: "Enter" })).toBe(false);
  });
});
