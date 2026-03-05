const { buildInputHandlers } = require("../src/modules/models-dropdown-events-utils.js");

describe("models-dropdown-events-utils", () => {
  test("buildInputHandlers opens dropdown on click", () => {
    const input = document.createElement("input");
    const manager = {
      state: { visible: false, isOpening: false, justOpened: false },
      show: jest.fn(),
      hide: jest.fn(),
      handleKeyDown: jest.fn(),
      dropdownElement: document.createElement("div")
    };

    const handlers = buildInputHandlers(manager, input);
    handlers.onInputClick({ stopPropagation: jest.fn() });

    expect(manager.show).toHaveBeenCalled();
  });
});
