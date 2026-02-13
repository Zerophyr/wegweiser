// projects-data-utils.js - Helpers for Projects and Threads data shaping

function createProjectRecord({ data = {}, id, now = Date.now() } = {}) {
  return {
    id,
    name: data.name,
    description: data.description || "",
    icon: data.icon || "📁",
    model: data.model || "",
    modelProvider: data.modelProvider || null,
    modelDisplayName: data.modelDisplayName || "",
    customInstructions: data.customInstructions || "",
    webSearch: data.webSearch || false,
    reasoning: data.reasoning || false,
    createdAt: now,
    updatedAt: now
  };
}

function applyProjectUpdate(project, data = {}, now = Date.now()) {
  return {
    ...project,
    ...data,
    updatedAt: now
  };
}

function createThreadRecord({ id, projectId, title = "New Thread", now = Date.now() } = {}) {
  return {
    id,
    projectId,
    title,
    messages: [],
    summary: "",
    summaryUpdatedAt: null,
    archivedMessages: [],
    archivedUpdatedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function applyThreadUpdate(thread, data = {}, now = Date.now()) {
  return {
    ...thread,
    ...data,
    updatedAt: now
  };
}

function appendMessageToThread({ thread, message, now = Date.now(), generateThreadTitle } = {}) {
  const nextMessages = [...(Array.isArray(thread?.messages) ? thread.messages : []), message];
  const shouldRetitle = (
    nextMessages.length === 1
    && message?.role === "user"
    && thread?.title === "New Thread"
    && typeof generateThreadTitle === "function"
  );
  return {
    ...thread,
    messages: nextMessages,
    title: shouldRetitle ? generateThreadTitle(message.content || "") : thread?.title,
    updatedAt: now
  };
}

const projectsDataUtils = {
  createProjectRecord,
  applyProjectUpdate,
  createThreadRecord,
  applyThreadUpdate,
  appendMessageToThread
};

if (typeof window !== "undefined") {
  window.projectsDataUtils = projectsDataUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsDataUtils;
}
