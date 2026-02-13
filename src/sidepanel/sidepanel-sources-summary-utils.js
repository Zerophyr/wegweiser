// sidepanel-sources-summary-utils.js - rendering helper for source summary row

function renderSourcesSummaryToElement(summaryEl, sources, getUniqueDomainsFn, buildSourcesCountLabelFn) {
  if (!summaryEl) return;
  summaryEl.innerHTML = "";

  if (!Array.isArray(sources) || sources.length === 0 || typeof getUniqueDomainsFn !== "function") {
    return;
  }

  const uniqueDomains = getUniqueDomainsFn(sources);
  const stack = document.createElement("div");
  stack.className = "sources-favicon-stack";

  uniqueDomains.slice(0, 5).forEach((domain, index) => {
    const favicon = document.createElement("img");
    favicon.src = domain.favicon;
    favicon.alt = domain.domain;
    favicon.style.zIndex = String(5 - index);
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="%23888"><circle cx="8" cy="8" r="8"/></svg>';
    };
    stack.appendChild(favicon);
  });

  const count = document.createElement("span");
  count.className = "sources-count";
  if (typeof buildSourcesCountLabelFn === "function") {
    count.textContent = buildSourcesCountLabelFn(sources.length);
  } else {
    count.textContent = `${sources.length} source${sources.length !== 1 ? "s" : ""}`;
  }

  summaryEl.appendChild(stack);
  summaryEl.appendChild(count);
}

const sidepanelSourcesSummaryUtils = {
  renderSourcesSummaryToElement
};

if (typeof window !== "undefined") {
  window.sidepanelSourcesSummaryUtils = sidepanelSourcesSummaryUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = sidepanelSourcesSummaryUtils;
}
