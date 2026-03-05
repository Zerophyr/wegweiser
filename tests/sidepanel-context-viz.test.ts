export {};
const fs = require('fs');
const path = require('path');

describe('sidepanel context viz refresh', () => {
  test('refreshes context viz on sidebar load', () => {
    const sidepanelPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel.js');
    const helperPath = path.join(__dirname, '..', 'src', 'sidepanel', 'sidepanel-ui-helpers-utils.js');
    const sidepanelJs = fs.readFileSync(sidepanelPath, 'utf8');
    const helperJs = fs.readFileSync(helperPath, 'utf8');
    expect(sidepanelJs).toMatch(/refreshContextVisualization/);
    expect(helperJs).toMatch(/get_context_size/);
    expect(sidepanelJs).toMatch(/DOMContentLoaded/);
  });
});
