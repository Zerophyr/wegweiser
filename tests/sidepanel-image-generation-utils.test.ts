const { generateImage } = require("../src/sidepanel/sidepanel-image-generation-utils.js");

describe("sidepanel-image-generation-utils", () => {
  test("generateImage handles unsuccessful image response", async () => {
    const answerEl = document.createElement("div");
    const answerSection = document.createElement("div");
    const metaEl = document.createElement("div");
    const askBtn = document.createElement("button");

    const deps = {
      state: { selectedCombinedModelId: "openrouter:model-a", currentProvider: "openrouter" },
      askBtn,
      setPromptStreamingState: jest.fn(),
      metaEl,
      showAnswerBox: jest.fn(),
      answerEl,
      updateAnswerVisibility: jest.fn(),
      answerSection,
      parseCombinedModelIdSafe: () => ({ provider: "openrouter", modelId: "model-a" }),
      normalizeProviderSafe: (value: string) => value,
      sendRuntimeMessage: jest.fn().mockResolvedValue({ ok: false, error: "bad request" }),
      buildImageCard: () => document.createElement("div"),
      putImageCacheEntry: jest.fn(),
      getImageCacheEntry: jest.fn(),
      openImageInNewTab: jest.fn(),
      downloadImage: jest.fn(),
      refreshBalance: jest.fn()
    };

    await generateImage(deps, "make image");

    expect(metaEl.textContent).toBe("❌ Failed to generate image.");
    expect(askBtn.disabled).toBe(false);
  });
});

