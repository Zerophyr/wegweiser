// background-provider-stream-controller-utils.js - streaming port registration

export function registerStreamingPortListener(chromeApi, deps) {
  chromeApi.runtime.onConnect.addListener((port) => {
    if (port.name !== "streaming") return;
    let isDisconnected = false;

    port.onDisconnect.addListener(() => {
      isDisconnected = true;
      console.log("[Streaming] Port disconnected by client");
    });

    port.onMessage.addListener(async (msg) => {
      if (msg.type !== "start_stream") return;
      try {
        await deps.streamOpenRouterResponse(
          msg.prompt,
          msg.webSearch,
          msg.reasoning,
          msg.tabId,
          port,
          () => isDisconnected,
          msg.messages,
          msg.model,
          msg.provider,
          msg.retry === true
        );
      } catch (e) {
        if (!isDisconnected) {
          try {
            port.postMessage({ type: "error", error: e?.message || String(e) });
          } catch (postError) {
            console.error("[Streaming] Failed to send error (port disconnected):", postError);
          }
        }
      }
    });
  });
}
