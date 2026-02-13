// projects-sources-summary-utils.js - rendering helper for Projects source summary row

function renderProjectsSourcesSummary(messageDiv, sources, getUniqueDomainsFn) {
  const summary = messageDiv?.querySelector?.(".chat-sources-summary");
  if (!summary) return;
  summary.innerHTML = "";

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
  count.textContent = `${sources.length} source${sources.length !== 1 ? "s" : ""}`;

  summary.appendChild(stack);
  summary.appendChild(count);
}

const projectsSourcesSummaryUtils = {
  renderProjectsSourcesSummary
};

if (typeof window !== "undefined") {
  window.projectsSourcesSummaryUtils = projectsSourcesSummaryUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsSourcesSummaryUtils;
}
