export {};

const { registerSidepanelRuntimeMessageHandlers } = require("../src/sidepanel/sidepanel-runtime-events-controller-utils.js");
const { registerProjectsRuntimeMessageHandlers } = require("../src/projects/projects-runtime-events-controller-utils.js");
const { registerOptionsRuntimeMessageHandlers } = require("../src/options/options-runtime-events-controller-utils.js");

function createRuntimeHarness() {
  let listener: ((msg: any) => void) | null = null;
  return {
    runtime: {
      onMessage: {
        addListener: (fn: any) => {
          listener = fn;
        },
        removeListener: (fn: any) => {
          if (listener === fn) listener = null;
        }
      }
    },
    dispatch: (msg: any) => {
      if (listener) listener(msg);
    }
  };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("runtime provider/model refresh integration", () => {
  test("sidepanel refreshes provider/model state and balance on provider updates", async () => {
    const harness = createRuntimeHarness();
    const deps = {
      runtime: harness.runtime,
      refreshSidebarSetupState: jest.fn().mockResolvedValue(true),
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      refreshBalance: jest.fn().mockResolvedValue(undefined),
      refreshFavoritesOnly: jest.fn().mockResolvedValue(undefined),
      balanceEl: { textContent: "" }
    };

    registerSidepanelRuntimeMessageHandlers(deps);
    harness.dispatch({ type: "provider_settings_updated" });
    await flushAsync();

    expect(deps.refreshSidebarSetupState).toHaveBeenCalledTimes(1);
    expect(deps.loadProviderSetting).toHaveBeenCalledTimes(1);
    expect(deps.loadModels).toHaveBeenCalledTimes(1);
    expect(deps.refreshBalance).toHaveBeenCalledTimes(1);
    expect(deps.balanceEl.textContent).toBe("");

    harness.dispatch({ type: "models_updated" });
    harness.dispatch({ type: "favorites_updated" });
    await flushAsync();

    expect(deps.loadModels).toHaveBeenCalledTimes(2);
    expect(deps.refreshFavoritesOnly).toHaveBeenCalledTimes(1);
  });

  test("sidepanel sets balance placeholder when provider is not ready", async () => {
    const harness = createRuntimeHarness();
    const balanceEl = { textContent: "123" };
    registerSidepanelRuntimeMessageHandlers({
      runtime: harness.runtime,
      refreshSidebarSetupState: jest.fn().mockResolvedValue(false),
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      refreshBalance: jest.fn().mockResolvedValue(undefined),
      refreshFavoritesOnly: jest.fn(),
      balanceEl
    });

    harness.dispatch({ type: "provider_settings_updated" });
    await flushAsync();

    expect(balanceEl.textContent).toBe("–");
  });

  test("projects refreshes provider/model state and emits informational toast", async () => {
    const harness = createRuntimeHarness();
    const showToast = jest.fn();
    registerProjectsRuntimeMessageHandlers({
      runtime: harness.runtime,
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      getProviderLabelSafe: jest.fn().mockReturnValue("OpenRouter"),
      showToast
    });

    harness.dispatch({ type: "provider_settings_updated", provider: "openrouter" });
    await flushAsync();

    expect(showToast).toHaveBeenCalledWith(
      "Provider updated. Update Project models to use OpenRouter.",
      "info"
    );
  });

  test("options throttles silent model refresh events", () => {
    const harness = createRuntimeHarness();
    const loadModels = jest.fn();
    let lastSilentAt = 0;

    registerOptionsRuntimeMessageHandlers({
      runtime: harness.runtime,
      getModelsLoadInFlight: () => false,
      getLastSilentModelsLoadAt: () => lastSilentAt,
      setLastSilentModelsLoadAt: (value: number) => { lastSilentAt = value; },
      minReloadIntervalMs: 1500,
      loadModels
    });

    harness.dispatch({ type: "models_updated" });
    harness.dispatch({ type: "models_updated" });

    expect(loadModels).toHaveBeenCalledTimes(1);
    expect(loadModels).toHaveBeenCalledWith({ silent: true });
  });
});
