// toast.js - Toast notification system

/**
 * Toast notification utility for visual feedback
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
 * @param {number|object} durationOrOptions - Duration in ms (default: 3000) or options object
 * @param {number} durationOrOptions.duration - Duration in milliseconds
 * @param {object} durationOrOptions.action - Action button config
 * @param {string} durationOrOptions.action.label - Button text
 * @param {function} durationOrOptions.action.onClick - Button click handler
 */
function showToast(message, type = 'info', durationOrOptions = 3000) {
  // Parse options - support both legacy (number) and new (object) format
  let duration = 3000;
  let action = null;

  if (typeof durationOrOptions === 'number') {
    duration = durationOrOptions;
  } else if (typeof durationOrOptions === 'object' && durationOrOptions !== null) {
    duration = durationOrOptions.duration ?? 3000;
    action = durationOrOptions.action ?? null;
  }
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  // Colors based on type (use CSS variables with fallbacks)
  const colors = {
    success: { bg: 'var(--color-success, #10b981)', border: '#059669' },
    error: { bg: 'var(--color-error, #ef4444)', border: '#dc2626' },
    info: { bg: 'var(--color-primary, #3b82f6)', border: '#2563eb' },
    warning: { bg: 'var(--color-warning, #f59e0b)', border: '#d97706' }
  };

  const color = colors[type] || colors.info;

  // Build action button HTML if action provided
  const actionHtml = action ? `
    <button class="toast-action" style="
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      padding: 2px 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: underline;
      opacity: 0.95;
      transition: opacity 0.2s;
      margin-left: 4px;
    ">${escapeToastHtml(action.label)}</button>
  ` : '';

  toast.innerHTML = `
    <div style="
      background: ${color.bg};
      border-left: 4px solid ${color.border};
      color: white;
      padding: 12px 20px 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 250px;
      max-width: 400px;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      font-size: 14px;
      font-weight: 500;
    ">
      <span style="font-size: 18px; font-weight: bold;">${icons[type]}</span>
      <span style="flex: 1;">${escapeToastHtml(message)}</span>
      ${actionHtml}
      <button class="toast-close" style="
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 18px;
        line-height: 1;
        opacity: 0.8;
        transition: opacity 0.2s;
      ">×</button>
    </div>
  `;

  // Add keyframe animation if not exists
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
      .toast-close:hover {
        opacity: 1 !important;
      }
      .toast-action:hover {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Action button handler
  if (action && action.onClick) {
    const actionBtn = toast.querySelector('.toast-action');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        action.onClick();
        removeToast(toast);
      });
    }
  }

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }

  return toast;
}

/**
 * Remove toast with animation
 */
function removeToast(toast) {
  // Guard against already-removed toasts
  if (!toast || !toast.parentNode) {
    return;
  }

  toast.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }

    // Remove container if empty
    const container = document.getElementById('toast-container');
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, 300);
}

/**
 * Escape HTML in toast messages
 */
function escapeToastHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Convenience methods
const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  info: (message, duration) => showToast(message, 'info', duration),
  warning: (message, duration) => showToast(message, 'warning', duration)
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showToast, toast };
}
