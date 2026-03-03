export {};

const {
  createBackgroundImageController
} = require("../src/background/background-image-controller-utils.js");

describe("background-image-controller-utils", () => {
  function buildController(overrides = {}) {
    const deps = {
      normalizeProviderId: (id: string) => id || "openrouter",
      getProviderConfig: () => ({ baseUrl: "https://api.example.test" }),
      getApiKeyForProvider: jest.fn().mockResolvedValue("k"),
      cachedConfig: { model: "openai/gpt-image-1" },
      defaults: { MODEL: "openai/gpt-image-1" },
      apiConfig: { TIMEOUT: 1000 },
      errorMessages: {
        NO_PROMPT: "No prompt",
        NO_API_KEY: "No key",
        API_ERROR: "API",
        INVALID_RESPONSE: "Invalid",
        IMAGE_MODEL_REQUIRED: "Image model required"
      },
      getProviderModels: jest.fn().mockResolvedValue([{ id: "openai/gpt-image-1", supportsImages: true }]),
      resolveModelCapabilitiesFromList: jest.fn().mockReturnValue({ supportsImages: true, outputsImage: true }),
      resolveImageRouteFromCapabilities: jest.fn().mockReturnValue("images"),
      buildAuthHeaders: jest.fn().mockReturnValue({ Authorization: "Bearer k" }),
      extractOpenRouterImageUrl: jest.fn().mockReturnValue("data:image/png;base64,xyz"),
      buildDataUrlFromBase64: jest.fn().mockImplementation((b64: string) => `data:image/png;base64,${b64}`),
      fetchImageAsDataUrl: jest.fn().mockResolvedValue("data:image/png;base64,remote"),
      fetchFn: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: "abc" }] }) }),
      setTimeoutFn: jest.fn().mockReturnValue(1),
      clearTimeoutFn: jest.fn(),
      createUuid: jest.fn().mockReturnValue("id-1"),
      ...overrides
    };

    return {
      deps,
      controller: createBackgroundImageController(deps)
    };
  }

  test("uses images endpoint for image-only route", async () => {
    const { controller, deps } = buildController();

    const result = await controller.callImageGeneration("draw cat", "openrouter", null);

    expect(result).toEqual({ imageId: "id-1", mimeType: "image/png", dataUrl: "data:image/png;base64,abc" });
    expect(deps.fetchFn).toHaveBeenCalledWith(
      "https://api.example.test/images/generations",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("uses chat completions route when capabilities resolve to chat", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "", images: [{ image_url: { url: "data:image/png;base64,zzz" } }] } }] })
    });
    const { controller, deps } = buildController({
      resolveImageRouteFromCapabilities: jest.fn().mockReturnValue("chat"),
      fetchFn,
      extractOpenRouterImageUrl: jest.fn().mockReturnValue("data:image/png;base64,zzz"),
      createUuid: jest.fn().mockReturnValue("id-2")
    });

    const result = await controller.callImageGeneration("draw cat", "openrouter", null);
    expect(result).toEqual({ imageId: "id-2", mimeType: "image/png", dataUrl: "data:image/png;base64,zzz" });
    expect(deps.fetchFn).toHaveBeenCalledWith(
      "https://api.example.test/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("throws when selected model does not support images", async () => {
    const { controller } = buildController({
      resolveImageRouteFromCapabilities: jest.fn().mockReturnValue(null)
    });

    await expect(controller.callImageGeneration("draw", "openrouter", null)).rejects.toThrow("Image model required");
  });
});
