export {};

const {
  renderProjectsSourcesSummary
} = require("../src/projects/projects-sources-summary-utils.js");

describe("projects sources summary utils", () => {
  test("renders source count and favicon stack", () => {
    const messageDiv = document.createElement("div");
    const summary = document.createElement("div");
    summary.className = "chat-sources-summary";
    messageDiv.appendChild(summary);

    renderProjectsSourcesSummary(
      messageDiv,
      [{ url: "https://a.com" }, { url: "https://b.com" }],
      () => ([
        { domain: "a.com", favicon: "https://a.com/favicon.ico" },
        { domain: "b.com", favicon: "https://b.com/favicon.ico" }
      ])
    );

    expect(summary.querySelectorAll("img").length).toBe(2);
    expect(summary.textContent).toContain("2 sources");
  });

  test("clears summary when sources are empty", () => {
    const messageDiv = document.createElement("div");
    const summary = document.createElement("div");
    summary.className = "chat-sources-summary";
    summary.innerHTML = "<span>old</span>";
    messageDiv.appendChild(summary);

    renderProjectsSourcesSummary(messageDiv, [], () => []);
    expect(summary.innerHTML).toBe("");
  });
});
