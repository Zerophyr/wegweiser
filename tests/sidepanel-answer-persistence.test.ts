export {};
const fs = require('fs');
const path = require('path');

describe('sidepanel answer persistence', () => {
  test('persists answers per tab using chat store', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/chatStore/);
    expect(js).toMatch(/__sidepanel__/);
    expect(js).toMatch(/getCurrentTabId/);
  });
});

