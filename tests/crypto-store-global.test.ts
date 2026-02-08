export {};
const fs = require('fs');
const path = require('path');

describe('crypto-store globals', () => {
  test('exports helpers on globalThis', () => {
    const file = path.join(__dirname, '..', 'src', 'shared', 'crypto-store.js');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/globalThis\.getOrCreateKey/);
    expect(content).toMatch(/globalThis\.encryptJson/);
    expect(content).toMatch(/globalThis\.decryptJson/);
  });
});
