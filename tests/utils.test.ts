const { getTokenBarStyle } = require("../src/shared/utils.js");

describe("getTokenBarStyle", () => {
  test("returns 0% and green for null tokens", () => {
    const res = getTokenBarStyle(null, 4000);
    expect(res.percent).toBe(0);
    expect(res.gradient).toContain("#22c55e");
  });

  test("returns yellow for mid usage", () => {
    const res = getTokenBarStyle(2400, 4000);
    expect(res.percent).toBe(60);
    expect(res.gradient).toContain("#eab308");
  });

  test("returns red for high usage", () => {
    const res = getTokenBarStyle(3600, 4000);
    expect(res.percent).toBe(90);
    expect(res.gradient).toContain("#ef4444");
  });
});
