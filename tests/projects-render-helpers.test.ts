export {};
let projectsLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  renderChatMessages?: (messages: any[]) => void;
  buildAssistantMessage?: (content: string, meta: any) => any;
  buildStreamMessages?: (messages: any[], prompt: string, systemInstruction?: string) => any[];
  getSourcesData?: (content: string) => { sources: any[]; cleanText: string };
  sanitizeFilename?: (name: string) => string;
  getFullThreadMessages?: (thread: any) => any[];
};

const testGlobal = global as unknown as {
  applyMarkdownStyles?: (text: string) => string;
};

function loadProjects() {
  if (projectsLoaded) return;
  win.__TEST__ = true;
  testGlobal.applyMarkdownStyles = (text: string) => text;
  require("../src/projects/projects.js");
  projectsLoaded = true;
}

describe("renderChatMessages", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-messages"></div>';
    loadProjects();
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

  test("buildStreamMessages sends raw instructions on first message", () => {
    const result = win.buildStreamMessages?.([], 'Hello', 'Be concise.');
    const system = result?.find((m: any) => m.role === 'system');
    expect(system?.content).toBe('Be concise.');
  });

  test("buildStreamMessages wraps instructions with ongoing prefix on follow-up", () => {
    const messages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply' }
    ];
    const result = win.buildStreamMessages?.(messages, 'Second', 'Be concise.');
    const system = result?.find((m: any) => m.role === 'system');
    expect(system?.content).toContain('[Ongoing conversation.');
    expect(system?.content).toContain('Be concise.');
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

  test("sanitizeFilename strips special chars and caps length", () => {
    expect(win.sanitizeFilename?.('Hello World!')).toBe('Hello World');
    expect(win.sanitizeFilename?.('a/b\\c:d?e')).toBe('abcde');
    expect(win.sanitizeFilename?.('A'.repeat(100))).toHaveLength(50);
    expect(win.sanitizeFilename?.('')).toBe('thread');
    expect(win.sanitizeFilename?.('   ')).toBe('thread');
  });

  test("getFullThreadMessages combines archived and live messages", () => {
    const thread = {
      archivedMessages: [
        { role: 'user', content: 'Old' },
        { role: 'assistant', content: 'Old reply' }
      ],
      messages: [
        { role: 'user', content: 'New' },
        { role: 'assistant', content: 'New reply' }
      ]
    };
    const result = win.getFullThreadMessages?.(thread);
    expect(result).toHaveLength(4);
    expect(result?.[0].content).toBe('Old');
    expect(result?.[3].content).toBe('New reply');
  });

  test("getFullThreadMessages returns live only when no archive", () => {
    const thread = {
      messages: [{ role: 'user', content: 'Only' }]
    };
    const result = win.getFullThreadMessages?.(thread);
    expect(result).toHaveLength(1);
    expect(result?.[0].content).toBe('Only');
  });
});

