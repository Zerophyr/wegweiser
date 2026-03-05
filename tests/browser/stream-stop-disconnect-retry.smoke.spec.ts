import { expect, test } from "@playwright/test";
import { buildSmokeLocalSeed, buildSmokeSyncSeed, launchExtensionHarness } from "./fixtures/extension-harness";

test("Projects stop during disconnect transition does not leave stale error state", async () => {
  const harness = await launchExtensionHarness();
  try {
    await harness.seedLocalStorage(buildSmokeLocalSeed());
    await harness.seedSyncStorage(buildSmokeSyncSeed());

    const page = await harness.context.newPage();
    await page.addInitScript(() => {
      const originalRuntime = window.chrome?.runtime;
      if (!originalRuntime || typeof originalRuntime.connect !== "function") {
        (window as any).__smokeTransitionHooked = false;
        return;
      }

      const originalConnect = originalRuntime.connect.bind(originalRuntime);
      let streamStartCount = 0;

      const connectStub = (connectInfo?: chrome.runtime.ConnectInfo) => {
        if (!connectInfo || connectInfo.name !== "streaming") {
          return originalConnect(connectInfo as chrome.runtime.ConnectInfo);
        }

        const messageListeners: Array<(msg: any) => void> = [];
        const disconnectListeners: Array<() => void> = [];
        let disconnected = false;
        let chunkInterval: number | null = null;
        let errorTimeout: number | null = null;
        let completeTimeout: number | null = null;

        const cleanup = () => {
          if (chunkInterval != null) {
            window.clearInterval(chunkInterval);
            chunkInterval = null;
          }
          if (errorTimeout != null) {
            window.clearTimeout(errorTimeout);
            errorTimeout = null;
          }
          if (completeTimeout != null) {
            window.clearTimeout(completeTimeout);
            completeTimeout = null;
          }
        };

        return {
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
            streamStartCount += 1;

            if (streamStartCount === 1) {
              chunkInterval = window.setInterval(() => {
                if (disconnected) return;
                messageListeners.forEach((listener) => listener({ type: "content", content: "chunk " }));
              }, 80);

              errorTimeout = window.setTimeout(() => {
                if (disconnected) return;
                messageListeners.forEach((listener) => listener({ type: "error", error: "Simulated upstream error" }));
              }, 1200);
              return;
            }

            completeTimeout = window.setTimeout(() => {
              if (disconnected) return;
              messageListeners.forEach((listener) => listener({
                type: "complete",
                model: "openai/gpt-4o-mini",
                tokens: 101,
                contextSize: 2
              }));
            }, 1000);
          },
          disconnect: () => {
            if (disconnected) return;
            disconnected = true;
            cleanup();
            window.setTimeout(() => {
              disconnectListeners.forEach((listener) => listener());
            }, 250);
          }
        } as any;
      };

      try {
        Object.defineProperty(originalRuntime, "connect", {
          configurable: true,
          writable: true,
          value: connectStub
        });
        (window as any).__smokeTransitionHooked = true;
      } catch {
        (window as any).__smokeTransitionHooked = false;
      }
    });

    await page.goto(`chrome-extension://${harness.extensionId}/src/projects/projects.html`);
    await page.waitForSelector("#create-project-btn");

    await page.click("#create-project-btn");
    await page.fill("#project-name", "Transition Smoke");
    await page.click("#modal-save");

    await page.waitForSelector(".project-card");
    await page.locator(".project-card").first().click();

    await page.waitForSelector("#new-thread-btn");
    await page.click("#new-thread-btn");
    await page.waitForSelector(".thread-item.active");

    await page.waitForSelector("#chat-input");
    await page.fill("#chat-input", "first prompt");
    await page.click("#send-btn");

    await expect(page.locator("#stop-btn")).toBeVisible();
    await expect(page.locator("#chat-input")).toBeDisabled();

    await page.click("#stop-btn");
    await expect(page.locator("#chat-input")).toBeEnabled({ timeout: 3000 });

    await page.fill("#chat-input", "second prompt after stop");
    await page.click("#send-btn");

    await expect(page.locator("#stop-btn")).toBeVisible();
    await expect(page.locator("#stop-btn")).toBeHidden({ timeout: 6000 });
    await expect(page.locator("#chat-input")).toBeEnabled({ timeout: 6000 });

    await expect(page.locator(".error-content")).toHaveCount(0);
    await expect(page.locator(".chat-content")).not.toContainText(/Simulated upstream error/i);

    await page.close();
  } finally {
    await harness.close();
  }
});
