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
});
