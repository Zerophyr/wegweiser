export {};

const {
  splitSseLines,
  parseSseDataLine,
  getStreamDeltaStats,
  getReasoningText
} = require("../src/background/background-stream-chunk-utils.js");

describe("background stream chunk utils", () => {
  test("splitSseLines keeps trailing partial buffer", () => {
    const out = splitSseLines("data: a", "\ndata: b\npar");
    expect(out.lines).toEqual(["data: a", "data: b"]);
    expect(out.buffer).toBe("par");
  });

  test("parseSseDataLine handles done and json payload", () => {
    expect(parseSseDataLine("data: [DONE]")).toEqual({ done: true, chunk: null, error: null });
    const parsed = parseSseDataLine('data: {"choices":[{"delta":{"content":"x"}}]}');
    expect(parsed.done).toBe(false);
    expect(parsed.chunk?.choices?.[0]?.delta?.content).toBe("x");
  });

  test("parseSseDataLine reports parse errors", () => {
    const parsed = parseSseDataLine("data: {bad");
    expect(parsed.done).toBe(false);
    expect(parsed.chunk).toBeNull();
    expect(parsed.error).toBeTruthy();
  });

  test("delta stats and reasoning extraction", () => {
    const delta = { content: "abc", reasoning_content: "r1" };
    const chunk = { usage: { total_tokens: 42 } };
    expect(getStreamDeltaStats(delta, chunk)).toEqual({
      contentLength: 3,
      reasoningLength: 2,
      hasUsage: true,
      totalTokens: 42
    });
    expect(getReasoningText({ reasoning: "x" })).toBe("x");
    expect(getReasoningText({ reasoning_content: "y" })).toBe("y");
    expect(getReasoningText({})).toBe("");
  });
});
