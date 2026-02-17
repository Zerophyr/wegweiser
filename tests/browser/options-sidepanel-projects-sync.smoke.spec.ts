import { expect, test } from "@playwright/test";
import { buildSmokeLocalSeed, buildSmokeSyncSeed, launchExtensionHarness } from "./fixtures/extension-harness";

test("Options model selection syncs to Sidepanel and Projects without reload", async () => {
  const harness = await launchExtensionHarness();
  try {
    await harness.seedLocalStorage(buildSmokeLocalSeed());
    await harness.seedSyncStorage(buildSmokeSyncSeed());

    const optionsPage = await harness.openExtensionPage("src/options/options.html");
    const sidepanelPage = await harness.openExtensionPage("src/sidepanel/sidepanel.html");
    const projectsPage = await harness.openExtensionPage("src/projects/projects.html");

    await optionsPage.waitForSelector("#model-input");
    await sidepanelPage.waitForSelector("#model-input");
    await projectsPage.waitForSelector("#create-project-btn");

    await projectsPage.click("#create-project-btn");
    await projectsPage.waitForSelector("#project-modal", { state: "visible" });

    const optionsModelInput = optionsPage.locator("#model-input");
    await optionsModelInput.click();
    await optionsModelInput.fill("gpt-4o");
    await optionsPage.locator('.model-dropdown-item[data-model-id="openrouter:openai/gpt-4o"]').first().click();

    await expect(optionsModelInput).toHaveValue(/gpt-4o/i);
    await expect(sidepanelPage.locator("#model-input")).toHaveValue(/gpt-4o/i);
    await expect(projectsPage.locator("#project-model-input")).toHaveValue(/gpt-4o/i);

    await optionsPage.close();
    await sidepanelPage.close();
    await projectsPage.close();
  } finally {
    await harness.close();
  }
});
