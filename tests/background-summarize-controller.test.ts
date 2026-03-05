export {};

const {
  createBackgroundSummarizeController
} = require("../src/background/background-summarize-controller-utils.js");

describe("background-summarize-controller-utils", () => {
  function buildController(overrides = {}) {
    const callOpenRouter = jest.fn().mockResolvedValue({ answer: "summary", tokens: 5 });
    const addHistoryEntry = jest.fn().mockResolvedValue(undefined);
    const loadConfig = jest.fn().mockResolvedValue({ model: "openai/gpt-4o-mini" });
    const chromeApi = {
      tabs: {
        get: jest.fn().mockResolvedValue({ url: "https://example.com/page" })
      },
      permissions: {
        contains: jest.fn().mockResolvedValue(true)
      },
      scripting: {
        executeScript: jest.fn().mockResolvedValue([{ result: { title: "Page", description: "Desc", content: "A short article", url: "https://example.com/page" } }])
      }
    };

    const deps = {
      chromeApi,
      callOpenRouter,
      addHistoryEntry,
      loadConfig,
      conversationContexts: new Map(),
      maxChunkSize: 12,
      logger: { error: jest.fn() },
      ...overrides
    };

    return {
      deps,
      callOpenRouter,
      addHistoryEntry,
      controller: createBackgroundSummarizeController(deps)
    };
  }

  test("returns permission-needed payload when origin permission is missing", async () => {
    const { controller, deps } = buildController({
      chromeApi: {
        tabs: { get: jest.fn().mockResolvedValue({ url: "https://example.com/page" }) },
        permissions: { contains: jest.fn().mockResolvedValue(false) },
        scripting: { executeScript: jest.fn() }
      }
    });

    const sendResponse = jest.fn();
    await controller.handleSummarizePageMessage({ tabId: 1 }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "PERMISSION_NEEDED",
      requiresPermission: true,
      url: "https://example.com/page"
    });
    expect(deps.chromeApi.scripting.executeScript).not.toHaveBeenCalled();
  });

  test("summarizes short content in a single pass", async () => {
    const { controller, callOpenRouter, addHistoryEntry } = buildController({
      maxChunkSize: 1000
    });

    const sendResponse = jest.fn();
    await controller.handleSummarizePageMessage({ tabId: 1, webSearch: false, reasoning: false }, sendResponse);

    expect(callOpenRouter).toHaveBeenCalledTimes(1);
    expect(addHistoryEntry).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      answer: "summary",
      model: "openai/gpt-4o-mini",
      tokens: 5
    }));
  });

  test("uses chunked flow for long content", async () => {
    const longContent = "x".repeat(35);
    const callOpenRouter = jest
      .fn()
      .mockResolvedValueOnce({ answer: "chunk-1", tokens: 2 })
      .mockResolvedValueOnce({ answer: "chunk-2", tokens: 3 })
      .mockResolvedValueOnce({ answer: "chunk-3", tokens: 4 })
      .mockResolvedValueOnce({ answer: "chunk-4", tokens: 1 })
      .mockResolvedValueOnce({ answer: "combined", tokens: 5 });

    const { controller, addHistoryEntry } = buildController({
      maxChunkSize: 10,
      callOpenRouter,
      chromeApi: {
        tabs: { get: jest.fn().mockResolvedValue({ url: "https://example.com/page" }) },
        permissions: { contains: jest.fn().mockResolvedValue(true) },
        scripting: {
          executeScript: jest.fn().mockResolvedValue([{ result: { title: "Page", description: "", content: longContent, url: "https://example.com/page" } }])
        }
      }
    });

    const sendResponse = jest.fn();
    await controller.handleSummarizePageMessage({ tabId: 1, webSearch: false, reasoning: false }, sendResponse);

    expect(callOpenRouter).toHaveBeenCalledTimes(5);
    expect(addHistoryEntry).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      answer: "combined",
      tokens: 15
    }));
  });
});
