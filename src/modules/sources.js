// sources.js - Source citation and display system

function buildHtmlNodes(html) {
  const safeHtml = typeof html === "string" ? html : "";
  if (typeof document === "undefined") return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    return Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  }
  return [document.createTextNode(safeHtml)];
}

function setSafeHtml(element, html) {
  if (!element) return;
  if (typeof window !== 'undefined' && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === 'function') {
    window.safeHtml.setSanitizedHtml(element, html || '');
    return;
  }
  element.replaceChildren(...buildHtmlNodes(html));
}


const sourcesModalModule = (typeof globalThis !== 'undefined' && globalThis.sourcesModalUtils)
  || (typeof module !== 'undefined' && module.exports ? require('./sources-modal-utils.js') : null)
  || {};

const {
  showSourcesModal: showSourcesModalFromModal = () => {}
} = sourcesModalModule;


/**
 * Extract source references like [1], [2] from text and map to URLs
 * @param {string} text - Text to extract sources from
 * @returns {Object} Object containing sources array and processed text
 */
function extractSources(text) {
  if (!text) return { sources: [], cleanText: text };

  // Find all [number] references in the text
  const numberRefRegex = /\[(\d+)\]/g;
  const numberRefs = [];
  let match;
  while ((match = numberRefRegex.exec(text)) !== null) {
    const number = parseInt(match[1]);
    if (!numberRefs.includes(number)) {
      numberRefs.push(number);
    }
  }

  // Extract all URLs from the text
  const urlRegex = /(https?:\/\/[^\s<>")\]]+)/g;
  const urls = text.match(urlRegex) || [];
  const uniqueUrls = [...new Set(urls)];

  // Create sources array - match URLs to numbered references
  const sources = uniqueUrls.map((url, index) => {
    // Try to find associated number reference
    // If there are numbered refs, use them; otherwise use sequential numbering
    const number = numberRefs[index] || (index + 1);

    // Try to extract title from markdown link format [title](url)
    const markdownLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
    const linkMatch = text.match(markdownLinkRegex);

    let title = '';
    if (linkMatch && linkMatch[0]) {
      const titleMatch = linkMatch[0].match(/\[([^\]]+)\]/);
      title = titleMatch ? titleMatch[1] : '';
    }

    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (e) {
      domain = url;
    }

    // If no title found, use domain name
    if (!title) {
      title = domain || url;
    }

    return {
      url,
      title,
      domain,
      number,
      id: `source-${number}`
    };
  });

  // Sort sources by number
  sources.sort((a, b) => a.number - b.number);

  // Remove URLs from text (keep markdown link titles, remove standalone URLs)
  let cleanText = text;

  // First, remove markdown links but keep the title
  sources.forEach((source) => {
    const markdownLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${source.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
    cleanText = cleanText.replace(markdownLinkRegex, '$1');
  });

  // Remove all standalone URLs (any URL pattern)
  // This catches URLs that might not have been in the sources array
  const allUrlRegex = /https?:\/\/[^\s<>")\]]+/g;
  cleanText = cleanText.replace(allUrlRegex, '');

  // Clean up artifacts left by URL removal
  // Remove empty parentheses ()
  cleanText = cleanText.replace(/\(\s*\)/g, '');
  // Remove empty brackets []
  cleanText = cleanText.replace(/\[\s*\]/g, '');
  // Remove "Source:" or "Sources:" followed by nothing meaningful
  cleanText = cleanText.replace(/Sources?:\s*(?=\n|$)/gi, '');
  // Remove lines that are just dashes or bullets with nothing after
  cleanText = cleanText.replace(/^[\s]*[-•]\s*$/gm, '');
  // Clean up multiple spaces
  cleanText = cleanText.replace(/  +/g, ' ');
  // Clean up extra whitespace and empty lines
  cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return { sources, cleanText };
}

/**
 * Get favicon URL for a domain
 * @param {string} url - Full URL
 * @returns {string} Favicon URL
 */
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (e) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="12" font-size="12">🔗</text></svg>';
  }
}

/**
 * Get unique domains from sources
 * @param {Array} sources - Array of source objects
 * @returns {Array} Array of unique domain objects
 */
function getUniqueDomains(sources) {
  const domainMap = new Map();

  sources.forEach(source => {
    try {
      const url = new URL(source.url);
      const domain = url.hostname.replace('www.', '');

      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain,
          favicon: getFaviconUrl(source.url),
          sources: []
        });
      }

      domainMap.get(domain).sources.push(source);
    } catch (e) {
      console.error('Invalid URL:', source.url);
    }
  });

  return Array.from(domainMap.values());
}

