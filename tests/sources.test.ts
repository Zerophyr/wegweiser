export {};

function loadSourcesModule() {
  let loaded: any;
  jest.isolateModules(() => {
    loaded = require("../src/modules/sources.js");
  });
  return loaded;
}

describe("sources module", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (global as any).window = (global as any).window || {};
    (global as any).window.safeHtml = {
      setSanitizedHtml: (element: HTMLElement, html: string) => {
        element.innerHTML = html;
      }
    };
    (global as any).sourcesModalUtils = {
      showSourcesModal: jest.fn()
    };
  });

  afterEach(() => {
    if ((global as any).window) {
      delete (global as any).window.safeHtml;
    }
    delete (global as any).sourcesModalUtils;
  });

  test("extractSources returns clean text without raw URLs", () => {
    const { extractSources } = loadSourcesModule();
    const result = extractSources("Read [Docs](https://example.com/docs) and https://openrouter.ai [1]");

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.cleanText).toContain("Read Docs and");
    expect(result.cleanText).not.toContain("https://");
  });


  test("extractSources handles empty input", () => {
    const { extractSources } = loadSourcesModule();
    expect(extractSources("")).toEqual({ sources: [], cleanText: "" });
  });

  test("makeSourceReferencesClickable leaves content untouched when sources are missing", () => {
    const { makeSourceReferencesClickable } = loadSourcesModule();
    const answerContent = document.createElement("div");
    answerContent.innerHTML = "Use [1] for details.";

    makeSourceReferencesClickable(answerContent, []);

    expect(answerContent.innerHTML).toBe("Use [1] for details.");
  });

  test("makeSourceReferencesClickable renders chips and opens modal on click", () => {
    const { makeSourceReferencesClickable } = loadSourcesModule();
    const answerContent = document.createElement("div");
    answerContent.innerHTML = "Use [1] for details.";
    const sources = [{ id: "source-1", number: 1, domain: "example.com", title: "Example", url: "https://example.com" }];

    makeSourceReferencesClickable(answerContent, sources);

    const chip = answerContent.querySelector(".source-chip") as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe("example.com");

    chip.click();
    expect((global as any).sourcesModalUtils.showSourcesModal).toHaveBeenCalledWith(
      sources,
      expect.any(Array),
      "source-1"
    );
  });

  test("createSourcesIndicator returns null for empty sources and opens modal on click", () => {
    const { createSourcesIndicator } = loadSourcesModule();
    const emptyAnswerEl = document.createElement("div");
    expect(createSourcesIndicator([], emptyAnswerEl)).toBeNull();
    const answerEl = document.createElement("div");
    const sources = [
      { id: "source-1", number: 1, domain: "example.com", title: "Example", url: "https://example.com" },
      { id: "source-2", number: 2, domain: "openrouter.ai", title: "OpenRouter", url: "https://openrouter.ai" }
    ];

    const indicator = createSourcesIndicator(sources, answerEl) as HTMLElement;

    expect(indicator).not.toBeNull();
    expect(answerEl.getAttribute("data-sources")).toContain("source-1");
    expect(indicator.textContent).toContain("2 sources");
    expect(indicator.querySelectorAll("img")).toHaveLength(2);
    expect(indicator.querySelector("img")?.getAttribute("src")).toContain("data:image/svg+xml");

    indicator.click();
    expect((global as any).sourcesModalUtils.showSourcesModal).toHaveBeenCalledWith(
      sources,
      expect.any(Array)
    );
  });
});
