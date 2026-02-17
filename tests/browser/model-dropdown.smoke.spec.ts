import { expect, test } from "@playwright/test";
import { buildSmokeLocalSeed, buildSmokeSyncSeed, launchExtensionHarness } from "./fixtures/extension-harness";

test("Sidepanel model dropdown supports search/select and returns focus to prompt", async () => {
  const harness = await launchExtensionHarness();
  try {
    await harness.seedLocalStorage(buildSmokeLocalSeed());
    await harness.seedSyncStorage(buildSmokeSyncSeed());

    const page = await harness.openExtensionPage("src/sidepanel/sidepanel.html");
    await page.waitForSelector("#model-input");
    await page.waitForSelector("#prompt");

    const modelInput = page.locator("#model-input");
    await modelInput.click();
    await modelInput.fill("gpt-4o");
    await page.locator('.model-dropdown-item[data-model-id="openrouter:openai/gpt-4o"]').first().click();

    await expect(modelInput).toHaveValue(/gpt-4o/i);

    const dropdown = page.locator("#model-dropdown-sidebar");
    await expect(dropdown).toBeHidden();

    await expect.poll(async () => {
      return page.evaluate(() => document.activeElement?.id || "");
    }).toBe("prompt");

    await page.close();
  } finally {
    await harness.close();
  }
});
