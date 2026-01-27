// theme.js - Custom theme support (light/dark mode)

const THEMES = {
  dark: {
    name: 'Dark',
    colors: {
      bg: '#0f0f0f',
      bgSecondary: '#18181b',
      bgTertiary: '#27272a',
      text: '#e4e4e7',
      textSecondary: '#d4d4d8',
      textMuted: '#71717a',
      border: '#27272a',
      borderHover: '#3f3f46',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  },
  light: {
    name: 'Light',
    colors: {
      bg: '#ffffff',
      bgSecondary: '#f9fafb',
      bgTertiary: '#f3f4f6',
      text: '#1f2937',
      textSecondary: '#374151',
      textMuted: '#6b7280',
      border: '#e5e7eb',
      borderHover: '#d1d5db',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  }
};

/**
 * Apply theme to current page
 * @param {string} themeName - Theme name ('dark', 'light')
 */
function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.dark;
  const root = document.documentElement;

  // Set CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
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
        --color-text: #e4e4e7;
        --color-text-secondary: #d4d4d8;
        --color-text-muted: #71717a;
        --color-border: #27272a;
        --color-border-hover: #3f3f46;
        --color-primary: #3b82f6;
        --color-primary-hover: #2563eb;
        --color-success: #10b981;
        --color-error: #ef4444;
        --color-warning: #f59e0b;
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
        --color-text: #1f2937;
        --color-text-secondary: #374151;
        --color-text-muted: #6b7280;
        --color-border: #e5e7eb;
        --color-border-hover: #d1d5db;
      }

      body.theme-light h1 {
        color: #1f2937;
        -webkit-text-fill-color: #1f2937;
        background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      body.theme-light .answer-content {
        color: #1f2937;
      }

      body.theme-light #header {
        background: linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);
        border-bottom-color: #e5e7eb;
      }

      body.theme-light #settings-icon {
        background: #f9fafb;
        border-color: #e5e7eb;
      }

      body.theme-light #settings-icon:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
      }

      body.theme-light #settings-icon svg {
        fill: #6b7280;
      }

      body.theme-light #balance-row {
        background: #ffffff;
        border-bottom-color: #e5e7eb;
      }

      body.theme-light .toggle-btn {
        background: #f9fafb;
        border-color: #e5e7eb;
      }

      body.theme-light .toggle-btn:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
      }

      body.theme-light .toggle-btn.active {
        background: #dbeafe;
        border-color: #3b82f6;
      }

      body.theme-light .toggle-btn svg {
        fill: #6b7280;
      }

      body.theme-light .toggle-btn.active svg {
        fill: #2563eb;
      }

      body.theme-light #balance-refresh {
        background: #f3f4f6;
        color: #1f2937;
        border-color: #d1d5db;
      }

      body.theme-light #balance-refresh:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }

      body.theme-light #bottom-section {
        background: #ffffff;
        border-top-color: #e5e7eb;
      }

      body.theme-light #prompt {
        background: #f9fafb;
        color: #1f2937;
        border-color: #e5e7eb;
      }

      body.theme-light #prompt:focus {
        border-color: #3b82f6;
      }

      body.theme-light #prompt::placeholder {
        color: #9ca3af;
      }

      body.theme-light .answer-item {
        background: #f9fafb;
        border-color: #e5e7eb;
      }

      body.theme-light .answer-meta {
        color: #6b7280;
      }

      body.theme-light .answer-footer {
        border-top-color: #e5e7eb;
        color: #9ca3af;
      }

      body.theme-light .clear-btn {
        background: #f3f4f6;
        color: #1f2937;
        border-color: #d1d5db;
      }

      body.theme-light .clear-btn:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }

      body.theme-light .typing-indicator {
        background: #f9fafb;
        border-color: #e5e7eb;
      }

      body.theme-light #model-section {
        background: #f9fafb;
        border-top-color: #e5e7eb;
      }

      body.theme-light #model-label {
        color: #6b7280;
      }

      body.theme-light #model-select {
        background: #ffffff;
        color: #1f2937;
        border-color: #e5e7eb;
      }

      body.theme-light #model-select option {
        background: #f9fafb;
        color: #1f2937;
      }

      body.theme-light #model-status {
        color: #6b7280;
      }

      body.theme-light ::-webkit-scrollbar-track {
        background: #ffffff;
      }

      body.theme-light ::-webkit-scrollbar-thumb {
        background: #d1d5db;
      }

      body.theme-light ::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }

      /* Options page specific - light theme */
      body.theme-light #prompt-history-container {
        background: #f9fafb !important;
        border-color: #e5e7eb !important;
      }

      body.theme-light #prompt-history {
        color: #1f2937;
      }

      body.theme-light .history-item {
        background: #ffffff !important;
        border-color: #e5e7eb !important;
        color: #1f2937;
      }

      body.theme-light .history-item:hover {
        background: #f3f4f6 !important;
        border-color: #d1d5db !important;
      }

      body.theme-light .history-item.selected {
        background: #dbeafe !important;
        border-color: #3b82f6 !important;
      }

      body.theme-light .history-detail-card {
        background: #f9fafb !important;
        border-color: #e5e7eb !important;
      }

      body.theme-light .history-detail-header {
        border-bottom-color: #e5e7eb;
      }

      body.theme-light .history-detail-title {
        color: #1f2937;
      }

      body.theme-light .history-close-btn {
        background: #f3f4f6;
        color: #1f2937;
        border-color: #d1d5db;
      }

      body.theme-light .history-close-btn:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }

      body.theme-light .prompt-item-label,
      body.theme-light .prompt-item input[type="text"],
      body.theme-light .prompt-item textarea {
        color: #1f2937;
      }

      body.theme-light .history-prompt,
      body.theme-light .history-answer {
        color: #1f2937;
      }

      body.theme-light .history-timestamp {
        color: #6b7280;
      }

      /* History detail content - light theme */
      body.theme-light #history-detail-content {
        color: #1f2937;
      }

      body.theme-light #history-detail-content > div {
        color: #1f2937;
      }

      body.theme-light #history-detail-content div[style*="color: #71717a"] {
        color: #6b7280 !important;
      }

      body.theme-light #history-detail-content div[style*="color: #d4d4d8"] {
        color: #1f2937 !important;
      }

      body.theme-light #history-detail-content div[style*="color: #e4e4e7"] {
        color: #1f2937 !important;
      }

      body.theme-light #history-detail-content div[style*="background: #0f0f0f"] {
        background: #f9fafb !important;
        border: 1px solid #e5e7eb !important;
      }

      /* History preview in list - light theme */
      body.theme-light .history-preview div[style*="color: #71717a"] {
        color: #6b7280 !important;
      }

      body.theme-light .history-preview div[style*="color: #d4d4d8"] {
        color: #1f2937 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Load saved theme
  loadTheme();
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { THEMES, applyTheme, loadTheme, initTheme };
}
