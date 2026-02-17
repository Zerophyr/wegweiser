export {};

const {
  renderProjectModelSelectOptions
} = require("../src/projects/projects-model-select-utils.js");

describe("projects-model-select-utils", () => {
  test("renders default option and models with selected state", () => {
    document.body.innerHTML = '<select id="project-model"></select>';
    const selectEl = document.getElementById("project-model") as HTMLSelectElement;

    renderProjectModelSelectOptions(
      selectEl,
      [
        { id: "openrouter:model-a", name: "Model A" },
        { id: "openrouter:model-b", name: "Model B" }
      ],
      "openrouter:model-b",
      (model: { name: string }) => model.name
    );

    expect(selectEl.options).toHaveLength(3);
    expect(selectEl.options[0].textContent).toBe("Use default model");
    expect(selectEl.options[1].value).toBe("openrouter:model-a");
    expect(selectEl.options[2].selected).toBe(true);
  });

  test("falls back to model name/id resolver when no display function is provided", () => {
    document.body.innerHTML = '<select id="project-model"></select>';
    const selectEl = document.getElementById("project-model") as HTMLSelectElement;

    renderProjectModelSelectOptions(selectEl, [{ id: "openrouter:model-x" }], "", null as any);

    expect(selectEl.options[1].textContent).toBe("openrouter:model-x");
  });
});
