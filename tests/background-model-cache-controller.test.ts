export {};

const {
  createBackgroundModelCacheController
} = require("../src/background/background-model-cache-controller-utils.js");

describe("background-model-cache-controller-utils", () => {
  function buildController(overrides = {}) {
    const localGet = jest.fn().mockResolvedValue({});
    const localSet = jest.fn().mockResolvedValue(undefined);
    const sendMessage = jest.fn().mockResolvedValue(undefined);

    const deps = {
      normalizeProviderId: (id: string) => id || "openrouter",
      getProviderConfig: () => ({ baseUrl: "https://api.example.test" }),
      buildAuthHeaders: () => ({ Authorization: "Bearer t" }),
      parseModelsPayload: jest.fn().mockReturnValue([{ id: "m1", supportsChat: true }]),
      deriveModelCapabilities: jest.fn(),
      getModelsCacheKeys: () => ({ modelsKey: "or_models_cache", timeKey: "or_models_cache_time", versionKey: "or_models_cache_version" }),
      modelsCacheSchemaVersion: 3,
      storageLocal: {
        get: localGet,
        set: localSet
      },
      runtime: { sendMessage },
      modelsUpdatedEvent: "models_updated",
      cacheTtlMs: 1_000,
      hasModelCapabilityFields: jest.fn().mockReturnValue(true),
      errorMessages: { API_ERROR: "api error" },
      fetchFn: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: "m1" }] }) }),
      logger: { warn: jest.fn() },
      now: () => 10_000,
      ...overrides
    };

    return {
      deps,
      localGet,
      localSet,
      sendMessage,
      controller: createBackgroundModelCacheController(deps)
    };
  }

  test("returns fresh cached models without fetch", async () => {
    const { controller, localGet, deps } = buildController();
    localGet.mockResolvedValue({
      or_models_cache: [{ id: "cached", supportsChat: true }],
      or_models_cache_time: 9_500,
      or_models_cache_version: 3
    });

    const models = await controller.getProviderModels("openrouter", "k");
    expect(models).toEqual([{ id: "cached", supportsChat: true }]);
    expect(deps.fetchFn).not.toHaveBeenCalled();
  });

  test("returns stale cache and refreshes in background", async () => {
    const { controller, localGet, deps } = buildController({ now: () => 20_000, cacheTtlMs: 1_000 });
    localGet.mockResolvedValue({
      or_models_cache: [{ id: "cached", supportsChat: true }],
      or_models_cache_time: 10_000,
      or_models_cache_version: 3
    });

    const models = await controller.getProviderModels("openrouter", "k");
    expect(models).toEqual([{ id: "cached", supportsChat: true }]);

    await Promise.resolve();
    expect(deps.fetchFn).toHaveBeenCalledTimes(1);
  });

  test("forces fetch when cache empty", async () => {
    const { controller, deps } = buildController();
    const models = await controller.getProviderModels("openrouter", "k");
    expect(deps.fetchFn).toHaveBeenCalledTimes(1);
    expect(models).toEqual([{ id: "m1", supportsChat: true }]);
  });

  test("suppresses receiver missing broadcast warning", async () => {
    const sendMessage = jest.fn().mockRejectedValue(new Error("Could not establish connection. Receiving end does not exist."));
    const warn = jest.fn();
    const { controller } = buildController({ runtime: { sendMessage }, logger: { warn } });

    controller.broadcastModelsUpdated("openrouter");
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
  });
});
