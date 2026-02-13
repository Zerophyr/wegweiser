export {};

const {
  createSafePortSender,
  buildStreamRequestBody
} = require("../src/background/background-stream-runtime-utils.js");

describe("background stream runtime utils", () => {
  test("createSafePortSender skips when disconnected", () => {
    const port = { postMessage: jest.fn() };
    const send = createSafePortSender(port, () => true, { log: jest.fn(), error: jest.fn() });
    expect(send({ type: "x" })).toBe(false);
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  test("createSafePortSender sends when connected", () => {
    const port = { postMessage: jest.fn() };
    const send = createSafePortSender(port, () => false, { log: jest.fn(), error: jest.fn() });
    expect(send({ type: "x" })).toBe(true);
    expect(port.postMessage).toHaveBeenCalledWith({ type: "x" });
  });

  test("buildStreamRequestBody supports openrouter semantics only", () => {
    const orBody = buildStreamRequestBody({
      modelName: "m1",
      context: [{ role: "user", content: "x" }],
      providerId: "openrouter",
      webSearch: false,
      reasoning: true
    });
    expect(orBody.reasoning).toEqual({ enabled: true, effort: "medium" });
    expect(orBody.stream).toBe(true);

    const nagaBody = buildStreamRequestBody({
      modelName: "m2",
      context: [{ role: "user", content: "x" }],
      providerId: "naga",
      webSearch: true,
      reasoning: true
    });
    expect(nagaBody.reasoning_effort).toBeUndefined();
    expect(nagaBody.web_search_options).toBeUndefined();
    expect(nagaBody.stream_options).toBeUndefined();
  });
});
