export {};

const fs = require("fs");
const path = require("path");

function loadRouterRegistration() {
  const filePath = path.join(__dirname, "../src/background/background-message-router-utils.js");
  const source = fs
    .readFileSync(filePath, "utf8")
    .replace("export function registerBackgroundMessageRouter", "function registerBackgroundMessageRouter");

  const factory = new Function(`${source}\nreturn { registerBackgroundMessageRouter };`);
  return factory().registerBackgroundMessageRouter;
}

describe("background request permission sender validation", () => {
  function setup() {
    const registerBackgroundMessageRouter = loadRouterRegistration();
    let listener: any = null;
    const permissionsRequest = jest.fn().mockResolvedValue(true);
    const chromeApi: any = {
      runtime: {
        id: "ext-id",
        onMessage: {
          addListener(fn: any) {
            listener = fn;
          }
        }
      },
      permissions: {
        request: permissionsRequest
      }
    };

    registerBackgroundMessageRouter(chromeApi, {
      MESSAGE_TYPES: {
        REQUEST_PERMISSION: "request_permission"
      }
    });

    const sendMessage = (msg: any, sender: any): Promise<any> => new Promise((resolve) => {
      if (!listener) throw new Error("Message listener not registered");
      const keepChannel = listener(msg, sender, (response: any) => resolve(response));
      if (!keepChannel) {
        resolve(undefined);
      }
    });

    return { sendMessage, permissionsRequest };
  }

  test("rejects unauthorized senders", async () => {
    const { sendMessage, permissionsRequest } = setup();

    const unauthorized = await sendMessage(
      { type: "request_permission", url: "https://example.com/page" },
      { id: "other-extension", url: "chrome-extension://ext-id/src/options/options.html" }
    );
    expect(unauthorized).toEqual({ ok: false, error: "Unauthorized sender" });

    const contentScriptSender = await sendMessage(
      { type: "request_permission", url: "https://example.com/page" },
      { id: "ext-id", tab: { id: 123 }, url: "chrome-extension://ext-id/src/options/options.html" }
    );
    expect(contentScriptSender).toEqual({ ok: false, error: "Unauthorized sender" });

    expect(permissionsRequest).not.toHaveBeenCalled();
  });

  test("allows extension page sender and requests origin permission", async () => {
    const { sendMessage, permissionsRequest } = setup();

    const result = await sendMessage(
      { type: "request_permission", url: "https://example.com/path?x=1" },
      { id: "ext-id", url: "chrome-extension://ext-id/src/options/options.html" }
    );

    expect(result).toEqual({ ok: true, granted: true });
    expect(permissionsRequest).toHaveBeenCalledWith({ origins: ["https://example.com/*"] });
  });

  test("returns explicit error when URL is missing", async () => {
    const { sendMessage, permissionsRequest } = setup();

    const result = await sendMessage(
      { type: "request_permission" },
      { id: "ext-id", url: "chrome-extension://ext-id/src/options/options.html" }
    );

    expect(result).toEqual({ ok: false, error: "No URL provided" });
    expect(permissionsRequest).not.toHaveBeenCalled();
  });
});
