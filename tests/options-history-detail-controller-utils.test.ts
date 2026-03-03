export {};

const {
  showOptionsHistoryDetail
} = require("../src/options/options-history-detail-controller-utils.js");

describe("options history detail controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="history-preview-column"></div>
      <div id="history-detail-content"></div>
      <div class="history-item" data-item-id="item-1"></div>
    `;

    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      },
      configurable: true
    });

    (window as any).optionsHistoryFormatUtils = {
      normalizeHistoryEntryForDisplay: jest.fn().mockImplementation((entry) => ({
        ...entry,
        promptText: "Prompt Plain",
        answerText: "## Title\n\nAnswer body"
      }))
    };
    (window as any).applyMarkdownStyles = jest.fn();
  });

  afterEach(() => {
    delete (window as any).optionsHistoryFormatUtils;
    delete (window as any).applyMarkdownStyles;
  });

  test("renders markdown answer and copies normalized text", async () => {
    showOptionsHistoryDetail(
      { id: "item-1", prompt: "<div>raw</div>", answer: "<div>raw answer</div>", createdAt: Date.now() },
      {
        setHtmlSafely: (el: HTMLElement, html: string) => { el.innerHTML = html; },
        escapeHtml: (v: string) => v,
        getCurrentHistory: () => [],
        setCurrentHistory: jest.fn(),
        getPendingDeleteItem: () => null,
        setPendingDeleteItem: jest.fn(),
        getLocalStorage: jest.fn().mockResolvedValue({ or_history: [] }),
        setLocalStorage: jest.fn().mockResolvedValue(undefined),
        loadPromptHistory: jest.fn().mockResolvedValue(undefined),
        showToast: jest.fn(),
        toastApi: { success: jest.fn() }
      }
    );

    expect((window as any).applyMarkdownStyles).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "## Title\n\nAnswer body"
    );

    const copyPromptBtn = document.querySelector(".detail-copy-prompt-btn") as HTMLButtonElement;
    const copyAnswerBtn = document.querySelector(".detail-copy-answer-btn") as HTMLButtonElement;

    copyPromptBtn.click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Prompt Plain");

    copyAnswerBtn.click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("## Title\n\nAnswer body");
  });
});

