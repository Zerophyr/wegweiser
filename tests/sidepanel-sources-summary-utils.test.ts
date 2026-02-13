export {};
const {
  renderSourcesSummaryToElement
} = require("../src/sidepanel/sidepanel-sources-summary-utils.js");

describe("sidepanel sources summary utils", () => {
  test("renders source count and favicon stack", () => {
    const root = document.createElement("div");
    const summary = document.createElement("div");
    summary.className = "answer-sources-summary";
    root.appendChild(summary);

    renderSourcesSummaryToElement(
      summary,
      [{ url: "https://a.com" }, { url: "https://b.com" }],
      () => ([
        { domain: "a.com", favicon: "https://a.com/favicon.ico" },
        { domain: "b.com", favicon: "https://b.com/favicon.ico" }
      ]),
      (count: number) => `${count} sources`
    );

    expect(summary.querySelectorAll("img").length).toBe(2);
    expect(summary.textContent).toContain("2 sources");
  });

  test("clears summary for empty sources", () => {
    const summary = document.createElement("div");
    summary.innerHTML = "<span>old</span>";
    renderSourcesSummaryToElement(summary, [], () => [], (count: number) => `${count}`);
    expect(summary.innerHTML).toBe("");
  });
});
