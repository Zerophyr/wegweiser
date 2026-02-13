const { saveToggleSettings } = require("../src/sidepanel/sidepanel-model-controller-utils.js");

describe("sidepanel-model-controller-utils", () => {
  test("saveToggleSettings persists current state", async () => {
    const state = {
      webSearchEnabled: true,
      reasoningEnabled: false,
      imageModeEnabled: true
    };
    const setLocalStorage = jest.fn().mockResolvedValue(undefined);
    await saveToggleSettings({ state, setLocalStorage });

    expect(setLocalStorage).toHaveBeenCalledWith({
      or_web_search: true,
      or_reasoning: false,
      imageModeEnabled: true
    });
  });
});
