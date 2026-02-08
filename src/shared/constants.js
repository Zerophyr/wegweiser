// constants.js - Shared constants for Wegweiser

// Storage keys
export const STORAGE_KEYS = {
  PROVIDER: "or_provider",
  API_KEY: "or_api_key",
  API_KEY_NAGA: "naga_api_key",
  API_KEY_NAGA_PROVISIONAL: "naga_provisioning_key",
  MODEL: "or_model",
  MODEL_PROVIDER: "or_model_provider",
  MODEL_NAGA: "or_model_naga",
  FAVORITES: "or_favorites",
  FAVORITES_NAGA: "or_favorites_naga",
  RECENT_MODELS: "or_recent_models",
  RECENT_MODELS_NAGA: "or_recent_models_naga",
  HISTORY_LIMIT: "or_history_limit",
  HISTORY: "or_history",
  PROJECTS: "or_projects",
  PROJECT_THREADS: "or_project_threads",
  WEB_SEARCH: "or_web_search",
  REASONING: "or_reasoning",
  MODELS_CACHE: "or_models_cache",
  MODELS_CACHE_TIME: "or_models_cache_time",
  MODELS_CACHE_NAGA: "or_models_cache_naga",
  MODELS_CACHE_TIME_NAGA: "or_models_cache_time_naga",
  NAGA_STARTUPS_CACHE: "naga_startups_cache",
  NAGA_STARTUPS_CACHE_TIME: "naga_startups_cache_time",
  SPACES: "or_spaces",
  THREADS: "or_threads",
  THEME: "or_theme",
  DEBUG_STREAM: "or_debug_stream",
  IMAGE_CACHE: "or_image_cache",
  COLLAPSE_ON_SPACES: "or_collapse_on_spaces",
  COLLAPSE_ON_PROJECTS: "or_collapse_on_projects",
  IMAGE_CACHE_LIMIT_MB: "or_image_cache_limit_mb",
  PROVIDER_ENABLED_OPENROUTER: "or_provider_enabled_openrouter",
  PROVIDER_ENABLED_NAGA: "or_provider_enabled_naga",
  CONTEXT_SESSION_PREFIX: "or_context_session_"
};

export const LEGACY_STORAGE_KEYS = {
  SPACES: "or_spaces",
  THREADS: "or_threads",
  COLLAPSE_ON_SPACES: "or_collapse_on_spaces"
};

// Encryption settings (local storage only)
export const ENCRYPTION_KEY_STORAGE_KEY = "or_crypto_key";
export const ENCRYPTED_STORAGE_KEYS = [
  STORAGE_KEYS.PROVIDER,
  STORAGE_KEYS.API_KEY,
  STORAGE_KEYS.API_KEY_NAGA,
  STORAGE_KEYS.API_KEY_NAGA_PROVISIONAL,
  STORAGE_KEYS.MODEL,
  STORAGE_KEYS.MODEL_PROVIDER,
  STORAGE_KEYS.MODEL_NAGA,
  STORAGE_KEYS.RECENT_MODELS,
  STORAGE_KEYS.RECENT_MODELS_NAGA,
  STORAGE_KEYS.HISTORY_LIMIT,
  STORAGE_KEYS.HISTORY,
  STORAGE_KEYS.SPACES,
  STORAGE_KEYS.THREADS,
  STORAGE_KEYS.WEB_SEARCH,
  STORAGE_KEYS.REASONING,
  STORAGE_KEYS.PROVIDER_ENABLED_OPENROUTER,
  STORAGE_KEYS.PROVIDER_ENABLED_NAGA
];

if (typeof globalThis !== "undefined") {
  globalThis.ENCRYPTED_STORAGE_KEYS = ENCRYPTED_STORAGE_KEYS;
}

// Excluded from encryption (cache + image data)
export const NON_ENCRYPTED_KEYS = [
  STORAGE_KEYS.MODELS_CACHE,
  STORAGE_KEYS.MODELS_CACHE_TIME,
  STORAGE_KEYS.MODELS_CACHE_NAGA,
  STORAGE_KEYS.MODELS_CACHE_TIME_NAGA,
  STORAGE_KEYS.NAGA_STARTUPS_CACHE,
  STORAGE_KEYS.NAGA_STARTUPS_CACHE_TIME,
  STORAGE_KEYS.IMAGE_CACHE,
  STORAGE_KEYS.IMAGE_CACHE_LIMIT_MB
];

