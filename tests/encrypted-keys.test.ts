export {};
const fs = require('fs');
const path = require('path');

describe('encrypted storage key list', () => {
  test('constants include encryption key list and excludes model cache', () => {
    const file = path.join(__dirname, '..', 'src', 'shared', 'constants.js');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/ENCRYPTED_STORAGE_KEYS/);
    expect(content).toMatch(/or_models_cache/);
    expect(content).toMatch(/excluded/i);
  });
});
