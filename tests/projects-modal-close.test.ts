export {};
const fs = require('fs');
const path = require('path');

describe('projects modal close button styles', () => {
  test('modal close has minimum hit area', () => {
    const cssPath = path.join(__dirname, '..', 'src', 'projects', 'projects.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const match = css.match(/\.modal-close\s*\{[^}]*\}/m);
    expect(match).not.toBeNull();
    const block = match[0];
    expect(block).toMatch(/min-width:\s*32px/);
    expect(block).toMatch(/min-height:\s*32px/);
  });
});

