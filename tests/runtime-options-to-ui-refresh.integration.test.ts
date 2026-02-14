export {};

const { registerSidepanelRuntimeMessageHandlers } = require("../src/sidepanel/sidepanel-runtime-events-controller-utils.js");
const { registerProjectsRuntimeMessageHandlers } = require("../src/projects/projects-runtime-events-controller-utils.js");
const { registerOptionsRuntimeMessageHandlers } = require("../src/options/options-runtime-events-controller-utils.js");
const { notifyProviderSettingsUpdated } = require("../src/options/options-notify-utils.js");

function createRuntimeBusHarness() {
  const listeners: Array<(msg: any) => void> = [];

  const runtime = {
    onMessage: {
      addListener: (fn: (msg: any) => void) => {
        listeners.push(fn);
      },
      removeListener: (fn: (msg: any) => void) => {
        const index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      }
    },
    sendMessage: async (msg: any) => {
      listeners.slice().forEach((listener) => listener(msg));
      return { ok: true };
    }
  };

  return {
    runtime,
    dispatch: (msg: any) => {
      listeners.slice().forEach((listener) => listener(msg));
    },
    listenerCount: () => listeners.length
  };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("runtime options -> ui refresh integration", () => {
  test("provider settings update from options refreshes sidepanel and projects", async () => {
    const harness = createRuntimeBusHarness();
    let lastSilentAt = 0;

    const sidepanelDeps = {
      runtime: harness.runtime,
      refreshSidebarSetupState: jest.fn().mockResolvedValue(true),
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      refreshBalance: jest.fn().mockResolvedValue(undefined),
      refreshFavoritesOnly: jest.fn(),
      balanceEl: { textContent: "" }
    };

    const projectsDeps = {
      runtime: harness.runtime,
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      getProviderLabelSafe: jest.fn().mockReturnValue("OpenRouter"),
      showToast: jest.fn()
    };

    const optionsDeps = {
      runtime: harness.runtime,
      getModelsLoadInFlight: () => false,
      getLastSilentModelsLoadAt: () => lastSilentAt,
      setLastSilentModelsLoadAt: (value: number) => {
        lastSilentAt = value;
      },
      minReloadIntervalMs: 1500,
      loadModels: jest.fn()
    };

    registerSidepanelRuntimeMessageHandlers(sidepanelDeps);
    registerProjectsRuntimeMessageHandlers(projectsDeps);
    registerOptionsRuntimeMessageHandlers(optionsDeps);

    expect(harness.listenerCount()).toBe(3);

    await notifyProviderSettingsUpdated(harness.runtime, "all");
    await flushAsync();

    expect(sidepanelDeps.refreshSidebarSetupState).toHaveBeenCalledTimes(1);
    expect(sidepanelDeps.loadProviderSetting).toHaveBeenCalledTimes(1);
    expect(sidepanelDeps.loadModels).toHaveBeenCalledTimes(1);
    expect(sidepanelDeps.refreshBalance).toHaveBeenCalledTimes(1);

    expect(projectsDeps.loadProviderSetting).toHaveBeenCalledTimes(1);
    expect(projectsDeps.loadModels).toHaveBeenCalledTimes(1);
    expect(projectsDeps.showToast).toHaveBeenCalledWith(
      "Provider updated. Update Project models to use OpenRouter.",
      "info"
    );

    expect(optionsDeps.loadModels).not.toHaveBeenCalled();
  });

  test("models and favorites broadcasts route to the expected pages", async () => {
    const harness = createRuntimeBusHarness();
    let lastSilentAt = 0;

    const sidepanelDeps = {
      runtime: harness.runtime,
      refreshSidebarSetupState: jest.fn().mockResolvedValue(true),
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      refreshBalance: jest.fn().mockResolvedValue(undefined),
      refreshFavoritesOnly: jest.fn(),
      balanceEl: { textContent: "" }
    };

    const projectsDeps = {
      runtime: harness.runtime,
      loadProviderSetting: jest.fn().mockResolvedValue(undefined),
      loadModels: jest.fn().mockResolvedValue(undefined),
      getProviderLabelSafe: jest.fn().mockReturnValue("OpenRouter"),
      showToast: jest.fn()
    };

    const optionsDeps = {
      runtime: harness.runtime,
      getModelsLoadInFlight: () => false,
      getLastSilentModelsLoadAt: () => lastSilentAt,
      setLastSilentModelsLoadAt: (value: number) => {
        lastSilentAt = value;
      },
      minReloadIntervalMs: 1500,
      loadModels: jest.fn()
    };

    registerSidepanelRuntimeMessageHandlers(sidepanelDeps);
    registerProjectsRuntimeMessageHandlers(projectsDeps);
    registerOptionsRuntimeMessageHandlers(optionsDeps);

    harness.dispatch({ type: "models_updated" });
    harness.dispatch({ type: "models_updated" });
    harness.dispatch({ type: "favorites_updated" });
    await flushAsync();

    expect(sidepanelDeps.loadModels).toHaveBeenCalledTimes(2);
    expect(projectsDeps.loadModels).toHaveBeenCalledTimes(2);
    expect(optionsDeps.loadModels).toHaveBeenCalledTimes(1);
    expect(optionsDeps.loadModels).toHaveBeenCalledWith({ silent: true });
    expect(sidepanelDeps.refreshFavoritesOnly).toHaveBeenCalledTimes(1);
  });
});
