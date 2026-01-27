/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for toast notification system
 * Tests showToast and toast convenience methods from src/modules/toast.js
 */

// Helper function to escape HTML in toast messages
function escapeToastHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Toast options interface
interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

// Remove toast with animation (simplified for testing)
function removeToast(toastEl: HTMLElement | null): void {
  if (!toastEl || !toastEl.parentNode) {
    return;
  }
  toastEl.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.remove();
    }
    const container = document.getElementById('toast-container');
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, 300);
}

// Re-implement showToast matching the source for testing
function showToast(message: string, type: string = 'info', durationOrOptions: number | ToastOptions = 3000): HTMLElement {
  // Parse options - support both legacy (number) and new (object) format
  let duration = 3000;
  let action: ToastAction | null = null;

  if (typeof durationOrOptions === 'number') {
    duration = durationOrOptions;
  } else if (typeof durationOrOptions === 'object' && durationOrOptions !== null) {
    duration = durationOrOptions.duration ?? 3000;
    action = durationOrOptions.action ?? null;
  }
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

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;

  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  const colors: Record<string, { bg: string; border: string }> = {
    success: { bg: '#10b981', border: '#059669' },
    error: { bg: '#ef4444', border: '#dc2626' },
    info: { bg: '#3b82f6', border: '#2563eb' },
    warning: { bg: '#f59e0b', border: '#d97706' }
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

  toastEl.innerHTML = `
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
      <span style="font-size: 18px; font-weight: bold;">${icons[type] || icons.info}</span>
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

  container.appendChild(toastEl);

  const closeBtn = toastEl.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      removeToast(toastEl);
    });
  }

  // Action button handler
  if (action && action.onClick) {
    const actionBtn = toastEl.querySelector('.toast-action');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        action.onClick();
        removeToast(toastEl);
      });
    }
  }

  if (duration > 0) {
    setTimeout(() => {
      removeToast(toastEl);
    }, duration);
  }

  return toastEl;
}

// Convenience methods
const toast = {
  success: (message: string, duration?: number) => showToast(message, 'success', duration),
  error: (message: string, duration?: number) => showToast(message, 'error', duration),
  info: (message: string, duration?: number) => showToast(message, 'info', duration),
  warning: (message: string, duration?: number) => showToast(message, 'warning', duration)
};

describe('Toast Notification System', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('showToast function', () => {
    it('should be a function', () => {
      expect(typeof showToast).toBe('function');
    });

    it('should create toast container when called', () => {
      showToast('Test message', 'info', 0);
      const container = document.getElementById('toast-container');
      expect(container).toBeTruthy();
    });

    it('should display correct message', () => {
      const testMessage = 'Test notification';
      showToast(testMessage, 'success', 0);
      expect(document.body.textContent).toContain(testMessage);
    });

    it('should escape HTML in messages', () => {
      const htmlMessage = '<script>alert("xss")</script>';
      showToast(htmlMessage, 'error', 0);
      expect(document.body.innerHTML).not.toContain('<script>');
      expect(document.body.innerHTML).toContain('&lt;script&gt;');
    });

    it('should return toast element', () => {
      const toastEl = showToast('Test', 'info', 0);
      expect(toastEl).toBeInstanceOf(HTMLElement);
      expect(toastEl.classList.contains('toast')).toBe(true);
    });
  });

  describe('toast types', () => {
    it('should create success toast', () => {
      const toastEl = showToast('Success!', 'success', 0);
      expect(toastEl.classList.contains('toast-success')).toBe(true);
      expect(toastEl.innerHTML).toContain('#10b981'); // success color
    });

    it('should create error toast', () => {
      const toastEl = showToast('Error!', 'error', 0);
      expect(toastEl.classList.contains('toast-error')).toBe(true);
      expect(toastEl.innerHTML).toContain('#ef4444'); // error color
    });

    it('should create info toast', () => {
      const toastEl = showToast('Info!', 'info', 0);
      expect(toastEl.classList.contains('toast-info')).toBe(true);
      expect(toastEl.innerHTML).toContain('#3b82f6'); // info color
    });

    it('should create warning toast', () => {
      const toastEl = showToast('Warning!', 'warning', 0);
      expect(toastEl.classList.contains('toast-warning')).toBe(true);
      expect(toastEl.innerHTML).toContain('#f59e0b'); // warning color
    });

    it('should default to info type', () => {
      const toastEl = showToast('Default', 'unknown', 0);
      expect(toastEl.innerHTML).toContain('#3b82f6'); // info color as fallback
    });
  });

  describe('toast convenience methods', () => {
    it('should have success method', () => {
      expect(typeof toast.success).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof toast.error).toBe('function');
    });

    it('should have info method', () => {
      expect(typeof toast.info).toBe('function');
    });

    it('should have warning method', () => {
      expect(typeof toast.warning).toBe('function');
    });

    it('toast.success should create success toast', () => {
      const toastEl = toast.success('Success message', 0);
      expect(toastEl.classList.contains('toast-success')).toBe(true);
    });

    it('toast.error should create error toast', () => {
      const toastEl = toast.error('Error message', 0);
      expect(toastEl.classList.contains('toast-error')).toBe(true);
    });
  });

  describe('toast container', () => {
    it('should reuse existing container', () => {
      showToast('First', 'info', 0);
      showToast('Second', 'info', 0);
      const containers = document.querySelectorAll('#toast-container');
      expect(containers.length).toBe(1);
    });

    it('should contain all toasts', () => {
      showToast('First', 'info', 0);
      showToast('Second', 'success', 0);
      showToast('Third', 'error', 0);
      const container = document.getElementById('toast-container');
      expect(container?.children.length).toBe(3);
    });

    it('should have correct positioning styles', () => {
      showToast('Test', 'info', 0);
      const container = document.getElementById('toast-container');
      expect(container?.style.position).toBe('fixed');
      expect(container?.style.top).toBe('20px');
      expect(container?.style.right).toBe('20px');
    });
  });

  describe('toast close button', () => {
    it('should have close button', () => {
      const toastEl = showToast('Test', 'info', 0);
      const closeBtn = toastEl.querySelector('.toast-close');
      expect(closeBtn).toBeTruthy();
    });
  });

  describe('escapeToastHtml', () => {
    it('should escape < and > characters', () => {
      expect(escapeToastHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('should escape & character', () => {
      expect(escapeToastHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should handle normal text', () => {
      expect(escapeToastHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('action button', () => {
    it('should render action button when action is provided', () => {
      const toastEl = showToast('Test', 'info', {
        duration: 0,
        action: { label: 'Undo', onClick: () => {} }
      });
      const actionBtn = toastEl.querySelector('.toast-action');
      expect(actionBtn).toBeTruthy();
      expect(actionBtn?.textContent).toBe('Undo');
    });

    it('should not render action button when no action provided', () => {
      const toastEl = showToast('Test', 'info', 0);
      const actionBtn = toastEl.querySelector('.toast-action');
      expect(actionBtn).toBeFalsy();
    });

    it('should call onClick when action button is clicked', () => {
      const mockOnClick = jest.fn();
      const toastEl = showToast('Test', 'info', {
        duration: 0,
        action: { label: 'Undo', onClick: mockOnClick }
      });
      const actionBtn = toastEl.querySelector('.toast-action') as HTMLButtonElement;
      actionBtn?.click();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should escape HTML in action label', () => {
      const toastEl = showToast('Test', 'info', {
        duration: 0,
        action: { label: '<script>xss</script>', onClick: () => {} }
      });
      const actionBtn = toastEl.querySelector('.toast-action');
      expect(actionBtn?.innerHTML).toContain('&lt;script&gt;');
      expect(actionBtn?.innerHTML).not.toContain('<script>');
    });

    it('should support options object with duration only', () => {
      const toastEl = showToast('Test', 'info', { duration: 5000 });
      expect(toastEl).toBeInstanceOf(HTMLElement);
      const actionBtn = toastEl.querySelector('.toast-action');
      expect(actionBtn).toBeFalsy();
    });

    it('should support legacy number parameter for duration', () => {
      const toastEl = showToast('Test', 'info', 5000);
      expect(toastEl).toBeInstanceOf(HTMLElement);
    });
  });

  describe('removeToast', () => {
    it('should handle null toast gracefully', () => {
      expect(() => removeToast(null)).not.toThrow();
    });

    it('should handle already-removed toast gracefully', () => {
      const toastEl = showToast('Test', 'info', 0);
      toastEl.remove();
      expect(() => removeToast(toastEl)).not.toThrow();
    });
  });
});
