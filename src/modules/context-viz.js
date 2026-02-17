// Context Memory Visualization Component
// Displays conversation context as an interactive timeline

function buildHtmlNodes(html) {
  const safeHtml = typeof html === "string" ? html : "";
  if (typeof document === "undefined") return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    return Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  }
  const textNode = document.createTextNode(safeHtml);
  return [textNode];
}

function setSafeHtml(element, html) {
  if (!element) return;
  if (typeof window !== "undefined" && window.safeHtml && typeof window.safeHtml.setSanitizedHtml === "function") {
    window.safeHtml.setSanitizedHtml(element, html || "");
    return;
  }
  element.replaceChildren(...buildHtmlNodes(html));
}

class ContextVisualization {
  constructor(container) {
    this.container = container;
    this.maxMessages = 16; // From constants.js MAX_CONTEXT_MESSAGES
    this.messageHistory = [];
  }

  /**
   * Updates the visualization with current context
   * @param {number} contextSize - Number of messages in context
   * @param {string} latestRole - Role of latest message ('user' or 'assistant')
   */
  update(contextSize, latestRole = 'user') {
    if (!this.container) return;

    const numQA = Math.floor(contextSize / 2);

    // Build timeline HTML
    const html = this.buildTimeline(contextSize, numQA, latestRole);

    // Update container
    setSafeHtml(this.container, html);

    // Add click handler to show details
    this.attachClickHandler();
  }

  buildTimeline(contextSize, numQA, latestRole) {
    // Always show the brain icon, gray it out if no context
    const hasContext = contextSize > 2;
    const activeClass = hasContext ? 'active' : '';

    if (!hasContext) {
      return `
        <div class="context-viz-icon" title="No conversation context yet">
          🧠
        </div>
      `;
    }

    // Calculate fill percentage for warning
    const fillPercentage = (contextSize / this.maxMessages) * 100;
    const isNearLimit = fillPercentage > 75;
    const badgeClass = isNearLimit ? 'warning' : '';

    return `
      <div class="context-viz-icon ${activeClass}" title="Click to view ${numQA} Q&A conversation history">
        🧠
        <span class="context-badge ${badgeClass}">${numQA}</span>
      </div>
    `;
  }

  attachClickHandler() {
    const vizIcon = this.container.querySelector('.context-viz-icon.active');
    if (vizIcon) {
      vizIcon.addEventListener('click', () => {
        this.showTimelineModal();
      });
    }
  }

  async showTimelineModal() {
    // Get conversation context from background
    const tabId = await this.getCurrentTabId();
    const response = await chrome.runtime.sendMessage({
      type: 'get_context',
      tabId: tabId
    });

    if (!response || !response.context) {
      this.showError('Unable to load conversation context');
      return;
    }

    this.renderTimelineModal(response.context);
  }

  async getCurrentTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id;
  }

  renderTimelineModal(messages) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'context-timeline-overlay';
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
      animation: fadeIn 0.2s ease;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'context-timeline-modal';
    modal.style.cssText = `
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-primary);
      border-radius: 8px;
      max-width: 600px;
      width: 90%;
      max-height: 70vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    setSafeHtml(header, `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">🧠</span>
        <span style="font-size: 14px; font-weight: 600; color: var(--color-text);">Conversation Timeline</span>
      </div>
      <button class="context-timeline-close" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 24px;">×</button>
    `);

    // Timeline content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    `;

    // Build timeline
    const timeline = this.buildTimelineContent(messages);
    setSafeHtml(content, timeline);

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const closeBtn = header.querySelector('.context-timeline-close');
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  buildTimelineContent(messages) {
    if (!messages || messages.length === 0) {
      return '<div style="text-align: center; color: var(--color-text-muted); padding: 40px;">No messages in context</div>';
    }

    let html = '<div class="timeline">';

    messages.forEach((msg, index) => {
      const isUser = msg.role === 'user';
      const icon = isUser ? '👤' : '🤖';
      const color = isUser ? 'var(--color-primary)' : 'var(--color-success)';
      const label = isUser ? 'You' : 'Assistant';
      const preview = this.truncateText(msg.content, 150);
      const position = index + 1;

      html += `
        <div class="timeline-item" style="display: flex; gap: 12px; margin-bottom: 20px; position: relative;">
          <div style="flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: ${color}20; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 18px; position: relative; z-index: 1;">
            ${icon}
          </div>
          <div style="flex: 1; padding-bottom: 12px; ${index < messages.length - 1 ? 'border-left: 2px solid var(--color-border); margin-left: 19px; padding-left: 20px;' : ''}">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 600; color: ${color};">${label}</span>
              <span style="font-size: 11px; color: var(--color-text-muted);">#${position}</span>
            </div>
            <div style="font-size: 12px; color: var(--color-text-muted); line-height: 1.5;">
              ${escapeHtml(preview)}
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Add memory indicator
    const fillPercentage = (messages.length / this.maxMessages) * 100;
    const isNearLimit = fillPercentage > 75;

    html += `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; color: var(--color-text-muted);">Memory Usage</span>
          <span style="font-size: 12px; color: ${isNearLimit ? 'var(--color-warning)' : 'var(--color-success)'};">${messages.length}/${this.maxMessages} messages</span>
        </div>
        <div style="height: 6px; background: var(--color-bg-tertiary); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; background: ${isNearLimit ? 'var(--color-warning)' : 'var(--color-success)'}; width: ${fillPercentage}%; transition: width 0.3s ease;"></div>
        </div>
        ${isNearLimit ? '<div style="margin-top: 8px; font-size: 11px; color: var(--color-warning);">⚠️ Context is near capacity. Older messages will be removed soon.</div>' : ''}
      </div>
    `;

    return html;
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  showError(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'error');
    } else {
      alert(message);
    }
  }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .context-viz-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    transition: all 0.2s ease;
    position: absolute;
    right: 16px;
    top: 0;
    opacity: 0.4;
  }

  .context-viz-icon.active {
    opacity: 1;
    cursor: pointer;
    border-color: var(--color-primary);
  }

  .context-viz-icon.active:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-link);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  }

  .context-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--color-primary);
    color: white;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 4px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
    line-height: 1;
  }

  .context-badge.warning {
    background: var(--color-warning);
  }
`;
document.head.appendChild(style);

