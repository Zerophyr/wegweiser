// background-stream-chunk-utils.js - SSE chunk parsing helpers for background streaming

function splitSseLines(buffer, incoming) {
  const merged = `${buffer || ""}${incoming || ""}`;
  const lines = merged.split("\n");
  const nextBuffer = lines.pop() || "";
  return { lines, buffer: nextBuffer };
}

function parseSseDataLine(line) {
  const text = String(line || "").trim();
  if (!text.startsWith("data: ")) {
    return { done: false, chunk: null, error: null };
  }
  if (text === "data: [DONE]") {
    return { done: true, chunk: null, error: null };
  }
  try {
    const chunk = JSON.parse(text.slice(6));
    return { done: false, chunk, error: null };
  } catch (error) {
    return { done: false, chunk: null, error };
  }
}

function getStreamDeltaStats(delta, chunk) {
  const contentLength = typeof delta?.content === "string" ? delta.content.length : 0;
  const reasoningLength = typeof delta?.reasoning === "string"
    ? delta.reasoning.length
    : (typeof delta?.reasoning_content === "string" ? delta.reasoning_content.length : 0);
  return {
    contentLength,
    reasoningLength,
    hasUsage: Boolean(chunk?.usage),
    totalTokens: chunk?.usage?.total_tokens ?? null
  };
}

function getReasoningText(delta) {
  if (typeof delta?.reasoning === "string") return delta.reasoning;
  if (typeof delta?.reasoning_content === "string") return delta.reasoning_content;
  return "";
}

const backgroundStreamChunkUtils = {
  splitSseLines,
  parseSseDataLine,
  getStreamDeltaStats,
  getReasoningText
};

if (typeof window !== "undefined") {
  window.backgroundStreamChunkUtils = backgroundStreamChunkUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundStreamChunkUtils = backgroundStreamChunkUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundStreamChunkUtils;
}
