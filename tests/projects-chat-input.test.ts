export {};
const fs = require('fs');
const path = require('path');

describe('projects chat input layout', () => {
  test('chat input stretches to container width', () => {
    const cssPath = path.join(__dirname, '..', 'src', 'projects', 'projects.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const match = css.match(/#chat-input\s*\{([\s\S]*?)\}/i);

    expect(match).not.toBeNull();
    const block = match[1];

    expect(block).toMatch(/width:\s*100%/i);
    expect(block).toMatch(/display:\s*block/i);
  });
});
