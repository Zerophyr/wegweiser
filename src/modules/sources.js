// sources.js - Source citation and display system

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

    // If no title found, use domain name
    if (!title) {
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        title = domain;
      } catch (e) {
        title = url;
      }
    }

    return {
      url,
      title,
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

  // Find all [number] patterns and make them clickable
  sources.forEach(source => {
    const refPattern = new RegExp(`\\[${source.number}\\]`, 'g');
    const replacement = `<span class="source-ref-link" data-source-id="${source.id}" style="cursor: pointer; color: var(--color-primary, #3b82f6); font-weight: 600; text-decoration: underline; text-decoration-style: dotted;">[${source.number}]</span>`;
    newHtml = newHtml.replace(refPattern, replacement);
  });

  answerContent.innerHTML = newHtml;

  // Add click handlers to the references
  const refLinks = answerContent.querySelectorAll('.source-ref-link');
  refLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const sourceId = link.getAttribute('data-source-id');
      const uniqueDomains = getUniqueDomains(sources);
      showSourcesModal(sources, uniqueDomains, sourceId);
    });

    // Hover effect
    link.addEventListener('mouseenter', () => {
      link.style.textDecoration = 'underline';
      link.style.textDecorationStyle = 'solid';
      link.style.transform = 'scale(1.1)';
      link.style.display = 'inline-block';
    });

    link.addEventListener('mouseleave', () => {
      link.style.textDecoration = 'underline';
      link.style.textDecorationStyle = 'dotted';
      link.style.transform = 'scale(1)';
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
    showSourcesModal(sources, uniqueDomains);
  });

  return sourcesContainer;
}

/**
 * Show sources modal with all citations
 * @param {Array} sources - Array of source objects
 * @param {Array} uniqueDomains - Array of unique domain objects
 * @param {string} highlightId - Optional ID of source to highlight and scroll to
 */
function showSourcesModal(sources, uniqueDomains, highlightId = null) {
  // Remove existing modal if any
  const existing = document.getElementById('sources-modal');
  if (existing) existing.remove();

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'sources-modal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--color-bg, #0f0f0f);
    border: 1px solid var(--color-border, #27272a);
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
  `;

  // Modal header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border, #27272a);
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const title = document.createElement('h3');
  title.textContent = `Sources (${sources.length})`;
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text, #e4e4e7);
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: var(--color-text-muted, #71717a);
    font-size: 28px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'var(--color-bg-secondary, #18181b)';
    closeBtn.style.color = 'var(--color-text, #e4e4e7)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'var(--color-text-muted, #71717a)';
  };
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Modal body (scrollable)
  const body = document.createElement('div');
  body.id = 'sources-modal-body';
  body.style.cssText = `
    padding: 16px 24px;
    overflow-y: auto;
    flex: 1;
  `;

  // Group sources by domain
  uniqueDomains.forEach((domainGroup, index) => {
    // Domain header
    const domainHeader = document.createElement('div');
    domainHeader.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      ${index > 0 ? 'margin-top: 20px;' : ''}
    `;

    const favicon = document.createElement('img');
    favicon.src = domainGroup.favicon;
    favicon.alt = domainGroup.domain;
    favicon.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid var(--color-border, #27272a);
      background: white;
    `;
    favicon.onerror = () => {
      favicon.style.display = 'none';
    };

    const domainName = document.createElement('span');
    domainName.textContent = domainGroup.domain;
    domainName.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-secondary, #d4d4d8);
    `;

    const sourceCount = document.createElement('span');
    sourceCount.textContent = `(${domainGroup.sources.length})`;
    sourceCount.style.cssText = `
      font-size: 12px;
      color: var(--color-text-muted, #71717a);
    `;

    domainHeader.appendChild(favicon);
    domainHeader.appendChild(domainName);
    domainHeader.appendChild(sourceCount);
    body.appendChild(domainHeader);

    // Source links with numbers from answer
    domainGroup.sources.forEach(source => {
      const sourceItem = document.createElement('div');
      sourceItem.id = source.id;
      sourceItem.className = 'source-item';
      sourceItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        margin-bottom: 6px;
        margin-left: 30px;
        background: var(--color-bg-secondary, #18181b);
        border: 1px solid var(--color-border, #27272a);
        border-radius: 6px;
        transition: all 0.3s ease;
      `;

      // Number badge (uses actual number from answer text)
      const numberBadge = document.createElement('span');
      numberBadge.textContent = source.number;
      numberBadge.style.cssText = `
        flex-shrink: 0;
        min-width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary, #3b82f6);
        color: white;
        font-size: 13px;
        font-weight: 700;
        border-radius: 4px;
        font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      `;
      sourceItem.appendChild(numberBadge);

      // Source link
      const sourceLink = document.createElement('a');
      sourceLink.href = source.url;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      sourceLink.textContent = source.title;
      sourceLink.style.cssText = `
        flex: 1;
        color: var(--color-primary, #3b82f6);
        text-decoration: none;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      sourceLink.onmouseenter = () => {
        sourceLink.style.textDecoration = 'underline';
      };
      sourceLink.onmouseleave = () => {
        sourceLink.style.textDecoration = 'none';
      };
      sourceItem.appendChild(sourceLink);

      // Hover effect on entire item
      sourceItem.addEventListener('mouseenter', () => {
        sourceItem.style.background = 'var(--color-bg-tertiary, #27272a)';
        sourceItem.style.borderColor = 'var(--color-primary, #3b82f6)';
      });
      sourceItem.addEventListener('mouseleave', () => {
        if (source.id !== highlightId) {
          sourceItem.style.background = 'var(--color-bg-secondary, #18181b)';
          sourceItem.style.borderColor = 'var(--color-border, #27272a)';
        }
      });

      body.appendChild(sourceItem);
    });
  });

  modal.appendChild(body);
  overlay.appendChild(modal);

  // Add animations
  if (!document.getElementById('sources-modal-animations')) {
    const style = document.createElement('style');
    style.id = 'sources-modal-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes highlight {
        0%, 100% { background: var(--color-bg-tertiary, #27272a); }
        50% { background: var(--color-primary, #3b82f6); }
      }
    `;
    document.head.appendChild(style);
  }

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  document.body.appendChild(overlay);

  // Scroll to and highlight the specific source if provided
  if (highlightId) {
    setTimeout(() => {
      const sourceElement = document.getElementById(highlightId);
      if (sourceElement) {
        sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sourceElement.style.background = 'var(--color-bg-tertiary, #27272a)';
        sourceElement.style.borderColor = 'var(--color-primary, #3b82f6)';
        sourceElement.style.animation = 'highlight 1s ease-in-out';

        setTimeout(() => {
          sourceElement.style.animation = '';
        }, 1000);
      }
    }, 100);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractSources, createSourcesIndicator, showSourcesModal, makeSourceReferencesClickable };
}
