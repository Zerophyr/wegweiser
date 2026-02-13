export {};

const {
  sortThreadsByUpdatedAt,
  getThreadListViewState
} = require("../src/projects/projects-thread-view-utils.js");

describe("projects thread view utils", () => {
  test("sortThreadsByUpdatedAt sorts descending without mutating input", () => {
    const input = [
      { id: "a", updatedAt: 1 },
      { id: "b", updatedAt: 10 },
      { id: "c", updatedAt: 5 }
    ];
    const out = sortThreadsByUpdatedAt(input);
    expect(out.map((t: any) => t.id)).toEqual(["b", "c", "a"]);
    expect(input.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  test("getThreadListViewState marks empty thread list", () => {
    const state = getThreadListViewState([]);
    expect(state.isEmpty).toBe(true);
    expect(state.threads).toEqual([]);
  });
});
