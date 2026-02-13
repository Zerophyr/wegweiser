export {};

const {
  resolveStreamToggles,
  buildStartStreamPayload
} = require("../src/projects/projects-stream-request-utils.js");

describe("projects stream request utils", () => {
  test("resolveStreamToggles prefers explicit options", () => {
    const out = resolveStreamToggles(
      { webSearch: true, reasoning: false },
      { chatWebSearch: { checked: false }, chatReasoning: { checked: true } }
    );
    expect(out).toEqual({ webSearch: true, reasoning: false });
  });

  test("resolveStreamToggles falls back to UI checked values", () => {
    const out = resolveStreamToggles(
      {},
      { chatWebSearch: { checked: 1 }, chatReasoning: { checked: 0 } }
    );
    expect(out).toEqual({ webSearch: true, reasoning: false });
  });

  test("buildStartStreamPayload creates request body", () => {
    const payload = buildStartStreamPayload({
      content: "hello",
      messages: [{ role: "user", content: "a" }],
      project: { id: "p1", model: "m1", modelProvider: "naga" },
      provider: "openrouter",
      webSearch: true,
      reasoning: false,
      retry: true
    });

    expect(payload.type).toBe("start_stream");
    expect(payload.prompt).toBe("hello");
    expect(payload.model).toBe("m1");
    expect(payload.provider).toBe("naga");
    expect(payload.webSearch).toBe(true);
    expect(payload.reasoning).toBe(false);
    expect(payload.tabId).toBe("Project_p1");
    expect(payload.retry).toBe(true);
  });
});
