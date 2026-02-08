export {};
const fs = require('fs');
const path = require('path');

describe('background context persistence', () => {
  test('persists sidebar context in session storage', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'background', 'background.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/context_session_/i);
    expect(js).toMatch(/storage\.session/);
    expect(js).toMatch(/ensureContextLoaded/);
  });
});
