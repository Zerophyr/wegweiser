// theme.js - Custom theme support (light/dark mode)

const THEMES = {
  dark: {
    name: 'Dark',
    colors: {
      bg: '#0f0f0f',
      bgSecondary: '#18181b',
      bgTertiary: '#27272a',
      bgElevated: '#111113',
      text: '#e4e4e7',
      textSecondary: '#d4d4d8',
      textMuted: '#a1a1aa',
      textOnPrimary: '#ffffff',
      border: '#27272a',
      borderHover: '#3f3f46',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primarySubtle: 'rgba(59, 130, 246, 0.1)',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#0ea5e9',
      accent: '#8b5cf6',
      link: '#60a5fa',
      linkHover: '#93c5fd',
      topic1: '#60a5fa',
      topic2: '#34d399',
      topic3: '#fbbf24',
      topic4: '#f472b6',
      topic5: '#a78bfa',
      topic6: '#22d3ee',
      shadow: 'rgba(0, 0, 0, 0.4)',
      scrollbar: '#27272a',
      scrollbarHover: '#3f3f46'
    }
  },
  light: {
    name: 'Light',
    colors: {
      bg: '#ffffff',
      bgSecondary: '#f9fafb',
      bgTertiary: '#f3f4f6',
      bgElevated: '#ffffff',
      text: '#1f2937',
      textSecondary: '#374151',
      textMuted: '#6b7280',
      textOnPrimary: '#ffffff',
      border: '#e5e7eb',
      borderHover: '#d1d5db',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primarySubtle: 'rgba(59, 130, 246, 0.08)',
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#0284c7',
      accent: '#7c3aed',
      link: '#2563eb',
      linkHover: '#1d4ed8',
      topic1: '#2563eb',
      topic2: '#059669',
      topic3: '#d97706',
      topic4: '#db2777',
      topic5: '#7c3aed',
      topic6: '#0891b2',
      shadow: 'rgba(0, 0, 0, 0.1)',
      scrollbar: '#e5e7eb',
      scrollbarHover: '#d1d5db'
    }
  }
};

/**
 * Convert camelCase to kebab-case (e.g. bgSecondary -> bg-secondary)
 */
function camelToKebab(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();
}

/**
 * Apply theme to current page
 * @param {string} themeName - Theme name ('dark', 'light')
 */
