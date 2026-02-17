export {};

const {
  formatBalanceValue,
  refreshBalance
} = require("../src/sidepanel/sidepanel-balance-controller-utils.js");

describe("sidepanel-balance-controller-utils", () => {
  test("formatBalanceValue handles numeric and empty values", () => {
    expect(formatBalanceValue(1.23456)).toBe("$1.2346");
    expect(formatBalanceValue(null)).toBe("Unknown");
    expect(formatBalanceValue(NaN)).toBe("Unknown");
  });

  test("refreshBalance renders success value", async () => {
    const balanceEl = { textContent: "" };

    await refreshBalance({
      balanceEl,
      sendRuntimeMessage: jest.fn().mockResolvedValue({ ok: true, balance: 2.5 })
    });

    expect(balanceEl.textContent).toBe("$2.5000");
  });

  test("refreshBalance renders supported=false state", async () => {
    const balanceEl = { textContent: "" };

    await refreshBalance({
      balanceEl,
      sendRuntimeMessage: jest.fn().mockResolvedValue({ ok: true, supported: false })
    });

    expect(balanceEl.textContent).toBe("Not supported");
  });

  test("refreshBalance renders error state and logs thrown failures", async () => {
    const balanceEl = { textContent: "" };
    const logError = jest.fn();

    await refreshBalance({
      balanceEl,
      sendRuntimeMessage: jest.fn().mockRejectedValue(new Error("failed")),
      logError
    });

    expect(logError).toHaveBeenCalled();
    expect(balanceEl.textContent).toBe("Error");
  });
});