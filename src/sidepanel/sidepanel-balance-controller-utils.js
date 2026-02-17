// sidepanel-balance-controller-utils.js - balance loading/formatting orchestration

function formatBalanceValue(balance) {
  if (balance == null || Number.isNaN(balance)) return "Unknown";
  return `$${balance.toFixed(4)}`;
}

async function refreshBalance(deps = {}) {
  const balanceEl = deps.balanceEl;
  if (!balanceEl) return;

  balanceEl.textContent = "Loading…";
  try {
    const res = await deps.sendRuntimeMessage({ type: "get_balance" });
    if (!res?.ok) {
      balanceEl.textContent = res?.error || "Error";
      return;
    }

    if (res.supported === false) {
      balanceEl.textContent = "Not supported";
      return;
    }

    balanceEl.textContent = formatBalanceValue(res.balance);
  } catch (e) {
    deps.logError?.("Error refreshing balance:", e);
    balanceEl.textContent = "Error";
  }
}

const sidepanelBalanceControllerUtils = {
  formatBalanceValue,
  refreshBalance
};

if (typeof window !== "undefined") {
  window.sidepanelBalanceControllerUtils = sidepanelBalanceControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelBalanceControllerUtils;
}
