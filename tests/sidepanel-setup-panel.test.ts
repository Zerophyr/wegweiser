export {};
const fs = require('fs');
const path = require('path');

describe('sidepanel setup panel', () => {
  test('renders setup panel elements in sidepanel html', () => {
    const htmlPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/id="setup-panel"/);
    expect(html).toMatch(/Open Options/);
  });

  test('sidebar setup logic exists in sidepanel js', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/setup panel/i);
    expect(js).toMatch(/openOptionsPage/);
    expect(js).toMatch(/isProviderReady/);
    expect(js).toMatch(/or_api_key/);
  });
});
