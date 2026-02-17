export {};

const { createAnswerPersistenceController } = require("../src/sidepanel/sidepanel-answer-persistence-controller-utils.js");

describe("sidepanel answer persistence", () => {
  test("clears cached answer payload when answer content is empty", async () => {
    const answerEl = document.createElement("div");
    const remove = jest.fn().mockResolvedValue(undefined);
    const storage = { remove, set: jest.fn().mockResolvedValue(undefined), get: jest.fn().mockResolvedValue({}) };

    const controller = createAnswerPersistenceController({
      answerEl,
      metaEl: document.createElement("div"),
      chatStore: null,
      getSidepanelThreadId: jest.fn(),
      getAnswerStorage: () => storage,
      getCurrentTabId: jest.fn().mockResolvedValue(5),
      buildAnswerCacheKey: () => "cache_5",
      updateAnswerVisibility: jest.fn(),
      logWarn: jest.fn()
    });

    answerEl.innerHTML = "   ";
    await controller.persistAnswers();

    expect(remove).toHaveBeenCalledWith(["cache_5"]);
  });
});