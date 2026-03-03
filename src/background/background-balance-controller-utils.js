// background-balance-controller-utils.js - Provider balance orchestration

function createBackgroundBalanceController(rawDeps) {
  const deps = rawDeps || {};

  const loadConfig = deps.loadConfig || (async () => ({}));
  const normalizeProviderId = deps.normalizeProviderId || ((providerId) => providerId || "openrouter");
  const getProviderConfig = deps.getProviderConfig || (() => ({ supportsBalance: false }));
  const cacheTtlMs = Number.isFinite(deps.cacheTtlMs) ? deps.cacheTtlMs : 0;
  const lastBalanceByProvider = deps.lastBalanceByProvider || {};
  const lastBalanceAtByProvider = deps.lastBalanceAtByProvider || {};
  const buildBalanceHeaders = deps.buildBalanceHeaders || (() => ({}));
  const errorMessages = deps.errorMessages || { NO_API_KEY: "No API key", API_ERROR: "API error" };
  const fetchFn = deps.fetchFn || fetch;
  const now = deps.now || Date.now;
  const logger = deps.logger || console;

  async function getProviderBalance() {
    const cfg = await loadConfig();
    const providerId = normalizeProviderId(cfg.modelProvider);
    const providerConfig = getProviderConfig(providerId);

    if (!providerConfig.supportsBalance) {
      return { supported: false, balance: null };
    }

    const nowMs = now();
    if (lastBalanceByProvider[providerId] !== null
      && lastBalanceByProvider[providerId] !== undefined
      && (nowMs - (lastBalanceAtByProvider[providerId] || 0)) < cacheTtlMs) {
      return { supported: true, balance: lastBalanceByProvider[providerId] };
    }

    if (!cfg.apiKey) {
      throw new Error(errorMessages.NO_API_KEY);
    }

    const balanceEndpoint = providerConfig.balanceEndpoint || "/credits";
    const res = await fetchFn(`${providerConfig.baseUrl}${balanceEndpoint}`, {
      method: "GET",
      headers: buildBalanceHeaders(cfg.apiKey, providerConfig)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || errorMessages.API_ERROR);
    }

    logger.log("Credits response:", data);

    let balance = null;
    const credits = data?.data?.total_credits;
    const usage = data?.data?.total_usage;
    if (typeof credits === "number" && typeof usage === "number") {
      balance = credits - usage;
    }

    lastBalanceByProvider[providerId] = balance;
    lastBalanceAtByProvider[providerId] = nowMs;
    return { supported: true, balance };
  }

  return { getProviderBalance };
}

const backgroundBalanceControllerUtils = {
  createBackgroundBalanceController
};

if (typeof window !== "undefined") {
  window.backgroundBalanceControllerUtils = backgroundBalanceControllerUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.backgroundBalanceControllerUtils = backgroundBalanceControllerUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = backgroundBalanceControllerUtils;
}
