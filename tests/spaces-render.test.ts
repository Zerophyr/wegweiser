let spacesLoaded = false;

function loadSpaces() {
  if (spacesLoaded) return;
  window.__TEST__ = true;
  global.applyMarkdownStyles = (text) => text;
  require("../src/spaces/spaces.js");
  spacesLoaded = true;
}

describe("renderChatMessages", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-messages"></div>';
    loadSpaces();
  });

  test("assistant messages with meta render footer", () => {
    window.renderChatMessages([
      {
        role: 'assistant',
        content: 'Hi',
        meta: {
          model: 'openai/gpt-4o-mini',
          tokens: 10,
          responseTimeSec: 1.2,
          contextSize: 4,
          createdAt: Date.now()
        }
      }
    ]);

    const footer = document.querySelector('.chat-footer');
    const meta = document.querySelector('.chat-meta');
    expect(footer).not.toBeNull();
    expect(meta).not.toBeNull();
  });
});