// Message types for chrome.runtime.sendMessage
export const MESSAGE_TYPES = {
  OPENROUTER_QUERY: "openrouter_query",
  OPENROUTER_RESPONSE: "openrouter_response",
  GET_BALANCE: "get_balance",
  GET_MODELS: "get_models",
  CLEAR_CONTEXT: "clear_context",
  SET_PROVIDER: "set_provider",
  PROVIDER_SETTINGS_UPDATED: "provider_settings_updated",
  SUMMARIZE_PAGE: "summarize_page",
  REQUEST_PERMISSION: "request_permission",
  SUMMARIZE_THREAD: "summarize_thread",
  SPACES_QUERY: "spaces_query",
  SPACES_STREAM: "spaces_stream",
  IMAGE_QUERY: "image_query",
  DEBUG_GET_STREAM_LOG: "debug_get_stream_log",
  DEBUG_CLEAR_STREAM_LOG: "debug_clear_stream_log",
  DEBUG_SET_ENABLED: "debug_set_enabled",
  CLOSE_SIDEPANEL: "close_sidepanel"
};

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  BALANCE: 60_000,        // 60 seconds
  CONFIG: 60_000,         // 60 seconds
  MODELS: 3_600_000,      // 1 hour
  IMAGE: 10_800_000       // 3 hours
};

// Default values
export const DEFAULTS = {
  HISTORY_LIMIT: 20,
  MAX_CONTEXT_MESSAGES: 16,  // 16 messages = 8 conversation turns (8 user + 8 assistant)
  MODEL: "openai/gpt-4o-mini",
  IMAGE_CACHE_LIMIT_MB: 512,
  PROVIDER_ENABLED_OPENROUTER: true,
  PROVIDER_ENABLED_NAGA: false
};

// UI constants
export const UI_CONSTANTS = {
  TEXTAREA_MAX_HEIGHT: 200,           // Max height for auto-resize textarea (px)
  TEXTAREA_MIN_HEIGHT: 44,            // Min height for textarea (px)
  SCROLL_BUTTON_BOTTOM_OFFSET: 280,  // Bottom offset for scroll button (px)
  SCROLL_THRESHOLD: 100,              // Scroll threshold for showing scroll button (px)
  CHARS_PER_TOKEN: 4,                 // Rough estimate: 1 token ≈ 4 characters
  TOKEN_BAR_MAX_TOKENS: 4000,         // Default max tokens for visualization
  COPY_FEEDBACK_DURATION: 500,        // Duration of copy button color change (ms)
  DEBOUNCE_DELAY: 150                 // Debounce delay for input events (ms)
};

// Error messages
export const ERROR_MESSAGES = {
  NO_API_KEY: "No API key set. Open the extension options and enter your API key.",
  NO_PROMPT: "Enter a prompt first.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  API_ERROR: "API error. Please try again later.",
  RATE_LIMIT: "Rate limit exceeded. Please wait a moment and try again.",
  INVALID_RESPONSE: "Invalid response from API. Please try again.",
  TIMEOUT: "Request timed out. Please try again."
};

// API configuration
export const API_CONFIG = {
  BASE_URL: "https://openrouter.ai/api/v1",
  TIMEOUT: 120000,  // 120 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000  // Start with 1 second, will use exponential backoff
};

// Provider configuration
export const PROVIDERS = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    supportsBalance: true,
    supportsWebSearch: true,
    balanceEndpoint: "/credits",
    headers: {
      "X-Title": "Wegweiser"
    }
  },
  naga: {
    id: "naga",
    label: "NagaAI",
    baseUrl: "https://api.naga.ac/v1",
    supportsBalance: true,
    supportsWebSearch: false,
    balanceEndpoint: "/account/balance",
    headers: {}
  }
};

// Regex patterns (compiled once)
export const PATTERNS = {
  URL: /(https?:\/\/[^\s<>"]+)/g,
  EMAIL: /[\w.-]+@[\w.-]+\.\w+/g
};

