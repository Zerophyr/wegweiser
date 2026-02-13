// sidepanel-provider.js - Backwards-compatible alias for shared provider UI helpers

const sidepanelProviderUtils =
  (typeof window !== "undefined" && window.providerUiUtils)
    ? window.providerUiUtils
    : require("../modules/provider-ui-utils.js");

if (typeof window !== "undefined") {
  window.sidepanelProviderUtils = sidepanelProviderUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelProviderUtils;
}
