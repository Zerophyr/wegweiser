export {};
const { deriveModelCapabilities, resolveImageRouteFromCapabilities } = require("../src/shared/model-capabilities.js");

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
});
