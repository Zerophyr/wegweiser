export {};

const {
  createBackgroundBalanceController
} = require("../src/background/background-balance-controller-utils.js");

describe("background-balance-controller-utils", () => {
  function buildController(overrides = {}) {
    const lastBalanceByProvider: Record<string, number | null> = {};
    const lastBalanceAtByProvider: Record<string, number> = {};

    const deps = {
      loadConfig: jest.fn().mockResolvedValue({ modelProvider: "openrouter", apiKey: "k" }),
      getProviderConfig: jest.fn().mockReturnValue({ supportsBalance: true, baseUrl: "https://api.example.test", balanceEndpoint: "/credits" }),
      cacheTtlMs: 60_000,
      lastBalanceByProvider,
      lastBalanceAtByProvider,
      buildBalanceHeaders: jest.fn().mockReturnValue({ Authorization: "Bearer k" }),
      errorMessages: { NO_API_KEY: "No key", API_ERROR: "API" },
      fetchFn: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { total_credits: 10, total_usage: 3 } }) }),
      now: () => 10_000,
      logger: { log: jest.fn() },
      ...overrides
    };

    return { deps, controller: createBackgroundBalanceController(deps) };
  }

  test("returns unsupported for providers without balance support", async () => {
    const { controller } = buildController({ getProviderConfig: jest.fn().mockReturnValue({ supportsBalance: false }) });
    await expect(controller.getProviderBalance()).resolves.toEqual({ supported: false, balance: null });
  });

  test("returns cached balance when fresh", async () => {
    const { controller, deps } = buildController();
    deps.lastBalanceByProvider.openrouter = 2;
    deps.lastBalanceAtByProvider.openrouter = 9_900;

    await expect(controller.getProviderBalance()).resolves.toEqual({ supported: true, balance: 2 });
    expect(deps.fetchFn).not.toHaveBeenCalled();
  });

  test("fetches and parses credits response", async () => {
    const { controller } = buildController();
    await expect(controller.getProviderBalance()).resolves.toEqual({ supported: true, balance: 7 });
  });

  test("throws mapped error on non-ok response", async () => {
    const { controller } = buildController({ fetchFn: jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "bad" } }) }) });
    await expect(controller.getProviderBalance()).rejects.toThrow("bad");
  });
});
