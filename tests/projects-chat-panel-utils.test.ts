export {};

const {
  buildEmptyChatPanelState,
  buildActiveChatPanelState,
  applyChatPanelStateToElements
} = require("../src/projects/projects-chat-panel-utils.js");

describe("projects chat panel utils", () => {
  test("buildEmptyChatPanelState returns empty-visible flags", () => {
    const state = buildEmptyChatPanelState();
    expect(state.chatEmptyDisplay).toBe("flex");
    expect(state.chatContainerDisplay).toBe("none");
    expect(state.hasActiveThread).toBe(false);
  });

  test("buildActiveChatPanelState returns active-visible flags", () => {
    const state = buildActiveChatPanelState();
    expect(state.chatEmptyDisplay).toBe("none");
    expect(state.chatContainerDisplay).toBe("flex");
    expect(state.hasActiveThread).toBe(true);
  });

  test("applyChatPanelStateToElements applies display values", () => {
    const elements = {
      chatEmptyState: { style: { display: "" } },
      chatContainer: { style: { display: "" } }
    };
    applyChatPanelStateToElements(elements, buildEmptyChatPanelState());
    expect(elements.chatEmptyState.style.display).toBe("flex");
    expect(elements.chatContainer.style.display).toBe("none");
  });
});
