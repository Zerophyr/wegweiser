// background-image-controller-utils.js - Image generation orchestration

function createBackgroundImageController(rawDeps) {
  const deps = rawDeps || {};

  const normalizeProviderId = deps.normalizeProviderId || ((providerId) => providerId || "openrouter");
  const getProviderConfig = deps.getProviderConfig || (() => ({ baseUrl: "" }));
  const getApiKeyForProvider = deps.getApiKeyForProvider || (async () => "");
  const cachedConfig = deps.cachedConfig || {};
  const defaults = deps.defaults || { MODEL: "openai/gpt-4o-mini" };
  const apiConfig = deps.apiConfig || { TIMEOUT: 120000 };
  const errorMessages = deps.errorMessages || {
    NO_PROMPT: "Enter a prompt first.",
    NO_API_KEY: "No API key set.",
    API_ERROR: "API error.",
    INVALID_RESPONSE: "Invalid response.",
    IMAGE_MODEL_REQUIRED: "Selected model does not support image generation."
  };
  const getProviderModels = deps.getProviderModels || (async () => []);
  const resolveModelCapabilitiesFromList = deps.resolveModelCapabilitiesFromList || (() => ({
    supportsChat: false,
    supportsImages: false,
    outputsImage: false,
    isImageOnly: false
  }));
  const resolveImageRouteFromCapabilities = deps.resolveImageRouteFromCapabilities || (() => null);
  const buildAuthHeaders = deps.buildAuthHeaders || (() => ({}));
  const extractOpenRouterImageUrl = deps.extractOpenRouterImageUrl || (() => "");
  const buildDataUrlFromBase64 = deps.buildDataUrlFromBase64 || (() => "");
  const fetchImageAsDataUrl = deps.fetchImageAsDataUrl || (async () => "");
  const fetchFn = deps.fetchFn || fetch;
  const setTimeoutFn = deps.setTimeoutFn || setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn || clearTimeout;
  const createUuid = deps.createUuid || (() => crypto.randomUUID());

  async function callImageGeneration(prompt, providerId, modelId) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error(errorMessages.NO_PROMPT);
    }

    const provider = normalizeProviderId(providerId);
    const providerConfig = getProviderConfig(provider);
    const apiKey = await getApiKeyForProvider(provider);
    if (!apiKey) {
      throw new Error(errorMessages.NO_API_KEY);
    }

    const model = modelId || cachedConfig.model || defaults.MODEL;
    const controller = new AbortController();
    const timeoutId = setTimeoutFn(() => controller.abort(), apiConfig.TIMEOUT);

    try {
      const models = await getProviderModels(provider, apiKey);
      const capabilities = resolveModelCapabilitiesFromList(models, model);
      const route = resolveImageRouteFromCapabilities(capabilities);

      if (!route) {
        throw new Error(errorMessages.IMAGE_MODEL_REQUIRED);
      }

      if (route === "images") {
        const res = await fetchFn(`${providerConfig.baseUrl}/images/generations`, {
          method: "POST",
          headers: buildAuthHeaders(apiKey, providerConfig),
          body: JSON.stringify({
            model,
            prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
          }),
          signal: controller.signal
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error?.message || errorMessages.API_ERROR);
        }

        const firstImage = data?.data?.[0] || {};
        const imageBase64 = firstImage?.b64_json || "";
        const imageUrl = firstImage?.url || "";

        let dataUrl = "";
        if (imageBase64) {
          dataUrl = buildDataUrlFromBase64(imageBase64);
        } else if (imageUrl) {
          dataUrl = await fetchImageAsDataUrl(imageUrl, errorMessages.INVALID_RESPONSE);
        }

        if (!dataUrl) {
          throw new Error(errorMessages.INVALID_RESPONSE);
        }

        const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch?.[1] || "image/png";
        return {
          imageId: createUuid(),
          mimeType,
          dataUrl
        };
      }

      const res = await fetchFn(`${providerConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: buildAuthHeaders(apiKey, providerConfig),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"]
        }),
        signal: controller.signal
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || errorMessages.API_ERROR);
      }

      const message = data?.choices?.[0]?.message || {};
      const imageUrl = extractOpenRouterImageUrl(message);
      if (!imageUrl) {
        throw new Error(errorMessages.INVALID_RESPONSE);
      }

      const mimeMatch = imageUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch?.[1] || "image/png";
      return {
        imageId: createUuid(),
        mimeType,
        dataUrl: imageUrl
      };
    } finally {
      clearTimeoutFn(timeoutId);
    }
  }

  return {
    callImageGeneration
  };
}

const backgroundImageControllerUtils = {
  createBackgroundImageController
};

if (typeof window !== "undefined") {
  window.backgroundImageControllerUtils = backgroundImageControllerUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundImageControllerUtils = backgroundImageControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundImageControllerUtils;
}
