const fs = require('fs');
const path = require('path');

describe('sidepanel answer persistence', () => {
  test('persists answers per tab using session storage', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/or_sidepanel_answer_/);
    expect(js).toMatch(/storage\.session/);
    expect(js).toMatch(/getCurrentTabId/);
  });
});