/**
 * Make [number] references in text clickable
 * @param {HTMLElement} answerContent - Answer content element
 * @param {Array} sources - Array of source objects
 */
function makeSourceReferencesClickable(answerContent, sources) {
  if (!answerContent || !sources || sources.length === 0) return;

  const html = answerContent.innerHTML;
  let newHtml = html;
  const escape = (value) => {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    const text = typeof value === 'string' ? value : '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Find all [number] patterns and make them clickable
  sources.forEach(source => {
    const refPattern = new RegExp(`\\[${source.number}\\]`, 'g');
    const label = source.domain || source.title || source.url;
    const safeId = escape(source.id || '');
    const safeLabel = escape(label || '');
    const replacement = `<span class="source-chip" data-source-id="${safeId}" title="${safeLabel}">${safeLabel}</span>`;
    newHtml = newHtml.replace(refPattern, replacement);
  });

  setSafeHtml(answerContent, newHtml);

  // Add click handlers to the references
  const chips = answerContent.querySelectorAll('.source-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const sourceId = chip.getAttribute('data-source-id');
      const uniqueDomains = getUniqueDomains(sources);
      showSourcesModalFromModal(sources, uniqueDomains, sourceId);
    });
  });
}

/**
 * Create sources indicator element (compact list at bottom)
 * @param {Array} sources - Array of source objects
 * @param {HTMLElement} answerElement - Answer element to attach to
 */
function createSourcesIndicator(sources, answerElement) {
  if (!sources || sources.length === 0) return null;

  // Store sources data on the answer element for later use
  answerElement.setAttribute('data-sources', JSON.stringify(sources));

  const uniqueDomains = getUniqueDomains(sources);

  // Create sources container
  const sourcesContainer = document.createElement('div');
  sourcesContainer.className = 'sources-indicator';
  sourcesContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--color-bg-secondary, #18181b);
    border: 1px solid var(--color-border, #27272a);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    width: fit-content;
  `;

  // Favicon stack (show up to 5 unique domains)
  const faviconStack = document.createElement('div');
  faviconStack.style.cssText = `
    display: flex;
    align-items: center;
    margin-right: 4px;
  `;

  const maxFavicons = 5;
  uniqueDomains.slice(0, maxFavicons).forEach((domain, index) => {
    const favicon = document.createElement('img');
    favicon.src = domain.favicon;
    favicon.alt = domain.domain;
    favicon.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid var(--color-border, #27272a);
      background: white;
      margin-left: ${index > 0 ? '-8px' : '0'};
      position: relative;
      z-index: ${maxFavicons - index};
    `;
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="%23888"><circle cx="8" cy="8" r="8"/></svg>';
    };
    faviconStack.appendChild(favicon);
  });

  sourcesContainer.appendChild(faviconStack);

  // Source count
  const countText = document.createElement('span');
  countText.textContent = `${sources.length} source${sources.length !== 1 ? 's' : ''}`;
  countText.style.cssText = `
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary, #d4d4d8);
  `;
  sourcesContainer.appendChild(countText);

  // Hover effect
  sourcesContainer.addEventListener('mouseenter', () => {
    sourcesContainer.style.background = 'var(--color-bg-tertiary, #27272a)';
    sourcesContainer.style.borderColor = 'var(--color-primary, #3b82f6)';
  });

  sourcesContainer.addEventListener('mouseleave', () => {
    sourcesContainer.style.background = 'var(--color-bg-secondary, #18181b)';
    sourcesContainer.style.borderColor = 'var(--color-border, #27272a)';
  });

  // Click to show sources modal
  sourcesContainer.addEventListener('click', () => {
    showSourcesModalFromModal(sources, uniqueDomains);
  });

  return sourcesContainer;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractSources, createSourcesIndicator, showSourcesModal: showSourcesModalFromModal, makeSourceReferencesClickable };
}

