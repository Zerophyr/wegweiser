const { buildImageCard } = require("../src/modules/image-cards.js");

describe("image cards", () => {
  test("buildImageCard renders ready state with actions", () => {
    const el = buildImageCard({
      state: "ready",
      imageUrl: "data:image/png;base64,AAA",
      expiresAt: Date.now() + 1000,
      mode: "sidepanel"
    });
    expect(el.classList.contains("image-card")).toBe(true);
    expect(el.querySelector(".image-download-btn")).not.toBeNull();
  });
});
