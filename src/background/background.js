// background.js

// Import constants (Note: Chrome extensions support import in service workers)
import {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  CACHE_TTL,
  DEFAULTS,
  ERROR_MESSAGES,
  API_CONFIG
} from '/src/shared/constants.js';

// Cache management
let lastBalance = null;
let lastBalanceAt = 0;

let cachedConfig = {
  apiKey: null,
  model: DEFAULTS.MODEL
};
let lastConfigLoadAt = 0;

// Conversation context management (per tab)
const conversationContexts = new Map(); // tabId -> messages array

// ---- Tab cleanup to prevent memory leak ----
chrome.tabs.onRemoved.addListener((tabId) => {
  conversationContexts.delete(tabId);
  console.log(`Cleaned up context for tab ${tabId}`);
});

// ---- Config (API key + model) ----
async function loadConfig() {
  const now = Date.now();
  if (now - lastConfigLoadAt < CACHE_TTL.CONFIG && cachedConfig.apiKey) {
    return cachedConfig;
  }

  // SECURITY FIX: Use chrome.storage.local instead of sync for API key
  const items = await chrome.storage.local.get([STORAGE_KEYS.API_KEY, STORAGE_KEYS.MODEL]);
  cachedConfig = {
    apiKey: items[STORAGE_KEYS.API_KEY] || "",
    model: items[STORAGE_KEYS.MODEL] || DEFAULTS.MODEL
  };
  lastConfigLoadAt = now;
  return cachedConfig;
}

// ---- History helpers (storage.local) ----
async function loadHistory() {
  const res = await chrome.storage.local.get({ [STORAGE_KEYS.HISTORY]: [] });
  return res[STORAGE_KEYS.HISTORY] || [];
}

async function saveHistory(history) {
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
}

async function addHistoryEntry(prompt, answer) {
  const history = await loadHistory();
  const settings = await chrome.storage.local.get([STORAGE_KEYS.HISTORY_LIMIT]);
  const historyLimit = settings[STORAGE_KEYS.HISTORY_LIMIT] || DEFAULTS.HISTORY_LIMIT;

  const entry = {
    id: crypto.randomUUID(),
    prompt,
    answer,
    createdAt: Date.now()
  };
  history.unshift(entry);
  if (history.length > historyLimit) history.length = historyLimit;
  await saveHistory(history);
  return entry;
}

// ---- Install: side panel ----
chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

