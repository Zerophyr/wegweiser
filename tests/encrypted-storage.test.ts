export {};
const fs = require('fs');
const path = require('path');

describe('encrypted storage wrapper', () => {
  test('wrapper exists and references encrypted keys', () => {
    const file = path.join(__dirname, '..', 'src', 'shared', 'encrypted-storage.js');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/ENCRYPTED_STORAGE_KEYS/);
    expect(content).toMatch(/encryptJson/);
    expect(content).toMatch(/decryptJson/);
  });
});
