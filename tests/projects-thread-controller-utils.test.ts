export {};

const { openProjectThread } = require("../src/projects/projects-thread-controller-utils.js");

describe("projects-thread-controller-utils", () => {
  test("openProjectThread activates chat panel and renders selected thread", async () => {
    const applyChatPanelStateToElements = jest.fn();
    const renderChatMessages = jest.fn();
    const renderThreadList = jest.fn().mockResolvedValue(undefined);
    const setCurrentThreadId = jest.fn();

    await openProjectThread("thread-1", {
      getThread: async () => ({ id: "thread-1", messages: [{ role: "user", content: "hi" }] }),
      loadThreads: async () => [],
      showToast: jest.fn(),
      setCurrentThreadId,
      getProject: async () => ({ id: "project-1" }),
      getCurrentProjectId: () => "project-1",
      setCurrentProjectData: jest.fn(),
      applyProjectChatSettings: jest.fn(),
      updateChatModelIndicator: jest.fn(),
      applyChatPanelStateToElements,
      buildActiveChatPanelState: () => ({ hasActiveThread: true }),
      elements: {},
      renderChatMessages,
      renderThreadList
    });

    expect(setCurrentThreadId).toHaveBeenCalledWith("thread-1");
    expect(applyChatPanelStateToElements).toHaveBeenCalledTimes(1);
    expect(renderChatMessages).toHaveBeenCalledTimes(1);
    expect(renderThreadList).toHaveBeenCalledTimes(1);
  });
});