function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.dark;
  const root = document.documentElement;

  // Set CSS variables (convert camelCase keys to kebab-case)
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${camelToKebab(key)}`, value);
  });

  // Add theme class to body
  document.body.className = `theme-${themeName}`;

  // Store current theme
  chrome.storage.local.set({ or_theme: themeName });
}

/**
 * Load saved theme or default to dark
 */
async function loadTheme() {
  try {
    const result = await chrome.storage.local.get(['or_theme']);
    const themeName = result.or_theme || 'dark';
    applyTheme(themeName);
    return themeName;
  } catch (e) {
    console.error('Error loading theme:', e);
    applyTheme('dark');
    return 'dark';
  }
}

/**
 * Initialize theme system
 */
function initTheme() {
  // Add base CSS if not exists
  if (!document.getElementById('theme-base-styles')) {
    const style = document.createElement('style');
    style.id = 'theme-base-styles';
    style.textContent = `
      :root {
        --color-bg: #0f0f0f;
        --color-bg-secondary: #18181b;
        --color-bg-tertiary: #27272a;
        --color-bg-elevated: #111113;
        --color-text: #e4e4e7;
        --color-text-secondary: #d4d4d8;
        --color-text-muted: #a1a1aa;
        --color-text-on-primary: #ffffff;
        --color-border: #27272a;
        --color-border-hover: #3f3f46;
        --color-primary: #3b82f6;
        --color-primary-hover: #2563eb;
        --color-primary-subtle: rgba(59, 130, 246, 0.1);
        --color-success: #10b981;
        --color-error: #ef4444;
        --color-warning: #f59e0b;
        --color-info: #0ea5e9;
        --color-accent: #8b5cf6;
        --color-link: #60a5fa;
        --color-link-hover: #93c5fd;
        --color-topic-1: #60a5fa;
        --color-topic-2: #34d399;
        --color-topic-3: #fbbf24;
        --color-topic-4: #f472b6;
        --color-topic-5: #a78bfa;
        --color-topic-6: #22d3ee;
        --color-shadow: rgba(0, 0, 0, 0.4);
        --color-scrollbar: #27272a;
        --color-scrollbar-hover: #3f3f46;
      }

      body {
        background: var(--color-bg);
        color: var(--color-text);
        transition: background-color 0.3s ease, color 0.3s ease;
      }

      /* Update existing elements to use CSS variables */
      .container {
        background: var(--color-bg);
      }

      input[type="text"],
      select,
      textarea {
        background: var(--color-bg-secondary) !important;
        color: var(--color-text) !important;
        border-color: var(--color-border) !important;
      }

      input[type="text"]:focus,
      select:focus,
      textarea:focus {
        border-color: var(--color-primary) !important;
      }

      button:not(.history-close-btn):not(.toast-close) {
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%) !important;
      }

      .form-group label {
        color: var(--color-text-secondary);
      }

      .history-item {
        background: var(--color-bg-secondary) !important;
        border-color: var(--color-border) !important;
      }

      .history-detail-card {
        background: var(--color-bg-secondary) !important;
        border-color: var(--color-border) !important;
      }

      /* Light theme specific adjustments */
      body.theme-light {
        --color-bg: #ffffff;
        --color-bg-secondary: #f9fafb;
        --color-bg-tertiary: #f3f4f6;
        --color-bg-elevated: #ffffff;
        --color-text: #1f2937;
        --color-text-secondary: #374151;
        --color-text-muted: #6b7280;
        --color-text-on-primary: #ffffff;
        --color-border: #e5e7eb;
        --color-border-hover: #d1d5db;
        --color-primary-subtle: rgba(59, 130, 246, 0.08);
        --color-success: #059669;
        --color-error: #dc2626;
        --color-warning: #d97706;
        --color-info: #0284c7;
        --color-accent: #7c3aed;
        --color-link: #2563eb;
        --color-link-hover: #1d4ed8;
        --color-topic-1: #2563eb;
        --color-topic-2: #059669;
        --color-topic-3: #d97706;
        --color-topic-4: #db2777;
        --color-topic-5: #7c3aed;
        --color-topic-6: #0891b2;
        --color-shadow: rgba(0, 0, 0, 0.1);
        --color-scrollbar: #e5e7eb;
        --color-scrollbar-hover: #d1d5db;
      }

      body.theme-light h1 {
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      /* Active toggle uses unique blue tint not in variable set */
      body.theme-light .toggle-btn.active {
        background: #dbeafe;
      }

      body.theme-light .toggle-btn.active svg {
        fill: var(--color-primary-hover);
      }

      /* Selected history item uses unique blue tint */
      body.theme-light .history-item.selected {
        background: #dbeafe !important;
        border-color: var(--color-primary) !important;
      }

      /* Override JS-generated inline styles for light theme */
      body.theme-light #history-detail-content div[style*="color: #71717a"] {
        color: var(--color-text-muted) !important;
      }

      body.theme-light #history-detail-content div[style*="color: #d4d4d8"] {
        color: var(--color-text) !important;
      }

      body.theme-light #history-detail-content div[style*="color: #e4e4e7"] {
        color: var(--color-text) !important;
      }

      body.theme-light #history-detail-content div[style*="background: #0f0f0f"] {
        background: var(--color-bg-secondary) !important;
        border: 1px solid var(--color-border) !important;
      }

      body.theme-light .history-preview div[style*="color: #71717a"] {
        color: var(--color-text-muted) !important;
      }

      body.theme-light .history-preview div[style*="color: #d4d4d8"] {
        color: var(--color-text) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Load saved theme
  loadTheme();
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { THEMES, applyTheme, loadTheme, initTheme, camelToKebab };
}