// ---- Message bridge: chat, balance, history ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === MESSAGE_TYPES.OPENROUTER_QUERY) {
    (async () => {
      try {
        const cfg = await loadConfig();
        const tabId = msg.tabId || 'default';
        const result = await callOpenRouter(msg.prompt, msg.webSearch, msg.reasoning, tabId);
        await addHistoryEntry(msg.prompt, result.answer);
        sendResponse({
          ok: true,
          answer: result.answer,
          model: cfg.model,
          tokens: result.tokens,
          contextSize: result.contextSize,
          reasoning: result.reasoning  // Include reasoning in response
        });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.CLEAR_CONTEXT) {
    (async () => {
      try {
        const tabId = msg.tabId || 'default';
        conversationContexts.delete(tabId);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
      return true;
    }

    if (msg?.type === MESSAGE_TYPES.SUMMARIZE_THREAD) {
      (async () => {
        try {
          const result = await callOpenRouterWithMessages(msg.messages || [], msg.model || null);
          sendResponse({ ok: true, summary: result.answer, tokens: result.tokens });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

  if (msg?.type === "get_context_size") {
    (async () => {
      try {
        const tabId = msg.tabId || 'default';
        const contextSize = conversationContexts.has(tabId) ? conversationContexts.get(tabId).length : 0;
        sendResponse({ ok: true, contextSize });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.GET_BALANCE) {
    (async () => {
      try {
        const balance = await getOpenRouterBalance();
        sendResponse({ ok: true, balance });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_history") {
    (async () => {
      try {
        const history = await loadHistory();
        sendResponse({ ok: true, history });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "delete_history_item" && msg.id) {
    (async () => {
      try {
        const history = await loadHistory();
        const filtered = history.filter((h) => h.id !== msg.id);
        await saveHistory(filtered);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_config") {
    (async () => {
      try {
        const cfg = await loadConfig();
        sendResponse({ ok: true, config: cfg });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "set_model" && msg.model) {
    (async () => {
      try {
        // Save to local storage to match loadConfig()
        await chrome.storage.local.set({ or_model: msg.model });
        cachedConfig.model = msg.model;
        lastConfigLoadAt = Date.now();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "get_context" && msg.tabId) {
    const context = conversationContexts.get(msg.tabId) || [];
    sendResponse({ ok: true, context: context });
    return false;
  }

  if (msg?.type === MESSAGE_TYPES.GET_MODELS || msg?.type === "get_models") {
    (async () => {
      try {
        // Check cache first
        const cacheData = await chrome.storage.local.get([
          STORAGE_KEYS.MODELS_CACHE,
          STORAGE_KEYS.MODELS_CACHE_TIME
        ]);

        const now = Date.now();
        if (cacheData[STORAGE_KEYS.MODELS_CACHE] &&
            cacheData[STORAGE_KEYS.MODELS_CACHE_TIME] &&
            (now - cacheData[STORAGE_KEYS.MODELS_CACHE_TIME]) < CACHE_TTL.MODELS) {
          console.log("Returning cached models");
          sendResponse({ ok: true, models: cacheData[STORAGE_KEYS.MODELS_CACHE] });
          return;
        }

        const cfg = await loadConfig();
        if (!cfg.apiKey) {
          sendResponse({ ok: false, error: ERROR_MESSAGES.NO_API_KEY });
          return;
        }

        const res = await fetch(`${API_CONFIG.BASE_URL}/models`, {
          headers: {
            "Authorization": `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json"
          }
        });

        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error?.message || ERROR_MESSAGES.API_ERROR);
        }

        const data = await res.json();
        const models = (data.data || []).map((m) => ({
          id: m.id,
          name: m.name || m.id
        }));

        // Cache the models
        await chrome.storage.local.set({
          [STORAGE_KEYS.MODELS_CACHE]: models,
          [STORAGE_KEYS.MODELS_CACHE_TIME]: now
        });

        sendResponse({ ok: true, models });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.REQUEST_PERMISSION) {
    (async () => {
      try {
        const url = msg.url;
        if (!url) {
          sendResponse({ ok: false, error: "No URL provided" });
          return;
        }

        // Request permission for this origin
        // Extract origin from URL
        const urlObj = new URL(url);
        const origin = `${urlObj.protocol}//${urlObj.host}/*`;

        const granted = await chrome.permissions.request({
          origins: [origin]
        });

        sendResponse({ ok: true, granted });
      } catch (e) {
        console.error('Permission request error:', e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === MESSAGE_TYPES.SUMMARIZE_PAGE) {
    (async () => {
      try {
        const tabId = msg.tabId;
        if (!tabId) {
          sendResponse({ ok: false, error: "No tab ID provided" });
          return;
        }

        // Get the tab URL to check permissions
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url;

        // Check if we have permission to access this URL
        const hasPermission = await chrome.permissions.contains({
          origins: [url]
        });

        if (!hasPermission) {
          // Request permission from the user
          sendResponse({
            ok: false,
            error: "PERMISSION_NEEDED",
            requiresPermission: true,
            url: url
          });
          return;
        }

        // Function to extract page content
        const extractPageContent = () => {
          // Strategy 1: Try to find article tags
          const article = document.querySelector('article');
          if (article) {
            return {
              title: document.title,
              content: article.innerText,
              url: window.location.href
            };
          }

          // Strategy 2: Use main content areas
          const mainContent = document.querySelector('main') ||
                              document.querySelector('[role="main"]') ||
                              document.body;

          // Clone and strip unwanted elements
          const clone = mainContent.cloneNode(true);
          clone.querySelectorAll('script, style, nav, footer, aside, header, .ad, .advertisement, [role="navigation"], [role="complementary"]').forEach(el => el.remove());

          return {
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content || '',
            content: clone.innerText, // Get full content, we'll chunk it if needed
            url: window.location.href
          };
        };

        // Execute content extraction script in the active tab
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: extractPageContent
        });

        const pageData = results[0].result;

        // Smart chunking: Split content if it's too large
        const MAX_CHUNK_SIZE = 12000; // ~12k chars per chunk to leave room for prompt
        const content = pageData.content.trim();

        let finalAnswer;
        let finalTokens = null;

        if (content.length <= MAX_CHUNK_SIZE) {
          // Content is small enough, summarize in one go
          let prompt = `Please provide a concise summary of the following webpage:\n\nTitle: ${pageData.title}\nURL: ${pageData.url}\n`;

          if (pageData.description) {
            prompt += `\nDescription: ${pageData.description}\n`;
          }

          prompt += `\nContent:\n${content}`;

          const result = await callOpenRouter(prompt, msg.webSearch, msg.reasoning, tabId);
          finalAnswer = result.answer;
          finalTokens = result.tokens;
          await addHistoryEntry(prompt, finalAnswer);
        } else {
          // Content is large, chunk and summarize
          console.log(`[Chunking] Content is ${content.length} chars, splitting into chunks...`);

          // Split content into chunks
          const chunks = [];
          for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
            chunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
          }

          console.log(`[Chunking] Created ${chunks.length} chunks`);

          // Summarize each chunk and track total tokens
          const chunkSummaries = [];
          let totalTokens = 0;
          for (let i = 0; i < chunks.length; i++) {
            const chunkPrompt = `Please provide a concise summary of this section (part ${i + 1} of ${chunks.length}) from the webpage "${pageData.title}":\n\n${chunks[i]}`;

            const chunkResult = await callOpenRouter(chunkPrompt, msg.webSearch, msg.reasoning, tabId);
            chunkSummaries.push(chunkResult.answer);
            if (chunkResult.tokens) {
              totalTokens += chunkResult.tokens;
            }

            console.log(`[Chunking] Summarized chunk ${i + 1}/${chunks.length} (${chunkResult.tokens || '?'} tokens)`);
          }

          // Combine all chunk summaries into final summary
          const combinedPrompt = `Please provide a comprehensive summary by combining these section summaries from the webpage "${pageData.title}" (${pageData.url}):\n\n${chunkSummaries.map((s, i) => `Section ${i + 1}:\n${s}`).join('\n\n---\n\n')}`;

          const finalResult = await callOpenRouter(combinedPrompt, msg.webSearch, msg.reasoning, tabId);
          finalAnswer = finalResult.answer;
          if (finalResult.tokens) {
            totalTokens += finalResult.tokens;
          }
          finalTokens = totalTokens;

          // Save to history with a note about chunking
          const historyPrompt = `[Chunked Summary - ${chunks.length} parts] ${pageData.title}\n${pageData.url}`;
          await addHistoryEntry(historyPrompt, finalAnswer);

          console.log(`[Chunking] Final summary generated from ${chunks.length} chunks (${totalTokens} total tokens)`);
        }

        // Get final context size
        const contextSize = conversationContexts.has(tabId) ? conversationContexts.get(tabId).length : 0;

        sendResponse({
          ok: true,
          answer: finalAnswer,
          model: (await loadConfig()).model,
          tokens: finalTokens,
          contextSize: contextSize
        });
      } catch (e) {
        console.error('Summarize page error:', e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }
});

// ---- OpenRouter: chat completions with retry logic ----
async function callOpenRouter(prompt, webSearch = false, reasoning = false, tabId = 'default') {
  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  // Get or initialize conversation context for this tab
  if (!conversationContexts.has(tabId)) {
    conversationContexts.set(tabId, []);
  }
  const context = conversationContexts.get(tabId);

  // Add user message to context
  context.push({ role: "user", content: prompt });

  // Keep only the last DEFAULTS.MAX_CONTEXT_MESSAGES messages
  if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
    context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
  }

  console.log(`[Context] Tab ${tabId}: ${context.length} messages in context`);

  // If web search is enabled, append :online to the model
  let modelName = cfg.model;
  if (webSearch && !modelName.endsWith(':online')) {
    modelName = `${modelName}:online`;
  }

  const requestBody = {
    model: modelName,
    messages: [...context] // Send all context messages
  };

  // Debug: Log the full context being sent
  console.log(`[Context Debug] Sending ${context.length} messages to API for tab ${tabId}:`,
    context.map((m, i) => `${i}: ${m.role} - ${m.content.substring(0, 50)}...`));

  // Add reasoning parameter if enabled
  if (reasoning) {
    requestBody.reasoning = {
      enabled: true,
      effort: "medium"
    };
    console.log('[Reasoning] Reasoning parameter added to request:', requestBody.reasoning);
  }

  // Retry logic with exponential backoff
  let lastError;
  for (let attempt = 0; attempt < API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const res = await fetch(`${API_CONFIG.BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "OpenRouter Buddy Extension"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        // Categorize errors
        if (res.status === 429) {
          throw new Error(ERROR_MESSAGES.RATE_LIMIT);
        } else if (res.status >= 500) {
          // Server error - retry
          throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
        } else {
          // Client error - don't retry
          throw new Error(data?.error?.message || ERROR_MESSAGES.INVALID_RESPONSE);
        }
      }

      const content = data.choices?.[0]?.message?.content || "(No content returned)";
      const tokens = data.usage?.total_tokens || null;

      // Add assistant response to context
      context.push({ role: "assistant", content });

      // Keep only the last DEFAULTS.MAX_CONTEXT_MESSAGES messages
      if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
        context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
      }

      console.log(`[Context] Tab ${tabId}: ${context.length} messages after response`);

      return {
        answer: content,
        tokens,
        contextSize: context.length,
        reasoning: null  // Old function doesn't extract reasoning
      };

    } catch (error) {
      lastError = error;

      // Don't retry on client errors or timeouts
      if (error.name === 'AbortError') {
        throw new Error(ERROR_MESSAGES.TIMEOUT);
      }
      if (error.message.includes('API key') || error.message.includes('Rate limit')) {
        throw error;
      }

      // Exponential backoff before retry
      if (attempt < API_CONFIG.MAX_RETRIES - 1) {
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error(ERROR_MESSAGES.API_ERROR);
}

async function callOpenRouterWithMessages(messages, customModel = null) {
  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  const requestBody = {
    model: customModel || cfg.model || DEFAULTS.MODEL,
    messages: Array.isArray(messages) ? messages : []
  };

  let lastError;
  for (let attempt = 0; attempt < API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const res = await fetch(`${API_CONFIG.BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "OpenRouter Buddy Extension"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(ERROR_MESSAGES.RATE_LIMIT);
        } else if (res.status >= 500) {
          throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
        } else {
          throw new Error(data?.error?.message || ERROR_MESSAGES.INVALID_RESPONSE);
        }
      }

      const content = data.choices?.[0]?.message?.content || "(No content returned)";
      const tokens = data.usage?.total_tokens || null;

      return { answer: content, tokens };
    } catch (error) {
      lastError = error;

      if (error.name === 'AbortError') {
        throw new Error(ERROR_MESSAGES.TIMEOUT);
      }
      if (error.message.includes('API key') || error.message.includes('Rate limit')) {
        throw error;
      }

      if (attempt < API_CONFIG.MAX_RETRIES - 1) {
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(ERROR_MESSAGES.API_ERROR);
}

// ---- OpenRouter: credits/balance ----
// GET /api/v1/credits returns { data: { total_credits, total_usage } } [web:29][web:31][web:41]
async function getOpenRouterBalance() {
  const now = Date.now();
  if (lastBalance !== null && now - lastBalanceAt < CACHE_TTL.BALANCE) {
    return lastBalance;
  }

  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  const res = await fetch(`${API_CONFIG.BASE_URL}/credits`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
  }

  console.log("Credits response:", data);

  const credits = data?.data?.total_credits;
  const usage = data?.data?.total_usage;

  let balance = null;
  if (typeof credits === "number" && typeof usage === "number") {
    balance = credits - usage;
  }

  lastBalance = balance;
  lastBalanceAt = now;
  return balance;
}

// ---- Streaming Port Connection ----
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'streaming') return;

  let isDisconnected = false;

  // Track port disconnection
  port.onDisconnect.addListener(() => {
    isDisconnected = true;
    console.log('[Streaming] Port disconnected by client');
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'start_stream') {
      try {
        await streamOpenRouterResponse(
          msg.prompt,
          msg.webSearch,
          msg.reasoning,
          msg.tabId,
          port,
          () => isDisconnected,
          msg.messages,  // Custom messages array (for Spaces)
          msg.model      // Custom model (for Spaces)
        );
      } catch (e) {
        // Only send error if port is still connected
        if (!isDisconnected) {
          try {
            port.postMessage({ type: 'error', error: e?.message || String(e) });
          } catch (postError) {
            console.error('[Streaming] Failed to send error (port disconnected):', postError);
          }
        }
      }
    }
  });
});

// Streaming version of callOpenRouter that sends real-time updates via Port
async function streamOpenRouterResponse(prompt, webSearch, reasoning, tabId, port, isDisconnectedFn, customMessages = null, customModel = null) {
  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  // Helper function to safely send port messages
  const safeSendMessage = (message) => {
    if (isDisconnectedFn && isDisconnectedFn()) {
      console.log('[Streaming] Skipping message send - port disconnected');
      return false;
    }
    try {
      port.postMessage(message);
      return true;
    } catch (e) {
      console.error('[Streaming] Failed to send message:', e);
      return false;
    }
  };

  // Use custom messages if provided (for Spaces), otherwise use conversation context
  let context;
  const isSpacesMode = customMessages !== null;

  if (isSpacesMode) {
    // Spaces mode: use provided messages array
    context = [...customMessages];
    // Add the new user message
    context.push({ role: "user", content: prompt });
  } else {
    // Sidebar mode: use per-tab context
    context = conversationContexts.get(tabId) || [];
    context.push({ role: "user", content: prompt });

    // Trim context if needed
    if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
    }
    conversationContexts.set(tabId, context);
  }

  // Use custom model if provided, otherwise use config model
  let modelName = customModel || cfg.model || DEFAULTS.MODEL;
  if (webSearch && !modelName.endsWith(':online')) {
    modelName = `${modelName}:online`;
  }

  const requestBody = {
    model: modelName,
    messages: context,
    stream: true
  };

  if (reasoning) {
    requestBody.reasoning = {
      enabled: true,
      effort: "medium"
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  const res = await fetch(`${API_CONFIG.BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "OpenRouter Buddy Extension"
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error?.message || ERROR_MESSAGES.API_ERROR);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let tokens = null;

  console.log('[Streaming] Starting real-time stream...');

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('[Streaming] Reader reported done, exiting loop');
      break;
    }

    // Check if port was disconnected
    if (isDisconnectedFn && isDisconnectedFn()) {
      console.log('[Streaming] Port disconnected, stopping stream');
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim() === '') continue;
      if (line.trim() === 'data: [DONE]') {
        console.log('[Streaming] Received [DONE] signal');
        continue;
      }
      if (!line.startsWith('data: ')) continue;

      try {
        const jsonStr = line.slice(6);
        const chunk = JSON.parse(jsonStr);
        const delta = chunk.choices?.[0]?.delta;

        // Debug: Log the full delta structure to understand web search response format
        if (delta && Object.keys(delta).length > 0) {
          console.log('[Streaming] Delta keys:', Object.keys(delta), 'delta:', JSON.stringify(delta).slice(0, 200));
        }

        // Stream content chunks
        if (delta?.content) {
          fullContent += delta.content;
          const sent = safeSendMessage({
            type: 'content',
            content: delta.content
          });
          if (!sent) break; // Stop if port disconnected
        }

        // Stream reasoning chunks
        // Note: delta.reasoning and delta.reasoning_details contain the same content
        // We only need to send one of them to avoid duplicates
        if (delta?.reasoning) {
          const sent = safeSendMessage({
            type: 'reasoning',
            reasoning: delta.reasoning
          });
          if (!sent) break; // Stop if port disconnected
        }

        // Extract usage
        if (chunk.usage) {
          tokens = chunk.usage.total_tokens;
        }
      } catch (e) {
        console.error('[Streaming] Error parsing chunk:', e);
      }
    }
  }

  console.log('[Streaming] Stream complete, fullContent length:', fullContent.length);

  // Handle case where no content was received (e.g., only reasoning, or stream error)
  if (!fullContent || fullContent.length === 0) {
    console.warn('[Streaming] Warning: Stream completed with no content');
    safeSendMessage({
      type: 'error',
      error: 'No response content received from the model. The model may have only produced reasoning without a final answer. Please try again.'
    });
    return;
  }

  // Only save to sidebar context if not using Spaces mode
  if (!isSpacesMode) {
    // Add assistant response to context
    context.push({ role: "assistant", content: fullContent });

    // Trim context again
    if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
    }

    // Save updated context back to Map
    conversationContexts.set(tabId, context);

    // Save to history
    await addHistoryEntry(prompt, fullContent);
  }

  // Send completion message (only if port still connected)
  const completeSent = safeSendMessage({
    type: 'complete',
    tokens,
    contextSize: context.length,
    model: customModel || cfg.model
  });
  console.log('[Streaming] Completion message sent:', completeSent);
}
