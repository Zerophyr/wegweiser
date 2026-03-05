// utils-streaming.js - Shared stream/summarization utility helpers

function renderStreamingText(container, text, chunkSize = 10, delay = 30) {
  return (async () => {
    const words = String(text || '').split(' ');
    let currentText = '';
    const textNode = document.createTextNode('');
    container.appendChild(textNode);

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, Math.min(i + chunkSize, words.length));
      currentText += (i > 0 ? ' ' : '') + chunk.join(' ');
      textNode.textContent = currentText;
      if (i + chunkSize < words.length) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    textNode.remove();

    if (typeof applyMarkdownStyles === 'function') {
      applyMarkdownStyles(container, text);
    } else {
      container.textContent = text;
    }
  })();
}

function extractReasoningFromStreamChunk(state, chunk) {
  const target = (state && typeof state === 'object') ? state : {};
  if (typeof target.inReasoning !== 'boolean') {
    target.inReasoning = false;
  }
  if (typeof target.carry !== 'string') {
    target.carry = '';
  }

  const startTag = '<think>';
  const endTag = '</think>';
  let input = target.carry + (typeof chunk === 'string' ? chunk : '');
  target.carry = '';

  let contentOut = '';
  let reasoningOut = '';

  while (input.length > 0) {
    if (target.inReasoning) {
      const endIdx = input.indexOf(endTag);
      if (endIdx === -1) {
        const partialIdx = input.lastIndexOf('</');
        if (partialIdx !== -1 && partialIdx > input.length - endTag.length) {
          reasoningOut += input.slice(0, partialIdx);
          target.carry = input.slice(partialIdx);
        } else {
          reasoningOut += input;
        }
        input = '';
      } else {
        reasoningOut += input.slice(0, endIdx);
        input = input.slice(endIdx + endTag.length);
        target.inReasoning = false;
      }
    } else {
      const startIdx = input.indexOf(startTag);
      if (startIdx === -1) {
        const partialIdx = input.lastIndexOf('<');
        if (partialIdx !== -1 && partialIdx > input.length - startTag.length) {
          contentOut += input.slice(0, partialIdx);
          target.carry = input.slice(partialIdx);
        } else {
          contentOut += input;
        }
        input = '';
      } else {
        contentOut += input.slice(0, startIdx);
        input = input.slice(startIdx + startTag.length);
        target.inReasoning = true;
      }
    }
  }

  return { content: contentOut, reasoning: reasoningOut };
}

function getTokenBarStyle(tokens, maxTokens = 4000) {
  if (!tokens || !maxTokens) {
    return { percent: 0, gradient: 'linear-gradient(90deg, var(--color-success, #22c55e), #16a34a)' };
  }
  const percent = Math.round(Math.min((tokens / maxTokens) * 100, 100));
  let gradient = 'linear-gradient(90deg, var(--color-success, #22c55e), #16a34a)';
  if (percent >= 80) {
    gradient = 'linear-gradient(90deg, var(--color-error, #ef4444), #dc2626)';
  } else if (percent >= 50) {
    gradient = 'linear-gradient(90deg, var(--color-warning, #eab308), #ca8a04)';
  }
  return { percent, gradient };
}

function getStreamingFallbackMessage(answerText, hasReasoning = false) {
  const trimmed = typeof answerText === 'string' ? answerText.trim() : '';
  if (trimmed.length > 0) {
    return null;
  }
  if (hasReasoning) {
    return 'Stream ended after reasoning but no final answer was returned. Please try again.';
  }
  return 'Stream ended with no answer received. Please try again.';
}

function removeReasoningBubbles(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  container.querySelectorAll('.reasoning-content, .chat-reasoning-bubble').forEach((el) => {
    el.remove();
  });
}

function formatThreadModelLabel(project = {}) {
  if (project && typeof project.modelDisplayName === 'string' && project.modelDisplayName.trim()) {
    return `Model: ${project.modelDisplayName.trim()}`;
  }
  if (project && typeof project.model === 'string' && project.model.trim()) {
    return `Model: ${project.model.trim()}`;
  }
  return 'Model: Default';
}

function buildSummarizerMessages(previousSummary, historyToSummarize) {
  const systemPrompt = [
    'You are a concise summarizer.',
    'Capture user goals, decisions, constraints, key facts, and open questions.',
    'Avoid long quotes and verbosity; keep only durable context.'
  ].join(' ');

  const messages = [{ role: 'system', content: systemPrompt }];
  if (previousSummary) {
    messages.push({ role: 'system', content: `Summary so far:\n${previousSummary}` });
  }
  if (Array.isArray(historyToSummarize)) {
    messages.push(...historyToSummarize);
  }
  return messages;
}

const sharedUtilsStreaming = {
  renderStreamingText,
  extractReasoningFromStreamChunk,
  getTokenBarStyle,
  getStreamingFallbackMessage,
  removeReasoningBubbles,
  formatThreadModelLabel,
  buildSummarizerMessages
};

if (typeof window !== 'undefined') {
  window.sharedUtilsStreaming = sharedUtilsStreaming;
}

if (typeof globalThis !== 'undefined') {
  globalThis.sharedUtilsStreaming = sharedUtilsStreaming;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = sharedUtilsStreaming;
}
