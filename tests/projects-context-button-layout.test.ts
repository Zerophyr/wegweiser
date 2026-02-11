export {};
const fs = require('fs');
const path = require('path');

describe('projects context button placement', () => {
  test('context button sits inside chat toggles row to the right', () => {
    const htmlPath = path.join(__dirname, '..', 'src', 'projects', 'projects.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toMatch(/class="chat-toggles"[\s\S]*class="chat-toggles-left"/);
    expect(html).toMatch(/class="chat-toggles-left"[\s\S]*id="projects-context-btn"/);
    expect(html).not.toMatch(/chat-meta-row[\s\S]*id="projects-context-btn"/);
  });
});
