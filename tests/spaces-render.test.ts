let spacesLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  renderChatMessages?: (messages: any[]) => void;
  buildAssistantMessage?: (content: string, meta: any) => any;
  buildStreamMessages?: (messages: any[], prompt: string, systemInstruction?: string) => any[];
  getSourcesData?: (content: string) => { sources: any[]; cleanText: string };
};

const testGlobal = global as unknown as {
  applyMarkdownStyles?: (text: string) => string;
};

function loadSpaces() {
  if (spacesLoaded) return;
  win.__TEST__ = true;
  testGlobal.applyMarkdownStyles = (text: string) => text;
  require("../src/spaces/spaces.js");
  spacesLoaded = true;
}

describe("renderChatMessages", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-messages"></div>';
    loadSpaces();
  });

  test("assistant messages with meta render footer", () => {
    win.renderChatMessages?.([
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

  test("assistant messages persist meta on completion", () => {
    const meta = {
      model: 'openai/gpt-4o-mini',
      tokens: 12,
      responseTimeSec: 0.8,
      contextSize: 4
    };

    const msg = win.buildAssistantMessage?.('Hello', meta);
    expect(msg.meta).toEqual(meta);
  });

  test("buildStreamMessages removes duplicate prompt", () => {
    const messages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply' },
      { role: 'user', content: 'Question' }
    ];
    const result = win.buildStreamMessages?.(messages, 'Question');
    expect(result).toHaveLength(2);
    expect(result?.[result.length - 1].role).toBe('assistant');
  });

  test("buildStreamMessages keeps messages when prompt differs", () => {
    const messages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply' }
    ];
    const result = win.buildStreamMessages?.(messages, 'Question');
    expect(result).toHaveLength(2);
  });

  test("getSourcesData returns empty sources when extractor missing", () => {
    const result = win.getSourcesData?.('No sources here');
    expect(result?.sources).toEqual([]);
    expect(result?.cleanText).toBe('No sources here');
  });

  test("getSourcesData uses extractSources when available", () => {
    testGlobal.applyMarkdownStyles = (text: string) => text;
    (global as any).extractSources = (text: string) => ({
      sources: [{ url: 'https://example.com' }],
      cleanText: text.replace('Source', '').trim()
    });
    const result = win.getSourcesData?.('Source text');
    expect(result?.sources).toHaveLength(1);
    expect(result?.cleanText).toBe('text');
    delete (global as any).extractSources;
  });
});
