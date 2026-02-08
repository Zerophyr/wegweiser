export {};
const fs = require('fs');
const path = require('path');

describe('encrypted storage integration', () => {
  test('background/options/spaces/sidepanel use encrypted storage wrapper', () => {
    const files = [
      path.join(__dirname, '..', 'src', 'background', 'background.js'),
      path.join(__dirname, '..', 'src', 'options', 'options.js'),
      path.join(__dirname, '..', 'src', 'spaces', 'spaces.js'),
      path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js')
    ];
    const contents = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
    expect(contents).toMatch(/encrypted-storage/);
  });
});
