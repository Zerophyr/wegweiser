// projects-stream-request-utils.js - stream request assembly for Projects UI

function resolveStreamToggles(options = {}, elements = {}) {
  const webSearch = typeof options.webSearch === "boolean"
    ? options.webSearch
    : Boolean(elements.chatWebSearch?.checked);
  const reasoning = typeof options.reasoning === "boolean"
    ? options.reasoning
    : Boolean(elements.chatReasoning?.checked);
  return { webSearch, reasoning };
}

function buildStartStreamPayload(params = {}) {
  const project = params.project || {};
  return {
    type: "start_stream",
    prompt: params.content || "",
    messages: Array.isArray(params.messages) ? params.messages : [],
    model: project.model || null,
    provider: project.modelProvider || params.provider || "openrouter",
    webSearch: Boolean(params.webSearch),
    reasoning: Boolean(params.reasoning),
    tabId: `Project_${project.id || ""}`,
    retry: params.retry === true
  };
}

const projectsStreamRequestUtils = {
  resolveStreamToggles,
  buildStartStreamPayload
};

if (typeof window !== "undefined") {
  window.projectsStreamRequestUtils = projectsStreamRequestUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsStreamRequestUtils;
}
