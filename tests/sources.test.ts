export {};

jest.mock("../src/modules/sources-modal-utils.js", () => ({
  showSourcesModal: jest.fn()
}));

const { showSourcesModal } = require("../src/modules/sources-modal-utils.js");
const {
  extractSources,
  makeSourceReferencesClickable,
  createSourcesIndicator
} = require("../src/modules/sources.js");

describe("sources module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("extractSources returns clean text without raw URLs", () => {
    const result = extractSources("Read [Docs](https://example.com/docs) and https://openrouter.ai [1]");

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.cleanText).toContain("Read Docs and");
    expect(result.cleanText).not.toContain("https://");
  });

  test("makeSourceReferencesClickable renders chips and opens modal on click", () => {
    const answerContent = document.createElement("div");
    answerContent.innerHTML = "Use [1] for details.";
    const sources = [{ id: "source-1", number: 1, domain: "example.com", title: "Example", url: "https://example.com" }];

    makeSourceReferencesClickable(answerContent, sources);

    const chip = answerContent.querySelector(".source-chip") as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe("example.com");

    chip.click();
    expect(showSourcesModal).toHaveBeenCalledWith(
      sources,
      expect.any(Array),
      "source-1"
    );
  });

  test("createSourcesIndicator stores sources and opens modal on click", () => {
    const answerEl = document.createElement("div");
    const sources = [
      { id: "source-1", number: 1, domain: "example.com", title: "Example", url: "https://example.com" },
      { id: "source-2", number: 2, domain: "openrouter.ai", title: "OpenRouter", url: "https://openrouter.ai" }
    ];

    const indicator = createSourcesIndicator(sources, answerEl) as HTMLElement;

    expect(indicator).not.toBeNull();
    expect(answerEl.getAttribute("data-sources")).toContain("source-1");
    expect(indicator.textContent).toContain("2 sources");

    indicator.click();
    expect(showSourcesModal).toHaveBeenCalledWith(
      sources,
      expect.any(Array)
    );
  });
});
