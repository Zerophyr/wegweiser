import { expect, test } from "@playwright/test";
import { launchExtensionHarness } from "./fixtures/extension-harness";

const LIVE_PROVIDER_SMOKE_ENABLED = process.env.LIVE_PROVIDER_SMOKE === "1";
const OPENROUTER_TEST_API_KEY = process.env.OPENROUTER_TEST_API_KEY || "";
const OPENROUTER_CANARY_MODEL = process.env.OPENROUTER_CANARY_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_REQUIRED_MODELS = (process.env.OPENROUTER_REQUIRED_MODELS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function toCombinedModelId(rawModelId: string) {
  return `openrouter:${rawModelId}`;
}

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("Live provider validation", () => {
  test.skip(
    !LIVE_PROVIDER_SMOKE_ENABLED || !OPENROUTER_TEST_API_KEY,
    "Set LIVE_PROVIDER_SMOKE=1 and OPENROUTER_TEST_API_KEY to run live provider smoke."
  );

  test("refreshes live models, validates balance, and probes canary inference", async () => {
    const harness = await launchExtensionHarness();
    const requiredModels = Array.from(new Set([OPENROUTER_CANARY_MODEL, ...OPENROUTER_REQUIRED_MODELS]));

    try {
      await harness.seedLocalStorage({
        or_provider: "openrouter",
        or_model_provider: "openrouter",
        or_model: OPENROUTER_CANARY_MODEL,
        or_api_key: OPENROUTER_TEST_API_KEY,
        or_provider_enabled_openrouter: true,
        or_web_search: false,
        or_reasoning: false,
        imageModeEnabled: false
      });

      await harness.clearLocalStorage([
        "or_models_cache",
        "or_models_cache_time",
        "or_models_cache_version"
      ]);

      const optionsPage = await harness.openExtensionPage("src/options/options.html");
      await optionsPage.waitForSelector("#model-input");

      const modelsStatus = optionsPage.locator("#models-status");
      await expect.poll(async () => (await modelsStatus.textContent()) || "", {
        timeout: 60_000
      }).toMatch(/Loaded\s+\d+\s+models\./i);

      const modelsResponse = await harness.sendRuntimeMessage<{ ok: boolean; models?: any[]; error?: string }>({
        type: "get_models"
      });
      expect(modelsResponse?.ok).toBe(true);
      const models = Array.isArray(modelsResponse?.models) ? modelsResponse.models : [];
      expect(models.length).toBeGreaterThan(0);

      for (const requiredRawId of requiredModels) {
        const found = models.some((model) => {
          const combinedId = String(model?.id || "");
          const rawId = String(model?.rawId || "");
          return combinedId === toCombinedModelId(requiredRawId) || rawId === requiredRawId;
        });
        expect(found).toBe(true);
      }

      const sidepanelPage = await harness.openExtensionPage("src/sidepanel/sidepanel.html");
      await sidepanelPage.waitForSelector("#model-input");

      const modelInput = sidepanelPage.locator("#model-input");
      await modelInput.click();
      await modelInput.fill(OPENROUTER_CANARY_MODEL);
      await sidepanelPage
        .locator(`.model-dropdown-item[data-model-id="${toCombinedModelId(OPENROUTER_CANARY_MODEL)}"]`)
        .first()
        .click();
      await expect(modelInput).not.toHaveValue("", { timeout: 10_000 });

      const balanceResponse = await harness.sendRuntimeMessage<{ ok: boolean; supported?: boolean; balance?: number | null }>(
        { type: "get_balance" },
        "src/sidepanel/sidepanel.html"
      );
      expect(balanceResponse?.ok).toBe(true);
      expect(balanceResponse?.supported).toBe(true);
      expect(typeof balanceResponse?.balance).toBe("number");
      expect(Number.isFinite(balanceResponse?.balance as number)).toBe(true);

      const setModelResponse = await harness.sendRuntimeMessage<{ ok: boolean; error?: string }>({
        type: "set_model",
        model: OPENROUTER_CANARY_MODEL,
        provider: "openrouter"
      });
      expect(setModelResponse?.ok).toBe(true);

      const queryResponse = await harness.sendRuntimeMessage<{
        ok: boolean;
        answer?: string;
        error?: string;
      }>(
        {
          type: "openrouter_query",
          prompt: "Reply with a short confirmation.",
          webSearch: false,
          reasoning: false,
          tabId: "live-provider-smoke"
        },
        "src/sidepanel/sidepanel.html"
      );

      expect(queryResponse?.ok).toBe(true);
      expect(typeof queryResponse?.answer).toBe("string");
      expect((queryResponse?.answer || "").trim().length).toBeGreaterThan(0);

      await optionsPage.close();
      await sidepanelPage.close();
    } finally {
      await harness.close();
    }
  });
});
