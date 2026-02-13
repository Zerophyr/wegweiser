export {};
const fs = require("fs");
const path = require("path");

describe("background provider helper extraction", () => {
  test("background imports provider utils module", () => {
    const bg = fs.readFileSync(path.join(__dirname, "..", "src", "background", "background.js"), "utf8");
    expect(bg).toMatch(/from '\/src\/background\/provider-utils\.js'/);
  });

  test("provider utils module defines auth and cache helpers", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "src", "background", "provider-utils.js"), "utf8");
    expect(content).toMatch(/export function normalizeProviderId/);
    expect(content).toMatch(/export function getProviderConfig/);
    expect(content).toMatch(/export function getModelsCacheKeys/);
    expect(content).toMatch(/export function buildAuthHeaders/);
    expect(content).toMatch(/export function buildBalanceHeaders/);
  });
});
