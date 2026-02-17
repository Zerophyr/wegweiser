export {};

const { createAnswerPersistenceController } = require("../src/sidepanel/sidepanel-answer-persistence-controller-utils.js");

describe("sidepanel-answer-persistence-controller-utils", () => {
  test("persists and restores sidepanel answers through chat store", async () => {
    const answerEl = document.createElement("div");
    const metaEl = document.createElement("div");
    const putThread = jest.fn().mockResolvedValue(undefined);
    const getThread = jest.fn().mockResolvedValue({ html: "<p>Saved</p>", metaText: "meta restored" });
    const updateAnswerVisibility = jest.fn();

    const controller = createAnswerPersistenceController({
      answerEl,
      metaEl,
      chatStore: { putThread, getThread, deleteThread: jest.fn() },
      getSidepanelThreadId: jest.fn().mockResolvedValue("tab_1"),
      getAnswerStorage: jest.fn(),
      getCurrentTabId: jest.fn(),
      buildAnswerCacheKey: jest.fn(),
      sidepanelProjectId: "__sidepanel__",
      updateAnswerVisibility,
      logWarn: jest.fn()
    });

    answerEl.innerHTML = "<div>Answer</div>";
    metaEl.textContent = "meta now";
    await controller.persistAnswers();

    expect(putThread).toHaveBeenCalledWith(expect.objectContaining({
      id: "tab_1",
      projectId: "__sidepanel__",
      title: "Sidepanel",
      html: "<div>Answer</div>",
      metaText: "meta now"
    }));

    answerEl.replaceChildren();
    metaEl.textContent = "";
    await controller.restorePersistedAnswers();

    expect(answerEl.innerHTML).toContain("Saved");
    expect(metaEl.textContent).toBe("meta restored");
    expect(updateAnswerVisibility).toHaveBeenCalled();
  });

  test("uses fallback storage path when chat store is unavailable", async () => {
    const answerEl = document.createElement("div");
    const metaEl = document.createElement("div");
    const storage = {
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({ cache_1: { html: "<p>Cached</p>", metaText: "cached" } })
    };

    const controller = createAnswerPersistenceController({
      answerEl,
      metaEl,
      chatStore: null,
      getSidepanelThreadId: jest.fn(),
      getAnswerStorage: () => storage,
      getCurrentTabId: jest.fn().mockResolvedValue(1),
      buildAnswerCacheKey: jest.fn().mockReturnValue("cache_1"),
      sidepanelProjectId: "__sidepanel__",
      updateAnswerVisibility: jest.fn(),
      logWarn: jest.fn()
    });

    answerEl.innerHTML = "<p>Hello</p>";
    metaEl.textContent = "m";
    await controller.persistAnswers();

    expect(storage.set).toHaveBeenCalledWith({ cache_1: { html: "<p>Hello</p>", metaText: "m" } });

    answerEl.replaceChildren();
    await controller.restorePersistedAnswers();
    expect(answerEl.innerHTML).toContain("Cached");
  });

  test("scheduleAnswerPersist debounces writes", async () => {
    jest.useFakeTimers();
    const answerEl = document.createElement("div");
    const storage = {
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({})
    };

    const controller = createAnswerPersistenceController({
      answerEl,
      metaEl: document.createElement("div"),
      chatStore: null,
      getSidepanelThreadId: jest.fn(),
      getAnswerStorage: () => storage,
      getCurrentTabId: jest.fn().mockResolvedValue(1),
      buildAnswerCacheKey: jest.fn().mockReturnValue("cache_1"),
      updateAnswerVisibility: jest.fn(),
      logWarn: jest.fn()
    });

    answerEl.innerHTML = "<p>debounced</p>";
    controller.scheduleAnswerPersist();
    controller.scheduleAnswerPersist();
    jest.runAllTimers();
    await Promise.resolve();

    expect(storage.set).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});