// markdown.js - Lightweight markdown renderer for AI responses
// Uses DOMPurify for XSS protection

/**
 * Escape HTML entities in text that should not contain HTML
 * Used for code blocks where we want to show literal < > & characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeCodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * DOMPurify configuration for safe markdown HTML
 * Allows markdown-generated elements while blocking XSS
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i',
    'code', 'pre',
    'blockquote',
    'a',
    'span', 'div'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class'
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],  // Allow target="_blank" on links
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'textarea', 'button'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur']
};

function sanitizeWithConfiguredPolicy(html) {
  if (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.sanitizeHtml === 'function') {
    return window.safeHtml.sanitizeHtml(html, DOMPURIFY_CONFIG);
  }
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
  }
  return html;
}

const TOPIC_COLOR_COUNT = 6;

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function applyTopicClasses(html) {
  if (typeof document === 'undefined') return html;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('h1, h2, h3').forEach((heading) => {
    const text = heading.textContent || '';
    const colorIndex = (hashText(text) % TOPIC_COLOR_COUNT) + 1;
    heading.classList.add('topic-heading', `topic-color-${colorIndex}`);
  });

  return wrapper.innerHTML;
}

/**
 * Convert markdown to HTML
 * Supports: headers, bold, italic, code blocks, inline code, links, lists, blockquotes
 * @param {string} markdown - Markdown text
 * @returns {string} Sanitized HTML string
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown;

  // Store code blocks temporarily to prevent markdown processing inside them
  // Use null character placeholders to avoid matching markdown patterns
  const codeBlocks = [];
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'plaintext';
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
    codeBlocks.push(`<pre class="code-block"><code class="language-${escapeCodeHtml(language)}">${escapeCodeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  // Store inline code temporarily
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `\x00INLINECODE${inlineCodes.length}\x00`;
    inlineCodes.push(`<code class="inline-code">${escapeCodeHtml(code)}</code>`);
    return placeholder;
  });

  // Headers (# to ######) - must be at start of line
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rules (--- or ***) - must be on own line, before bold/italic processing
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');

  // Lists - must be processed before italic to avoid * being matched as emphasis
  // Unordered lists (- or *) - must be at start of line (with optional whitespace)
  html = html.replace(/^[\t ]*[-*]\s+(.+)$/gm, '<li>$1</li>');

  // Ordered lists (1. 2. etc) - must be at start of line
  html = html.replace(/^[\t ]*\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Bold (**text** or __text__) - must come before italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Blockquotes (> text) - must be at start of line
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Links [text](url) - validate URL protocol
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Escape the URL and text for safety
        const safeUrl = url.replace(/"/g, '&quot;');
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${text}</a>`;
      }
    } catch (e) {
      // Invalid URL, return original text
    }
    return match;
  });

  // Wrap consecutive <li> elements in <ul> or <ol>
  // This is a simplified approach - wraps all consecutive li in ul
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, '<ul>$&</ul>');

  // Line breaks (preserve double newlines as paragraphs)
  html = html.replace(/\n\n+/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs and fix paragraph nesting issues
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(\s*<(?:h[1-6]|ul|ol|blockquote|pre|hr))/g, '$1');
  html = html.replace(/(<\/(?:h[1-6]|ul|ol|blockquote|pre|hr)>\s*)<\/p>/g, '$1');

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00CODEBLOCK${i}\x00`, block);
  });

  // Restore inline code
  inlineCodes.forEach((code, i) => {
    html = html.replace(`\x00INLINECODE${i}\x00`, code);
  });

  // Sanitize generated markdown HTML before returning it
  html = sanitizeWithConfiguredPolicy(html);

  return applyTopicClasses(html);
}

/**
 * Apply markdown styling to answer content
 * Can be used in two ways:
 * 1. applyMarkdownStyles(element, markdown) - Modifies element innerHTML
 * 2. applyMarkdownStyles(markdown) - Returns HTML string
 * @param {HTMLElement|string} elementOrMarkdown - Element to modify OR markdown string
 * @param {string} [markdown] - Markdown text (optional if first param is string)
 * @returns {string|undefined} HTML string if called with one param, undefined otherwise
 */
function applyMarkdownStyles(elementOrMarkdown, markdown) {
  // Single parameter: return HTML string
  if (arguments.length === 1 && typeof elementOrMarkdown === 'string') {
    return markdownToHtml(elementOrMarkdown);
  }

  // Two parameters: modify element (legacy API)
  const element = elementOrMarkdown;
  if (!element) return;

  // Convert markdown to HTML (already sanitized by markdownToHtml)
  const html = markdownToHtml(markdown);
  if (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === 'function') {
    window.safeHtml.setSanitizedHtml(element, html);
  } else {
    element.innerHTML = html;
  }

  // Add CSS for markdown elements if not exists
  if (!document.getElementById('markdown-styles')) {
    const style = document.createElement('style');
    style.id = 'markdown-styles';
    style.textContent = `
      /* Markdown styles */
      .answer-content h1 {
        font-size: 1.8em;
        font-weight: 700;
        margin: 16px 0 12px 0;
        color: var(--color-text);
        border-bottom: 2px solid var(--color-primary);
        padding-bottom: 8px;
      }
      .answer-content h2 {
        font-size: 1.5em;
        font-weight: 700;
        margin: 14px 0 10px 0;
        color: var(--color-text);
      }
      .answer-content h3 {
        font-size: 1.3em;
        font-weight: 600;
        margin: 12px 0 8px 0;
        color: var(--color-text-secondary);
      }
      .answer-content h4,
      .answer-content h5,
      .answer-content h6 {
        font-size: 1.1em;
        font-weight: 600;
        margin: 10px 0 6px 0;
        color: var(--color-text-secondary);
      }
      .answer-content p {
        margin: 8px 0;
        line-height: 1.6;
        color: var(--color-text);
      }
      .answer-content strong {
        font-weight: 700;
        color: var(--color-text);
      }
      .answer-content em {
        font-style: italic;
        color: var(--color-text-secondary);
      }
      .answer-content code.inline-code {
        background: var(--color-bg-tertiary);
        color: var(--color-topic-4);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
      }
      .answer-content pre.code-block {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
        margin: 12px 0;
      }
      .answer-content pre.code-block code {
        color: var(--color-text);
        font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
        line-height: 1.5;
      }
      .answer-content ul,
      .answer-content ol {
        margin: 8px 0;
        padding-left: 24px;
      }
      .answer-content li {
        margin: 4px 0;
        line-height: 1.6;
        color: var(--color-text);
      }
      .answer-content blockquote {
        border-left: 4px solid var(--color-primary);
        padding-left: 16px;
        margin: 12px 0;
        color: var(--color-text-muted);
        font-style: italic;
      }
      .answer-content hr {
        border: none;
        border-top: 1px solid var(--color-border);
        margin: 16px 0;
      }
      .answer-content a.md-link {
        color: var(--color-primary);
        text-decoration: underline;
        transition: color 0.2s;
      }
      .answer-content a.md-link:hover {
        color: var(--color-link);
      }
    `;
    document.head.appendChild(style);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { markdownToHtml, applyMarkdownStyles, escapeCodeHtml, DOMPURIFY_CONFIG, sanitizeWithConfiguredPolicy };
}
