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

  test('sanitizes restored persisted answers through safe-html helper when available', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/setAnswerHtmlSafe\(payload\.html\)/);
    expect(js).toMatch(/safeHtml\.setSanitizedHtml\(answerEl,\s*html\s*\|\|\s*""\)/);
  });

  test('does not interpolate raw error messages directly into innerHTML', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).not.toMatch(/Error rendering:\s*\$\{e\.message\}/);
  });
});
