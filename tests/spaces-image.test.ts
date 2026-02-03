export {};
const win = window as any;

describe("spaces image lightbox", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-messages"></div>';
    win.__TEST__ = true;
    require("../src/spaces/spaces.js");
  });

  test("openImageLightbox attaches modal", () => {
    const openImageLightbox = (win as any).openImageLightbox;
    openImageLightbox?.("data:image/png;base64,AAA");
    expect(document.querySelector(".image-lightbox")).not.toBeNull();
  });
});

