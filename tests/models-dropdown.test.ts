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
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      favoritesKey: "fav_key",
      recentModelsKey: "recent_key",
      onModelSelect: jest.fn()
    });

    await dropdown.addToRecentlyUsed("openai/gpt-4o");

    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
      recent_key: ["openai/gpt-4o"]
    });
  });

  test("renders displayName when provided", () => {
    const globalAny = global as any;
    globalAny.groupModelsByProvider = jest.fn(() => ({
      Provider: [{ id: "openrouter:openai/gpt-4o", displayName: "OR-gpt-4o" }]
    }));

    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([{ id: "openrouter:openai/gpt-4o", displayName: "OR-gpt-4o" }]);
    dropdown.show("");

    const item = document.querySelector(".model-dropdown-item");
    expect(item?.textContent).toContain("OR-gpt-4o");
  });

  test("groups models by vendor label", () => {
    const input = document.getElementById("model-input");
    const dropdown = new ModelDropdownManager({
      inputElement: input,
      onModelSelect: jest.fn()
    });

    dropdown.setModels([
      { id: "openrouter:openai/gpt-4-turbo", provider: "openrouter", rawId: "openai/gpt-4-turbo", displayName: "OR-gpt-4-turbo" },
      { id: "naga:openai/gpt-4-turbo", provider: "naga", rawId: "openai/gpt-4-turbo", displayName: "NG-gpt-4-turbo" }
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
      { id: "naga:gpt-image-1", provider: "naga", rawId: "gpt-image-1", displayName: "NG-gpt-image-1" },
      { id: "openrouter:openai/gpt-4-turbo", provider: "openrouter", rawId: "openai/gpt-4-turbo", displayName: "OR-gpt-4-turbo" }
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
      { id: "naga:alibaba/qwen-2.5", provider: "naga", rawId: "alibaba/qwen-2.5", vendorLabel: "Qwen", displayName: "NG-qwen-2.5" }
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
      { id: "openrouter:qwen-2.5", provider: "openrouter", rawId: "qwen-2.5", displayName: "OR-qwen-2.5" }
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
      { id: "naga:openai/zzz-model", provider: "naga", rawId: "openai/zzz-model", displayName: "NG-zzz-model" },
      { id: "openrouter:openai/aaa-model", provider: "openrouter", rawId: "openai/aaa-model", displayName: "OR-aaa-model" },
      { id: "openrouter:openai/zzz-model", provider: "openrouter", rawId: "openai/zzz-model", displayName: "OR-zzz-model" }
    ]);
    dropdown.show("");

    const items = Array.from(document.querySelectorAll(".model-dropdown-item"))
      .map((el) => el.textContent);
    expect(items[0]).toContain("OR-aaa-model");
    expect(items[1]).toContain("NG-zzz-model");
    expect(items[2]).toContain("OR-zzz-model");
  });
});
