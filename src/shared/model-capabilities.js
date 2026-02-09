// model-capabilities.js - derive model capabilities from provider metadata

function normalizeModalities(list) {
  if (Array.isArray(list)) {
    return list.map((value) => String(value).toLowerCase());
  }
  if (typeof list === "string") {
    return [list.toLowerCase()];
  }
  return [];
}

function parseModalityString(modality) {
  if (typeof modality !== "string") {
    return { inputs: [], outputs: [] };
  }
  const [inputRaw, outputRaw] = modality.toLowerCase().split("->");
  const splitTokens = (part) =>
    part
      .split(/[+,]/)
      .map((value) => value.trim())
      .filter(Boolean);
  const inputs = splitTokens(inputRaw || "");
  const outputs = splitTokens(outputRaw || inputRaw || "");
  return { inputs, outputs };
}

function deriveModelCapabilities(model) {
  const endpoints = Array.isArray(model?.supported_endpoints)
    ? model.supported_endpoints
    : [];
  const outputModalities = normalizeModalities(
    model?.architecture?.output_modalities ||
      model?.architecture?.output_modality ||
      model?.output_modalities ||
      model?.output_modality
  );
  const modalityValue = model?.architecture?.modality || model?.architecture?.modalities || model?.modality;
  const modalityOutputs = parseModalityString(modalityValue).outputs;
  const outputsCombined = outputModalities.length ? outputModalities : modalityOutputs;
  const outputsImage = outputsCombined.includes("image");
  const outputsText = outputsCombined.includes("text");
  const supportsChat = endpoints.includes("/chat/completions") ||
    endpoints.includes("chat.completions") ||
    outputsText;
  const supportsImages = endpoints.includes("/images/generations") ||
    endpoints.includes("images.generations") ||
    outputsImage;
  const isImageOnly = supportsImages && !outputsText;
  return {
    supportsChat,
    supportsImages,
    outputsImage,
    isImageOnly
  };
}

function resolveImageRouteFromCapabilities(caps) {
  if (caps?.supportsChat && caps?.outputsImage) return "chat";
  if (caps?.supportsImages) return "images";
  return null;
}

function hasModelCapabilityFields(model) {
  if (!model || typeof model !== "object") return false;
  const hasBooleans =
    typeof model.supportsChat === "boolean" &&
    typeof model.supportsImages === "boolean" &&
    typeof model.outputsImage === "boolean" &&
    typeof model.isImageOnly === "boolean";
  if (!hasBooleans) return false;
  return "supportedParameters" in model || "supported_parameters" in model;
}

if (typeof window !== "undefined") {
  window.deriveModelCapabilities = deriveModelCapabilities;
  window.resolveImageRouteFromCapabilities = resolveImageRouteFromCapabilities;
  window.hasModelCapabilityFields = hasModelCapabilityFields;
}

if (typeof globalThis !== "undefined") {
  globalThis.deriveModelCapabilities = deriveModelCapabilities;
  globalThis.resolveImageRouteFromCapabilities = resolveImageRouteFromCapabilities;
  globalThis.hasModelCapabilityFields = hasModelCapabilityFields;
}

if (typeof module !== "undefined") {
  module.exports = {
    deriveModelCapabilities,
    resolveImageRouteFromCapabilities,
    hasModelCapabilityFields
  };
}
