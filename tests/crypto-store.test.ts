export {};
const fs = require('fs');
const path = require('path');

describe('crypto-store helper', () => {
  test('crypto helper exists and exports encrypt/decrypt', () => {
    const file = path.join(__dirname, '..', 'src', 'shared', 'crypto-store.js');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/encryptJson/);
    expect(content).toMatch(/decryptJson/);
    expect(content).toMatch(/AES-GCM/);
  });
});
