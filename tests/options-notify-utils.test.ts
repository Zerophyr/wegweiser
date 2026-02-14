export {};

const {
  notifyProviderSettingsUpdated,
  notifyModelsUpdated
} = require("../src/options/options-notify-utils.js");

describe("options-notify-utils", () => {
  test("notifyProviderSettingsUpdated sends provider_settings_updated payload", async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const runtime = { sendMessage };

    await notifyProviderSettingsUpdated(runtime, "openrouter");

    expect(sendMessage).toHaveBeenCalledWith({
      type: "provider_settings_updated",
      provider: "openrouter"
    });
  });

  test("notifyModelsUpdated sends models_updated payload", async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const runtime = { sendMessage };

    await notifyModelsUpdated(runtime);

    expect(sendMessage).toHaveBeenCalledWith({ type: "models_updated" });
  });

  test("helpers swallow runtime send errors", async () => {
    const sendMessage = jest.fn().mockRejectedValue(new Error("fail"));
    const runtime = { sendMessage };
    const logger = { warn: jest.fn() };

    await expect(notifyProviderSettingsUpdated(runtime, "all", logger)).resolves.toBeUndefined();
    await expect(notifyModelsUpdated(runtime, logger)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
