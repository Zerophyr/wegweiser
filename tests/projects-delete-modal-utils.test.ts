export {};

const {
  buildProjectDeleteModalContent,
  buildThreadDeleteModalContent
} = require("../src/projects/projects-delete-modal-utils.js");

describe("projects delete modal utils", () => {
  test("buildProjectDeleteModalContent returns project delete labels", () => {
    const out = buildProjectDeleteModalContent("Alpha", 2);
    expect(out).toEqual({
      title: "Delete Project",
      message: 'Are you sure you want to delete "Alpha" and all its threads?',
      sizeText: "This will delete 2 threads."
    });
  });

  test("buildThreadDeleteModalContent returns thread delete labels", () => {
    const out = buildThreadDeleteModalContent("Thread A", 3072);
    expect(out).toEqual({
      title: "Delete Thread",
      message: 'Are you sure you want to delete "Thread A"?',
      sizeText: "This will free ~3.0KB."
    });
  });
});
