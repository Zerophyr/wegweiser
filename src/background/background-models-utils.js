// background-models-utils.js - Payload/cache helpers for provider models

function parseModelsPayload(payload, deriveCapabilities) {
  const deriveModelCapabilities = typeof deriveCapabilities === "function"
    ? deriveCapabilities
    : (() => ({
      supportsChat: false,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false
    }));
  const list = Array.isArray(payload) ? payload : (payload?.data || []);
  return list.map((model) => {
    const supportedEndpoints = Array.isArray(model?.supported_endpoints)
      ? model.supported_endpoints
      : (Array.isArray(model?.supportedEndpoints) ? model.supportedEndpoints : []);
    const supportedParametersRaw = Array.isArray(model?.supported_parameters)
      ? model.supported_parameters
      : (Array.isArray(model?.supportedParameters) ? model.supportedParameters : null);
    const supportedParameters = supportedParametersRaw
      ? supportedParametersRaw.map((value) => String(value).toLowerCase())
      : null;
    const architecture = model?.architecture || model?.arch || null;
    const derived = deriveModelCapabilities({
      supported_endpoints: supportedEndpoints,
      architecture,
      output_modalities: model?.output_modalities,
      output_modality: model?.output_modality,
      input_modalities: model?.input_modalities,
      modality: model?.modality,
      modalities: model?.modalities
    });

    return {
      id: model.id,
      name: model.name || model.id,
      ownedBy: model.owned_by || model.ownedBy || model.owner || "",
      supportedEndpoints,
      supportedParameters,
      supportsReasoning: typeof model.supports_reasoning === "boolean"
        ? model.supports_reasoning
        : (typeof model.supportsReasoning === "boolean" ? model.supportsReasoning : undefined),
      supportsChat: Boolean(derived?.supportsChat),
      supportsImages: Boolean(derived?.supportsImages),
      outputsImage: Boolean(derived?.outputsImage),
      isImageOnly: Boolean(derived?.isImageOnly)
    };
  });
}

const backgroundModelsUtils = {
  parseModelsPayload
};

if (typeof window !== "undefined") {
  window.backgroundModelsUtils = backgroundModelsUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundModelsUtils = backgroundModelsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundModelsUtils;
}
