export {};

const { askQuestion } = require("../src/sidepanel/sidepanel-prompt-controller-utils.js");

function createDeps(overrides = {}) {
  const promptEl = document.createElement("textarea");
  const metaEl = document.createElement("div");
  const askBtn = document.createElement("button");
  const answerEl = document.createElement("div");
  const typingIndicator = document.createElement("div");
  const answerSection = document.createElement("div");
  const estimatedCostEl = document.createElement("div");

  return {
    state: {
      activePort: null,
      imageModeEnabled: false,
      reasoningEnabled: false,
      webSearchEnabled: false,
      streamStopRequested: false,
      streamStoppedByUser: false,
      selectedCombinedModelId: null,
      currentProvider: "openrouter"
    },
    promptEl,
    sanitizePrompt: (value: string) => value.trim(),
    metaEl,
    clearPromptAfterSend: (el: HTMLTextAreaElement) => {
      el.value = "";
      el.style.height = "auto";
    },
    generateImageImpl: jest.fn().mockResolvedValue(undefined),
    askBtn,
    setPromptStreamingState: jest.fn(),
    showAnswerBox: jest.fn(),
    answerEl,
    typingIndicator,
    showTypingIndicator: jest.fn(),
    answerSection,
    queryActiveTab: jest.fn().mockResolvedValue([{ id: 5 }]),
    sendRuntimeMessage: jest.fn().mockResolvedValue({ contextSize: 0 }),
    getProviderLabelSafe: () => "OpenRouter",
    updateAnswerVisibility: jest.fn(),
    hideTypingIndicator: jest.fn(),
    buildStreamErrorHtml: (msg: string) => `<div>${msg}</div>`,
    getStreamingFallbackMessage: jest.fn().mockReturnValue(null),
    extractReasoningFromStreamChunk: jest.fn().mockImplementation((_state, content) => ({ content })),
    extractSources: jest.fn().mockImplementation((text: string) => ({ sources: [], cleanText: text })),
    applyMarkdownStyles: jest.fn().mockImplementation((text: string) => text),
    safeHtmlSetter: undefined,
    modelMap: new Map(),
    getModelDisplayName: (model: any) => model?.name || "model",
    UI_CONSTANTS: { TOKEN_BAR_MAX_TOKENS: 4000 },
    removeReasoningBubbles: jest.fn(),
    makeSourceReferencesClickable: jest.fn(),
    createSourcesIndicator: jest.fn().mockReturnValue(null),
    renderSourcesSummary: jest.fn(),
    contextViz: null,
    escapeHtml: (value: string) => value,
    estimatedCostEl,
    refreshBalance: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("sidepanel-prompt-controller-utils", () => {
  test("askQuestion short-circuits on empty prompt", async () => {
    const deps = createDeps();
    deps.promptEl.value = "   ";

    await askQuestion(deps);

    expect(deps.metaEl.textContent).toBe("Enter a prompt first.");
  });

  test("askQuestion in image mode clears prompt and delegates generation", async () => {
    const deps = createDeps({
      state: {
        activePort: null,
        imageModeEnabled: true,
        reasoningEnabled: false,
        webSearchEnabled: false,
        streamStopRequested: false,
        streamStoppedByUser: false,
        selectedCombinedModelId: null,
        currentProvider: "openrouter"
      }
    });
    deps.promptEl.value = "Generate a skyline";

    await askQuestion(deps);

    expect(deps.generateImageImpl).toHaveBeenCalledWith("Generate a skyline");
    expect(deps.promptEl.value).toBe("");
  });

  test("askQuestion starts stream and sends start_stream payload", async () => {
    const postMessage = jest.fn();
    const disconnectListeners: Array<() => void> = [];
    const messageListeners: Array<(msg: any) => void> = [];
    const disconnect = jest.fn();

    (global as any).chrome.runtime.connect = jest.fn().mockReturnValue({
      postMessage,
      disconnect,
      onDisconnect: {
        addListener: (fn: () => void) => disconnectListeners.push(fn)
      },
      onMessage: {
        addListener: (fn: (msg: any) => void) => messageListeners.push(fn)
      }
    });

    const deps = createDeps();
    deps.promptEl.value = "Hello";

    await askQuestion(deps);

    expect((global as any).chrome.runtime.connect).toHaveBeenCalledWith({ name: "streaming" });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start_stream",
        prompt: "Hello",
        webSearch: false,
        reasoning: false,
        tabId: 5
      })
    );
    expect(deps.askBtn.disabled).toBe(true);
    expect(typeof messageListeners[0]).toBe("function");
    expect(typeof disconnectListeners[0]).toBe("function");
  });
});
