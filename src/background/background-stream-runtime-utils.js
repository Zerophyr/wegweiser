// background-stream-runtime-utils.js - runtime helpers for background streaming flow

function createSafePortSender(port, isDisconnectedFn, logger = console) {
  return (message) => {
    if (typeof isDisconnectedFn === "function" && isDisconnectedFn()) {
      logger?.log?.("[Streaming] Skipping message send - port disconnected");
      return false;
    }
    try {
      port.postMessage(message);
      return true;
    } catch (e) {
      logger?.error?.("[Streaming] Failed to send message:", e);
      return false;
    }
  };
}

function buildStreamRequestBody(params = {}) {
  const requestBody = {
    model: params.modelName,
    messages: Array.isArray(params.context) ? params.context : [],
    stream: true
  };

  if (params.reasoning && params.providerId === "openrouter") {
    requestBody.reasoning = {
      enabled: true,
      effort: "medium"
    };
  }

  return requestBody;
}

const backgroundStreamRuntimeUtils = {
  createSafePortSender,
  buildStreamRequestBody
};

if (typeof window !== "undefined") {
  window.backgroundStreamRuntimeUtils = backgroundStreamRuntimeUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundStreamRuntimeUtils = backgroundStreamRuntimeUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundStreamRuntimeUtils;
}
