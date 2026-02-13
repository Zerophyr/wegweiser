export {};
const {
  downloadImage
} = require("../src/projects/projects-image-utils.js");

describe("projects image utils", () => {
  test("downloadImage creates anchor and clicks it", () => {
    const created: HTMLAnchorElement[] = [];
    const originalCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        const anchor = el as HTMLAnchorElement & { click: jest.Mock };
        anchor.click = jest.fn();
        created.push(anchor);
      }
      return el;
    }) as typeof document.createElement;

    try {
      downloadImage("data:image/png;base64,abc", "img1", "image/png", () => "png");
      expect(created.length).toBe(1);
      expect(created[0].download).toBe("wegweiser-image-img1.png");
      expect(created[0].click).toHaveBeenCalled();
    } finally {
      document.createElement = originalCreate;
    }
  });
});
