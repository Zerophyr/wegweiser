import { chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

export type ExtensionHarness = {
  context: BrowserContext;
  extensionId: string;
  extensionPath: string;
  openExtensionPage: (relativePath: string) => Promise<Page>;
  seedLocalStorage: (values: Record<string, unknown>) => Promise<void>;
  seedSyncStorage: (values: Record<string, unknown>) => Promise<void>;
  close: () => Promise<void>;
};

function buildUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wegweiser-smoke-"));
}

async function resolveExtensionId(context: BrowserContext) {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  const url = serviceWorker.url();
  const extensionId = new URL(url).host;
  if (!extensionId) {
    throw new Error(`Unable to resolve extension id from service worker URL: ${url}`);
  }
  return extensionId;
}

async function runStorageSet(page: Page, area: "local" | "sync", values: Record<string, unknown>) {
  await page.evaluate(async ({ storageArea, payload }) => {
    const target = chrome.storage?.[storageArea];
    if (!target || typeof target.set !== "function") {
      throw new Error(`chrome.storage.${storageArea}.set is unavailable`);
    }
    await target.set(payload);
  }, { storageArea: area, payload: values });
}

export async function launchExtensionHarness(): Promise<ExtensionHarness> {
  const extensionPath = path.resolve(__dirname, "..", "..", "..");
  const userDataDir = buildUserDataDir();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const extensionId = await resolveExtensionId(context);

  const openExtensionPage = async (relativePath: string) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/${relativePath}`);
    return page;
  };

  const seedLocalStorage = async (values: Record<string, unknown>) => {
    const page = await openExtensionPage("src/options/options.html");
    try {
      await runStorageSet(page, "local", values);
    } finally {
      await page.close();
    }
  };

  const seedSyncStorage = async (values: Record<string, unknown>) => {
    const page = await openExtensionPage("src/options/options.html");
    try {
      await runStorageSet(page, "sync", values);
    } finally {
      await page.close();
    }
  };

  const close = async () => {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  };

  return {
    context,
    extensionId,
    extensionPath,
    openExtensionPage,
    seedLocalStorage,
    seedSyncStorage,
    close
  };
}

export function buildSmokeModels() {
  const models = [
    {
      id: "openai/gpt-4o-mini",
      name: "OpenAI: GPT-4o mini",
      ownedBy: "openai",
      vendorLabel: "OpenAI",
      supportsChat: true,
      supportsImages: false,
      outputsImage: false,
      isImageOnly: false,
      supportedParameters: ["max_tokens", "temperature"]
    },
    {
      id: "openai/gpt-4o",
      name: "OpenAI: GPT-4o",
      ownedBy: "openai",
      vendorLabel: "OpenAI",
      supportsChat: true,
      supportsImages: true,
      outputsImage: true,
      isImageOnly: false,
      supportedParameters: ["max_tokens", "temperature", "response_format"]
    }
  ];

  return {
    or_models_cache: models,
    or_models_cache_time: Date.now(),
    or_models_cache_version: 3
  };
}

export function buildSmokeLocalSeed() {
  return {
    or_provider: "openrouter",
    or_model_provider: "openrouter",
    or_model: "openai/gpt-4o-mini",
    or_api_key: "sk-or-smoke-test-key",
    or_provider_enabled_openrouter: true,
    or_web_search: false,
    or_reasoning: false,
    imageModeEnabled: false,
    ...buildSmokeModels()
  };
}

export function buildSmokeSyncSeed() {
  return {
    or_favorites: ["openai/gpt-4o-mini"],
    or_history_limit: 20
  };
}
