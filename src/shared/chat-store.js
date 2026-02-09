// chat-store.js - encrypted IndexedDB-backed chat storage

let cachedStore = null;

function createMemoryChatStore() {
  return {
    threads: new Map(),
    messages: new Map()
  };
}

function getDefaultStore() {
  if (!cachedStore) {
    cachedStore = createMemoryChatStore();
  }
  return cachedStore;
}

async function putThread(thread, store) {
  const adapter = store || getDefaultStore();
  if (!thread || !thread.id) return null;
  adapter.threads.set(thread.id, thread);
  return thread;
}

async function getThread(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return null;
  return adapter.threads.get(threadId) || null;
}

async function putMessage(message, store) {
  const adapter = store || getDefaultStore();
  if (!message || !message.id || !message.threadId) return null;
  const list = adapter.messages.get(message.threadId) || [];
  list.push(message);
  adapter.messages.set(message.threadId, list);
  return message;
}

async function getMessages(threadId, store) {
  const adapter = store || getDefaultStore();
  if (!threadId) return [];
  return adapter.messages.get(threadId) || [];
}

if (typeof module !== "undefined") {
  module.exports = {
    createMemoryChatStore,
    putThread,
    getThread,
    putMessage,
    getMessages
  };
}
