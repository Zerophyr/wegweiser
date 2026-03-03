import { expect, test } from "@playwright/test";
import { buildSmokeLocalSeed, buildSmokeSyncSeed, launchExtensionHarness } from "./fixtures/extension-harness";

test("Sidepanel model dropdown remains usable while Options updates model", async () => {
  const harness = await launchExtensionHarness();
  try {
    await harness.seedLocalStorage(buildSmokeLocalSeed());
    await harness.seedSyncStorage(buildSmokeSyncSeed());

    const optionsPage = await harness.openExtensionPage("src/options/options.html");
    const sidepanelPage = await harness.openExtensionPage("src/sidepanel/sidepanel.html");

    await optionsPage.waitForSelector("#model-input");
    await sidepanelPage.waitForSelector("#model-input");

    const sidepanelModelInput = sidepanelPage.locator("#model-input");
    const sidepanelDropdown = sidepanelPage.locator("#model-dropdown-sidebar");

    await sidepanelModelInput.click();
    await sidepanelModelInput.fill("gpt");
    await expect(sidepanelDropdown).toBeVisible();

    const optionsModelInput = optionsPage.locator("#model-input");
    await optionsModelInput.click();
    await optionsModelInput.fill("gpt-4o");
    await optionsPage.locator('.model-dropdown-item[data-model-id="openrouter:openai/gpt-4o"]').first().click();

    await expect(optionsModelInput).toHaveValue(/gpt-4o/i);
    await expect(sidepanelModelInput).toHaveValue(/gpt-4o/i);

    await sidepanelModelInput.click();
    await sidepanelModelInput.fill("mini");
    await sidepanelPage.locator('.model-dropdown-item[data-model-id="openrouter:openai/gpt-4o-mini"]').first().click();

    await expect(sidepanelModelInput).toHaveValue(/gpt-4o mini|gpt-4o-mini/i);
    await expect(sidepanelPage.locator("#model-status")).not.toContainText(/failed/i);

    await optionsPage.close();
    await sidepanelPage.close();
  } finally {
    await harness.close();
  }
});
