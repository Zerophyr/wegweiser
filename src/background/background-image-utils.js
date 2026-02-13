// background-image-utils.js - Image/model capability helper functions for background worker

function extractOpenRouterImageUrl(message) {
  const images = Array.isArray(message?.images) ? message.images : [];
  if (images.length) {
    const first = images[0] || {};
    const imageUrl = first.image_url || first.imageUrl || {};
    return imageUrl.url || first.url || "";
  }

  const contentParts = Array.isArray(message?.content) ? message.content : [];
  const imagePart = contentParts.find((part) => part?.type === "image_url");
  const url = imagePart?.image_url?.url || imagePart?.url || "";
  return typeof url === "string" ? url : "";
}

function buildDataUrlFromBase64(base64, mimeType = "image/png") {
  if (!base64 || typeof base64 !== "string") return "";
  if (base64.startsWith("data:")) return base64;
  return `data:${mimeType};base64,${base64}`;
}

function isNagaChatImageModel(modelId) {
  if (!modelId || typeof modelId !== "string") return false;
  const normalized = modelId.toLowerCase();
  if (!normalized.startsWith("gemini-")) return false;
  return normalized.includes("image");
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(imageUrl, invalidResponseMessage = "Invalid response") {
  if (!imageUrl) return "";
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(invalidResponseMessage);
  }
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const mimeType = blob.type || res.headers.get("content-type") || "image/png";
  return buildDataUrlFromBase64(base64, mimeType);
}

function resolveModelCapabilitiesFromList(models, modelId) {
  if (!Array.isArray(models) || !modelId) {
    return {
      supportsChat: false,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false
    };
  }
  const match = models.find((model) => model?.id === modelId);
  if (!match) {
    return {
      supportsChat: false,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false
    };
  }
  return {
    supportsChat: Boolean(match.supportsChat),
    supportsImages: Boolean(match.supportsImages),
    outputsImage: Boolean(match.outputsImage),
    isImageOnly: Boolean(match.isImageOnly)
  };
}

const backgroundImageUtils = {
  extractOpenRouterImageUrl,
  buildDataUrlFromBase64,
  isNagaChatImageModel,
  arrayBufferToBase64,
  fetchImageAsDataUrl,
  resolveModelCapabilitiesFromList
};

if (typeof window !== "undefined") {
  window.backgroundImageUtils = backgroundImageUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundImageUtils = backgroundImageUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundImageUtils;
}
