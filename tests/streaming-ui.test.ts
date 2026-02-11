export {};
const { setStreamingUi } = require("../src/modules/streaming-ui.js");

describe("setStreamingUi", () => {
  test("toggles streaming state on container, input, and stop button", () => {
    document.body.innerHTML = `
      <div id="container">
        <textarea id="prompt"></textarea>
        <button id="stop-btn"></button>
      </div>
    `;
    const container = document.getElementById("container");
    const input = document.getElementById("prompt") as HTMLTextAreaElement | null;
    const stopButton = document.getElementById("stop-btn");

    setStreamingUi({ container, input, stopButton, isStreaming: true });

    expect(container?.classList.contains("is-streaming")).toBe(true);
    expect(input?.disabled).toBe(true);
    expect(stopButton?.style.display).toBe("inline-flex");

    setStreamingUi({ container, input, stopButton, isStreaming: false });

    expect(container?.classList.contains("is-streaming")).toBe(false);
    expect(input?.disabled).toBe(false);
    expect(stopButton?.style.display).toBe("none");
  });
});
