export {};
const fs = require('fs');
const path = require('path');

describe('encrypted storage globals', () => {
  test('exports helpers on globalThis', () => {
    const file = path.join(__dirname, '..', 'src', 'shared', 'encrypted-storage.js');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/globalThis\.getEncrypted/);
    expect(content).toMatch(/globalThis\.setEncrypted/);
  });

  test('does not redeclare encryptJson in global scope', () => {
    const file = path.join(__dirname, '..', 'src', 'shared', 'encrypted-storage.js');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toMatch(/const\s+\{\s*encryptJson/);
  });
});
