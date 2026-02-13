export {};

const {
  applyProjectChatSettingsToElements
} = require("../src/projects/projects-chat-settings-utils.js");

describe("projects chat settings utils", () => {
  test("applies project web/reasoning toggles and image mode callback", () => {
    const elements = {
      chatWebSearch: { checked: false },
      chatReasoning: { checked: false }
    };
    const calls: any[] = [];
    applyProjectChatSettingsToElements(
      { webSearch: true, reasoning: false, id: "p1" },
      elements,
      (project: any) => calls.push(project.id)
    );

    expect(elements.chatWebSearch.checked).toBe(true);
    expect(elements.chatReasoning.checked).toBe(false);
    expect(calls).toEqual(["p1"]);
  });
});
