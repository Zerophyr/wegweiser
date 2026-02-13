export {};

const {
  processProjectsAssistantSources,
  bindProjectsCopyButtons
} = require("../src/projects/projects-message-postprocess-utils.js");

describe("projects message postprocess utils", () => {
  test("processProjectsAssistantSources invokes source summary renderer", () => {
    document.body.innerHTML = `
      <div class="chat-message-assistant">
        <div class="chat-content" data-sources='[{"url":"https://example.com"}]'>Hi</div>
      </div>
    `;
    const root = document.body;
    const calls: any[] = [];

    processProjectsAssistantSources(root, {
      makeSourceReferencesClickable: () => {},
      createSourcesIndicator: () => null,
      renderChatSourcesSummary: (_messageDiv: Element, sources: any[]) => {
        calls.push(sources);
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(1);
  });

  test("bindProjectsCopyButtons binds once and toggles copied class", async () => {
    document.body.innerHTML = `
      <div class="chat-message-assistant">
        <div class="chat-content">Hello</div>
        <button class="chat-copy-btn"></button>
      </div>
    `;
    const root = document.body;
    const btn = root.querySelector(".chat-copy-btn") as HTMLButtonElement;
    const writes: string[] = [];

    await bindProjectsCopyButtons(root, {
      writeText: async (text: string) => writes.push(text),
      showToast: () => {},
      setTimeoutFn: (fn: () => void) => {
        fn();
        return 0 as any;
      }
    });

    btn.click();
    expect(writes).toEqual(["Hello"]);
    expect(btn.dataset.bound).toBe("true");
  });
});
