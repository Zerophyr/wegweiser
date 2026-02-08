export {};
const fs = require('fs');
const path = require('path');

describe('sidepanel context viz refresh', () => {
  test('refreshes context viz on sidebar load', () => {
    const jsPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/refreshContextVisualization/);
    expect(js).toMatch(/get_context_size/);
    expect(js).toMatch(/DOMContentLoaded/);
  });
});
