export {};

const {
  createBackgroundQueryController
} = require("../src/background/background-query-controller-utils.js");

describe("background-query-controller-utils", () => {
  function buildController(overrides = {}) {
    const conversationContexts = new Map();
    const persistContextForTab = jest.fn().mockResolvedValue(undefined);


    const deps = {
      loadConfig: jest.fn().mockResolvedValue({ apiKey: "k", modelProvider: "openrouter", model: "openai/gpt-4o-mini" }),
      normalizeProviderId: (id: string) => id || "openrouter",
      getApiKeyForProvider: jest.fn().mockResolvedValue("k"),
      ensureContextLoaded: jest.fn().mockResolvedValue(undefined),
      getProviderConfig: jest.fn().mockReturnValue({ id: "openrouter", baseUrl: "https://api.example.test", supportsWebSearch: true }),
      buildAuthHeaders: jest.fn().mockReturnValue({ Authorization: "Bearer k" }),
      conversationContexts,
      defaults: { MAX_CONTEXT_MESSAGES: 16, MODEL: "openai/gpt-4o-mini" },
      persistContextForTab,

      apiConfig: { MAX_RETRIES: 2, RETRY_DELAY: 1, TIMEOUT: 1000 },
      errorMessages: {
        NO_API_KEY: "No key",
        RATE_LIMIT: "Rate",
        API_ERROR: "API",
        INVALID_RESPONSE: "Invalid",
        TIMEOUT: "Timeout"
      },
      debugLogger: { log: jest.fn() },
      fetchFn: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "ok" } }], usage: { total_tokens: 42 } })
      }),
      setTimeoutFn: (fn: Function) => {
        fn();
        return 1;
      },
      clearTimeoutFn: jest.fn(),
      sleep: jest.fn().mockResolvedValue(undefined),
      logger: { log: jest.fn() },
      ...overrides
    };

    return {
      deps,
      persistContextForTab,

      controller: createBackgroundQueryController(deps)
    };
  }

  test("callOpenRouter appends context and returns answer", async () => {
    const { controller, deps, persistContextForTab } = buildController();

    const result = await controller.callOpenRouter("hello", false, false, "tab-1");

    expect(result.answer).toBe("ok");
    expect(result.tokens).toBe(42);
    expect(result.contextSize).toBe(2);
    expect(deps.conversationContexts.get("tab-1")).toHaveLength(2);
    expect(persistContextForTab).toHaveBeenCalled();
  });

  test("callOpenRouterWithMessages retries once on server error", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { message: "server" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "summary" } }], usage: { total_tokens: 7 } }) });

    const { controller, deps } = buildController({ fetchFn });

    const result = await controller.callOpenRouterWithMessages([{ role: "user", content: "x" }]);
    expect(result).toEqual({ answer: "summary", tokens: 7 });
    expect(deps.fetchFn).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
  });

  test("maps abort errors to timeout", async () => {
    const abortError = new Error("abort");
    (abortError as any).name = "AbortError";
    const fetchFn = jest.fn().mockRejectedValue(abortError);
    const { controller } = buildController({ fetchFn, setTimeoutFn: jest.fn().mockReturnValue(1) });

    await expect(controller.callOpenRouter("p", false, false, "tab-1")).rejects.toThrow("Timeout");
  });
});


