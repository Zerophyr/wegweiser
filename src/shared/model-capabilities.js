// model-capabilities.js - derive model capabilities from provider metadata

function normalizeModalities(list) {
  if (!Array.isArray(list)) return [];
  return list.map((value) => String(value).toLowerCase());
}

function deriveModelCapabilities(model) {
  const endpoints = Array.isArray(model?.supported_endpoints)
    ? model.supported_endpoints
    : [];
  const outputModalities = normalizeModalities(model?.architecture?.output_modalities);
  const supportsChat = endpoints.includes("/chat/completions") || endpoints.includes("chat.completions");
  const supportsImages = endpoints.includes("/images/generations") || endpoints.includes("images.generations");
  const outputsImage = outputModalities.includes("image");
  const isImageOnly = supportsImages && !supportsChat;
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

if (typeof window !== "undefined") {
  window.deriveModelCapabilities = deriveModelCapabilities;
  window.resolveImageRouteFromCapabilities = resolveImageRouteFromCapabilities;
}

if (typeof globalThis !== "undefined") {
  globalThis.deriveModelCapabilities = deriveModelCapabilities;
  globalThis.resolveImageRouteFromCapabilities = resolveImageRouteFromCapabilities;
}

if (typeof module !== "undefined") {
  module.exports = {
    deriveModelCapabilities,
    resolveImageRouteFromCapabilities
  };
}
