const { setupChatInput } = require("../src/projects/projects-events-controller-utils.js");
export {};

describe("projects-events-controller-utils", () => {
  test("setupChatInput wires send/stop handlers", () => {
    const inputListeners: Record<string, Function> = {};
    const sendClick = jest.fn();
    const stopClick = jest.fn();

    const elements = {
      chatInput: {
        style: {},
        scrollHeight: 20,
        addEventListener: (name: string, fn: Function) => { inputListeners[name] = fn; }
      },
      sendBtn: { addEventListener: (name: string, fn: any) => { if (name === "click") sendClick.mockImplementation(fn); } },
      stopBtn: { addEventListener: (name: string, fn: any) => { if (name === "click") stopClick.mockImplementation(fn); } }
    };

    const sendMessage = jest.fn();
    const stopStreaming = jest.fn();
    setupChatInput({ elements, sendMessage, stopStreaming });

    sendClick();
    stopClick();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(stopStreaming).toHaveBeenCalledTimes(1);
    expect(typeof inputListeners.input).toBe("function");
    expect(typeof inputListeners.keydown).toBe("function");
  });
});
