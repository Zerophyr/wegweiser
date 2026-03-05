const { showSourcesModal } = require("../src/modules/sources-modal-utils.js");

describe("sources-modal-utils", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const existingStyle = document.getElementById("sources-modal-animations");
    if (existingStyle) existingStyle.remove();
  });

  test("showSourcesModal renders modal and closes on overlay click", () => {
    showSourcesModal(
      [{ id: "source-1", url: "https://example.com/a", title: "Example", number: 1, domain: "example.com" }],
      [{ domain: "example.com", favicon: "https://example.com/favicon.ico", sources: [{ id: "source-1", url: "https://example.com/a", title: "Example", number: 1, domain: "example.com" }] }]
    );

    const overlay = document.getElementById("sources-modal") as HTMLElement | null;
    expect(overlay).toBeTruthy();

    (overlay as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("sources-modal")).toBeNull();
  });
});
