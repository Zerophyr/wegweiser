export {};

const {
  buildCreateProjectModalViewState,
  buildEditProjectModalViewState
} = require("../src/projects/projects-project-modal-utils.js");

describe("projects project modal utils", () => {
  test("buildCreateProjectModalViewState returns create defaults", () => {
    const state = buildCreateProjectModalViewState();
    expect(state.title).toBe("Create Project");
    expect(state.saveLabel).toBe("Create Project");
    expect(state.icon).toBe("📁");
    expect(state.webSearch).toBe(false);
    expect(state.reasoning).toBe(false);
  });

  test("buildEditProjectModalViewState maps project into editable fields", () => {
    const state = buildEditProjectModalViewState({
      project: {
        name: "Alpha",
        description: "Desc",
        icon: "🚀",
        model: "model-1",
        modelProvider: "naga",
        customInstructions: "Be concise",
        webSearch: true,
        reasoning: false
      },
      currentProvider: "openrouter",
      normalizeProvider: (p: string) => p,
      buildCombinedModelId: (provider: string, modelId: string) => `${provider}:${modelId}`,
      getProjectModelLabel: () => "Model One"
    });

    expect(state.title).toBe("Edit Project");
    expect(state.saveLabel).toBe("Save Changes");
    expect(state.name).toBe("Alpha");
    expect(state.icon).toBe("🚀");
    expect(state.modelCombinedId).toBe("naga:model-1");
    expect(state.modelDisplayName).toBe("Model One");
    expect(state.webSearch).toBe(true);
  });
});
