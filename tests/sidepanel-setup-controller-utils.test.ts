export {};

const {
  isProviderReady,
  updateSetupPanelVisibility,
  refreshSidebarSetupState
} = require("../src/sidepanel/sidepanel-setup-controller-utils.js");

describe("sidepanel-setup-controller-utils", () => {
  test("isProviderReady requires a non-empty OpenRouter key", () => {
    expect(isProviderReady({ or_api_key: "sk-or-123" })).toBe(true);
    expect(isProviderReady({ or_api_key: "   " })).toBe(false);
    expect(isProviderReady({})).toBe(false);
  });

  test("updateSetupPanelVisibility toggles setup and prompt sections", () => {
    const setupPanel = { style: { display: "" } };
    const promptContainer = { style: { display: "" } };
    const modelSection = { style: { display: "" } };
    const modelStatusEl = { textContent: "" };
    let setupRequired = false;

    updateSetupPanelVisibility(false, {
      setupPanel,
      promptContainer,
      modelSection,
      modelStatusEl,
      setSidebarSetupRequired: (value: boolean) => {
        setupRequired = value;
      }
    });

    expect(setupRequired).toBe(true);
    expect(setupPanel.style.display).toBe("flex");
    expect(promptContainer.style.display).toBe("none");
    expect(modelSection.style.display).toBe("none");
    expect(modelStatusEl.textContent).toMatch(/Add your OpenRouter API key/i);

    updateSetupPanelVisibility(true, {
      setupPanel,
      promptContainer,
      modelSection,
      modelStatusEl,
      setSidebarSetupRequired: (value: boolean) => {
        setupRequired = value;
      }
    });

    expect(setupRequired).toBe(false);
    expect(setupPanel.style.display).toBe("none");
    expect(promptContainer.style.display).toBe("");
    expect(modelSection.style.display).toBe("");
  });

  test("refreshSidebarSetupState reads storage and applies visibility", async () => {
    const setupPanel = { style: { display: "" } };
    const promptContainer = { style: { display: "" } };
    const modelSection = { style: { display: "" } };
    const modelStatusEl = { textContent: "" };

    const ready = await refreshSidebarSetupState({
      getLocalStorage: jest.fn().mockResolvedValue({ or_api_key: "sk-or-abc" }),
      setupPanel,
      promptContainer,
      modelSection,
      modelStatusEl,
      setSidebarSetupRequired: jest.fn()
    });

    expect(ready).toBe(true);
    expect(setupPanel.style.display).toBe("none");
  });
});