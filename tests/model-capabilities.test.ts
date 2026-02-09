export {};
const {
  deriveModelCapabilities,
  resolveImageRouteFromCapabilities,
  hasModelCapabilityFields
} = require("../src/shared/model-capabilities.js");

describe("model capabilities", () => {
  test("derives chat+image model capabilities", () => {
    const model = {
      supported_endpoints: ["/chat/completions", "/images/generations"],
      architecture: { output_modalities: ["text", "image"] }
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.supportsChat).toBe(true);
    expect(caps.supportsImages).toBe(true);
    expect(caps.outputsImage).toBe(true);
    expect(caps.isImageOnly).toBe(false);
  });

  test("derives image-only model capabilities", () => {
    const model = {
      supported_endpoints: ["/images/generations"],
      architecture: { output_modalities: ["image"] }
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.isImageOnly).toBe(true);
  });

  test("routes by capabilities", () => {
    const caps = { supportsChat: true, outputsImage: true, supportsImages: true };
    expect(resolveImageRouteFromCapabilities(caps)).toBe("chat");
  });

  test("handles output_modalities as string", () => {
    const model = {
      supported_endpoints: ["/chat/completions"],
      architecture: { output_modalities: "image" }
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.outputsImage).toBe(true);
  });

  test("derives image support from top-level output_modalities", () => {
    const model = {
      output_modalities: ["image"]
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.supportsImages).toBe(true);
    expect(caps.outputsImage).toBe(true);
    expect(caps.supportsChat).toBe(false);
    expect(caps.isImageOnly).toBe(true);
  });

  test("marks image-only even if chat endpoint exists when outputs are image-only", () => {
    const model = {
      supported_endpoints: ["chat.completions"],
      output_modalities: ["image"],
      modality: "text+image"
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.outputsImage).toBe(true);
    expect(caps.isImageOnly).toBe(true);
  });

  test("derives image-only from modality string", () => {
    const model = {
      architecture: { modality: "text->image" }
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.outputsImage).toBe(true);
    expect(caps.supportsImages).toBe(true);
    expect(caps.supportsChat).toBe(false);
    expect(caps.isImageOnly).toBe(true);
  });

  test("derives chat+image from modality string", () => {
    const model = {
      architecture: { modality: "text+image->text+image" }
    };
    const caps = deriveModelCapabilities(model);
    expect(caps.outputsImage).toBe(true);
    expect(caps.supportsChat).toBe(true);
    expect(caps.isImageOnly).toBe(false);
  });

  test("detects missing capability fields in cached models", () => {
    expect(hasModelCapabilityFields({ id: "old-model" })).toBe(false);
    expect(hasModelCapabilityFields({
      supportsChat: false,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false,
      supportedParameters: null
    })).toBe(true);
  });
});
