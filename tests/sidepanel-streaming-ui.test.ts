export {};
const fs = require('fs');
const path = require('path');

describe('sidepanel streaming UI state', () => {
  test('does not reset streaming UI while a stream is active', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    const match = js.match(/async function askQuestion\(\)[\s\S]*?\}\s*finally\s*\{([\s\S]*?)\n\s*\}/);

    expect(match).not.toBeNull();
    const finallyBlock = match[1];

    expect(finallyBlock).toMatch(/if\s*\(!activePort\)[\s\S]*?setPromptStreamingState\(false\);/);
    expect(finallyBlock).not.toMatch(/activePort\s*=\s*null/);
  });
});
