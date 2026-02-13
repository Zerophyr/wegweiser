export {};

const {
  buildProjectFormData
} = require("../src/projects/projects-form-utils.js");

describe("projects form utils", () => {
  test("buildProjectFormData resolves provider/model/display name from combined id", () => {
    const form = {
      ProjectName: { value: "Alpha" },
      ProjectDescription: { value: "Desc" },
      ProjectIcon: { value: "🚀" },
      ProjectModel: { value: "naga:model-1" },
      ProjectModelInput: { value: "Model One" },
      ProjectInstructions: { value: "  Be concise  " },
      ProjectWebSearch: { checked: true },
      ProjectReasoning: { checked: false }
    };

    const data = buildProjectFormData({
      elements: form,
      parseCombinedModelId: (id: string) => ({ provider: id.split(":")[0], modelId: id.split(":")[1] }),
      normalizeProvider: (p: string) => p,
      buildModelDisplayName: () => "fallback"
    });

    expect(data).toEqual({
      name: "Alpha",
      description: "Desc",
      icon: "🚀",
      model: "model-1",
      modelProvider: "naga",
      modelDisplayName: "Model One",
      customInstructions: "Be concise",
      webSearch: true,
      reasoning: false
    });
  });

  test("buildProjectFormData falls back for empty model selection", () => {
    const form = {
      ProjectName: { value: "Beta" },
      ProjectDescription: { value: "" },
      ProjectIcon: { value: "" },
      ProjectModel: { value: "" },
      ProjectModelInput: { value: "" },
      ProjectInstructions: { value: "" },
      ProjectWebSearch: { checked: false },
      ProjectReasoning: { checked: true }
    };

    const data = buildProjectFormData({
      elements: form,
      parseCombinedModelId: () => ({ provider: "openrouter", modelId: "" }),
      normalizeProvider: (p: string) => p,
      buildModelDisplayName: () => "fallback"
    });

    expect(data.model).toBe("");
    expect(data.modelProvider).toBeNull();
    expect(data.modelDisplayName).toBe("");
    expect(data.icon).toBe("📁");
    expect(data.reasoning).toBe(true);
  });
});
