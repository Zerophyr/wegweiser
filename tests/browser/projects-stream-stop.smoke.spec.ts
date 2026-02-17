import { expect, test } from "@playwright/test";
import { buildSmokeLocalSeed, buildSmokeSyncSeed, launchExtensionHarness } from "./fixtures/extension-harness";

test("Projects stream start/stop keeps UI lock lifecycle stable", async () => {
  const harness = await launchExtensionHarness();
  try {
    await harness.seedLocalStorage(buildSmokeLocalSeed());
    await harness.seedSyncStorage(buildSmokeSyncSeed());

    const page = await harness.context.newPage();
    await page.addInitScript(() => {
      const originalRuntime = window.chrome?.runtime;
      if (!originalRuntime || typeof originalRuntime.connect !== "function") {
        (window as any).__smokeStreamConnectHooked = false;
        return;
      }

      const originalConnect = originalRuntime.connect.bind(originalRuntime);

      const connectStub = (connectInfo?: chrome.runtime.ConnectInfo) => {
        if (!connectInfo || connectInfo.name !== "streaming") {
          return originalConnect(connectInfo as chrome.runtime.ConnectInfo);
        }

        let disconnected = false;
        const messageListeners: Array<(msg: any) => void> = [];
        const disconnectListeners: Array<() => void> = [];
        let intervalHandle: number | null = null;

        const port = {
          name: "streaming",
          onMessage: {
            addListener: (fn: (msg: any) => void) => {
              messageListeners.push(fn);
            }
          },
          onDisconnect: {
            addListener: (fn: () => void) => {
              disconnectListeners.push(fn);
            }
          },
          postMessage: (msg: any) => {
            if (msg?.type !== "start_stream" || disconnected) return;
            if (intervalHandle != null) {
              window.clearInterval(intervalHandle);
            }
            intervalHandle = window.setInterval(() => {
              if (disconnected) return;
              for (const listener of messageListeners) {
                listener({ type: "content", content: "streaming chunk " });
              }
            }, 150);
          },
          disconnect: () => {
            if (disconnected) return;
            disconnected = true;
            if (intervalHandle != null) {
              window.clearInterval(intervalHandle);
              intervalHandle = null;
            }
            for (const listener of disconnectListeners) {
              listener();
            }
          }
        } as any;

        return port;
      };

      try {
        Object.defineProperty(originalRuntime, "connect", {
          configurable: true,
          writable: true,
          value: connectStub
        });
        (window as any).__smokeStreamConnectHooked = true;
      } catch {
        (window as any).__smokeStreamConnectHooked = false;
      }
    });

    await page.goto(`chrome-extension://${harness.extensionId}/src/projects/projects.html`);
    await page.waitForSelector("#create-project-btn");

    await page.click("#create-project-btn");
    await page.fill("#project-name", "Smoke Project");
    await page.click("#modal-save");

    await page.waitForSelector(".project-card");
    await page.locator(".project-card").first().click();

    await page.waitForSelector("#new-thread-btn");
    await page.click("#new-thread-btn");

    await page.waitForSelector("#chat-input");
    await page.fill("#chat-input", "Start streaming and then stop");
    await page.click("#send-btn");

    await expect(page.locator("#stop-btn")).toBeVisible();
    await expect(page.locator("#chat-input")).toBeDisabled();

    await page.click("#stop-btn");

    await expect(page.locator("#stop-btn")).toBeHidden();
    await expect(page.locator("#chat-input")).toBeEnabled();

    await page.close();
  } finally {
    await harness.close();
  }
});
