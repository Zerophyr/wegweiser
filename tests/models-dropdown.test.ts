export {};
const { ModelDropdownManager } = require("../src/modules/models-dropdown.js");

describe("ModelDropdownManager storage keys", () => {
  beforeEach(() => {
    const globalAny = global as any;
    document.body.innerHTML = '<input id="model-input" />';
    globalAny.groupModelsByProvider = jest.fn(() => ({}));
    globalAny.chrome = {
      storage: {
        sync: {
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue({})
        },
        local: {
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue({})
        }
      }
    } as any;
  });

  test("toggleFavorite uses configured favoritesKey", async () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      onModelSelect: jest.fn()
    });

    dropdown.show = jest.fn();

    await dropdown.toggleFavorite("openai/gpt-4o");

    expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
      fav_key: ["openai/gpt-4o"]
    });
  });

  test("addToRecentlyUsed uses configured recentModelsKey", async () => {
    const globalAny = global as any;
    globalAny.setEncrypted = jest.fn().mockResolvedValue(undefined);

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      onModelSelect: jest.fn()
    });

    await dropdown.addToRecentlyUsed("openai/gpt-4o");

    expect(globalAny.setEncrypted).toHaveBeenCalledWith({
      recent_key: ["openai/gpt-4o"]
    });

    delete globalAny.setEncrypted;
  });

  test("loadRecentlyUsedModels uses encrypted storage when available", async () => {
    const globalAny = global as any;
    globalAny.getEncrypted = jest.fn().mockResolvedValue({ recent_key: ["openai/gpt-4o"] });

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      onModelSelect: jest.fn()
    });

    await dropdown.loadRecentlyUsedModels();

    expect(globalAny.getEncrypted).toHaveBeenCalledWith(["recent_key"]);
    expect(dropdown.state.recentlyUsedModels).toEqual(["openai/gpt-4o"]);

    delete globalAny.getEncrypted;
  });

  test("loadRecentlyUsedModels normalizes invalid stored value", async () => {
    const globalAny = global as any;
    globalAny.getEncrypted = jest.fn().mockResolvedValue({ recent_key: { bad: true } });
    globalAny.setEncrypted = jest.fn().mockResolvedValue(undefined);

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      onModelSelect: jest.fn()
    });

    await dropdown.loadRecentlyUsedModels();

    expect(dropdown.state.recentlyUsedModels).toEqual([]);
    expect(globalAny.setEncrypted).toHaveBeenCalledWith({ recent_key: [] });

    delete globalAny.getEncrypted;
    delete globalAny.setEncrypted;
  });

  test("loadRecentlyUsedModels does not override provided recents when preferProvidedRecents is true", async () => {
    const globalAny = global as any;
    globalAny.getEncrypted = jest.fn().mockResolvedValue({ recent_key: ["openai/gpt-4o"] });

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      preferProvidedRecents: true,
      onModelSelect: jest.fn()
    });

    dropdown.setRecentlyUsed(["openrouter:openai/gpt-4o"]);

    await dropdown.loadRecentlyUsedModels();

    expect(dropdown.state.recentlyUsedModels).toEqual(["openrouter:openai/gpt-4o"]);

    delete globalAny.getEncrypted;
  });

  test("recent models render after async load when dropdown already open", async () => {
    const globalAny = global as any;
    globalAny.getEncrypted = jest.fn().mockResolvedValue({ recent_key: ["openai/gpt-4o"] });

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "openai/gpt-4o", displayName: "openai/gpt-4o" }
    ]);

    dropdown.show("");

    await dropdown.loadRecentlyUsedModels();

    expect(document.body.textContent).toContain("Recently Used");

    delete globalAny.getEncrypted;
  });

  test("setRecentlyUsed trims to maxRecentModels", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn(),
      maxRecentModels: 5
    });

    dropdown.setRecentlyUsed(["a", "b", "c", "d", "e", "f"]);

    expect(dropdown.state.recentlyUsedModels).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("bindInput reattaches listeners to a new input", () => {
    const firstInput = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: firstInput,
      onModelSelect: jest.fn()
    });

    const nextInput = document.createElement("input");
    nextInput.id = "model-input-next";
    document.body.appendChild(nextInput);

    dropdown.show = jest.fn();
    dropdown.bindInput(nextInput);
    nextInput.dispatchEvent(new Event("click", { bubbles: true }));

    expect(dropdown.show).toHaveBeenCalled();
  });

  test("pointerdown opens dropdown", () => {
    const input = document.getElementById("model-input") as HTMLInputElement;
    if (!input) {
      throw new Error("model input not found");
    }
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.show = jest.fn();
    input.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(dropdown.show).toHaveBeenCalled();
  });

  test("blur does not close immediately after open", () => {
    const input = document.getElementById("model-input") as HTMLInputElement;
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.state.visible = true;
    dropdown.state.justOpened = true;
    dropdown.hide = jest.fn();

    const originalRaf = (global as any).requestAnimationFrame;
    (global as any).requestAnimationFrame = (cb: () => void) => cb();
    Object.defineProperty(document, "activeElement", {
      value: document.body,
      configurable: true
    });

    dropdown.handlers.onInputBlur();

    expect(dropdown.hide).not.toHaveBeenCalled();

    (global as any).requestAnimationFrame = originalRaf;
  });

  test("doc mousedown does not close while opening", () => {
    const input = document.getElementById("model-input") as HTMLInputElement;
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.state.visible = true;
    dropdown.state.isOpening = true;
    dropdown.hide = jest.fn();

    const outside = document.createElement("div");
    document.body.appendChild(outside);

    dropdown.handlers.onDocMouseDown({ target: outside });

    expect(dropdown.hide).not.toHaveBeenCalled();
  });

  test("renders displayName when provided", () => {
    const globalAny = global as any;
    globalAny.groupModelsByProvider = jest.fn(() => ({
      Provider: [{ id: "openrouter:openai/gpt-4o", displayName: "openai/gpt-4o" }]
    }));

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([{ id: "openrouter:openai/gpt-4o", displayName: "openai/gpt-4o" }]);
    dropdown.show("");

    const item = document.querySelector(".model-dropdown-item");
    expect(item?.textContent).toContain("openai/gpt-4o");
  });

  test("groups models by vendor label", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "openrouter:openai/gpt-4-turbo", provider: "openrouter", rawId: "openai/gpt-4-turbo", displayName: "openai/gpt-4-turbo" },
      { id: "naga:openai/gpt-4-turbo", provider: "naga", rawId: "openai/gpt-4-turbo", displayName: "openai/gpt-4-turbo" }
    ]);
    dropdown.show("");

    const headers = Array.from(document.querySelectorAll(".model-dropdown-provider"))
      .map((el) => el.textContent);
    expect(headers).toContain("OpenAI");
  });

  test("infers vendor when rawId has no prefix", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "naga:gpt-image-1", provider: "naga", rawId: "gpt-image-1", displayName: "gpt-image-1" },
      { id: "openrouter:openai/gpt-4-turbo", provider: "openrouter", rawId: "openai/gpt-4-turbo", displayName: "openai/gpt-4-turbo" }
    ]);
    dropdown.show("");

    const headers = Array.from(document.querySelectorAll(".model-dropdown-provider"))
      .map((el) => el.textContent);
    expect(headers).toContain("OpenAI");
    expect(headers).not.toContain("Gpt-image-1");
    expect(headers.length).toBe(1);
  });

  test("uses vendorLabel when provided", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "naga:alibaba/qwen-2.5", provider: "naga", rawId: "alibaba/qwen-2.5", vendorLabel: "Qwen", displayName: "alibaba/qwen-2.5" }
    ]);
    dropdown.show("");

    const headers = Array.from(document.querySelectorAll(".model-dropdown-provider"))
      .map((el) => el.textContent);
    expect(headers).toContain("Qwen");
  });

  test("infers qwen vendor from unprefixed name", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "openrouter:qwen-2.5", provider: "openrouter", rawId: "qwen-2.5", displayName: "qwen-2.5" }
    ]);
    dropdown.show("");

    const headers = Array.from(document.querySelectorAll(".model-dropdown-provider"))
      .map((el) => el.textContent);
    expect(headers).toContain("Qwen");
  });

  test("sorts by base name with NG before OR", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "naga:openai/zzz-model", provider: "naga", rawId: "openai/zzz-model", displayName: "openai/zzz-model" },
      { id: "openrouter:openai/aaa-model", provider: "openrouter", rawId: "openai/aaa-model", displayName: "openai/aaa-model" },
      { id: "openrouter:openai/zzz-model", provider: "openrouter", rawId: "openai/zzz-model", displayName: "openai/zzz-model" }
    ]);
    dropdown.show("");

    const items = Array.from(document.querySelectorAll(".model-dropdown-item"))
      .map((el) => el.textContent);
    expect(items[0]).toContain("openai/aaa-model");
    expect(items[1]).toContain("openai/zzz-model");
    expect(items[2]).toContain("openai/zzz-model");
  });

  test("renders provider badges", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "openrouter:openai/gpt-4o", provider: "openrouter", rawId: "openai/gpt-4o", displayName: "openai/gpt-4o" },
      { id: "naga:openai/gpt-4o", provider: "naga", rawId: "openai/gpt-4o", displayName: "openai/gpt-4o" }
    ]);
    dropdown.show("");

    const badges = Array.from(document.querySelectorAll(".model-provider-badge"))
      .map((el) => el.textContent);
    expect(badges).toContain("OR");
    expect(badges).not.toContain("NG");
  });

  test("does not render image badges in model list", () => {
    const globalAny = global as any;
    globalAny.groupModelsByProvider = jest.fn(() => ({
      Test: [
        {
          id: "openrouter:openai/gpt-image-1",
          provider: "openrouter",
          rawId: "openai/gpt-image-1",
          displayName: "openai/gpt-image-1",
          outputsImage: true
        }
      ]
    }));

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      {
        id: "openrouter:openai/gpt-image-1",
        provider: "openrouter",
        rawId: "openai/gpt-image-1",
        displayName: "openai/gpt-image-1",
        outputsImage: true
      }
    ]);
    dropdown.show("");

    expect(document.querySelector(".model-image-badge")).toBeNull();
  });

  test("destroy removes input and document listeners", () => {
    const input = document.getElementById("model-input") as HTMLInputElement;
    if (!input) {
      throw new Error("model input not found");
    }
    const docAddSpy = jest.spyOn(document, "addEventListener");
    const docRemoveSpy = jest.spyOn(document, "removeEventListener");
    const inputAddSpy = jest.spyOn(input, "addEventListener");
    const inputRemoveSpy = jest.spyOn(input, "removeEventListener");

    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    expect(docAddSpy).toHaveBeenCalled();
    expect(inputAddSpy).toHaveBeenCalled();

    dropdown.destroy();

    expect(docRemoveSpy).toHaveBeenCalled();
    expect(inputRemoveSpy).toHaveBeenCalled();

    docAddSpy.mockRestore();
    docRemoveSpy.mockRestore();
    inputAddSpy.mockRestore();
    inputRemoveSpy.mockRestore();
  });

  test("UI listens for models_updated", () => {
    const fs = require("fs");
    const path = require("path");
    const sidepanel = fs.readFileSync(
      path.join(__dirname, "../src/sidepanel/sidepanel-runtime-events-controller-utils.js"),
      "utf8"
    );
    const projects = fs.readFileSync(
      path.join(__dirname, "../src/projects/projects-runtime-events-controller-utils.js"),
      "utf8"
    );
    expect(sidepanel).toMatch(/models_updated/);
    expect(projects).toMatch(/models_updated/);
  });

  test("preserves selected model text until typing begins", async () => {
    const input = document.getElementById("model-input") as HTMLInputElement;
    input.value = "openai/gpt-4o";

    const dropdown = new ModelDropdownManager({
      inputElement: input,
      clearInputOnType: true,
      onModelSelect: jest.fn().mockResolvedValue(true)
    });

    await dropdown.selectModel("openrouter:openai/gpt-4o");

    expect(input.value).toBe("openai/gpt-4o");

    dropdown.state.visible = true;
    dropdown.handleKeyDown({
      key: "g",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: jest.fn()
    });

    expect(input.value).toBe("");
  });

  test("selectModel does not refocus the model input after selection", async () => {
    const input = document.getElementById("model-input") as HTMLInputElement;
    input.value = "openai/gpt-4o";

    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn().mockResolvedValue(true)
    });

    const focusSpy = jest.spyOn(dropdown, "focusInput");
    dropdown.show("");
    focusSpy.mockClear();

    await dropdown.selectModel("openrouter:openai/gpt-4o");

    expect(focusSpy).not.toHaveBeenCalled();
  });

  test("render tolerates non-array recentlyUsedModels", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      {
        id: "openrouter:openai/gpt-4o",
        provider: "openrouter",
        rawId: "openai/gpt-4o",
        displayName: "openai/gpt-4o"
      }
    ]);
    dropdown.state.recentlyUsedModels = { invalid: true } as any;

    expect(() => dropdown.show("")).not.toThrow();
  });
});

