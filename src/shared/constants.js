// constants.js - Shared constants for Wegweiser

// Storage keys
export const STORAGE_KEYS = {
  PROVIDER: "or_provider",
  API_KEY: "or_api_key",
  MODEL: "or_model",
  MODEL_PROVIDER: "or_model_provider",
  FAVORITES: "or_favorites",
  RECENT_MODELS: "or_recent_models",
  HISTORY_LIMIT: "or_history_limit",
  HISTORY: "or_history",
  PROJECTS: "or_projects",
  PROJECT_THREADS: "or_project_threads",
  WEB_SEARCH: "or_web_search",
  REASONING: "or_reasoning",
  MODELS_CACHE: "or_models_cache",
  MODELS_CACHE_TIME: "or_models_cache_time",
  MODELS_CACHE_VERSION: "or_models_cache_version",
  THEME: "or_theme",
  DEBUG_STREAM: "or_debug_stream",
  IMAGE_CACHE: "or_image_cache",
  COLLAPSE_ON_PROJECTS: "or_collapse_on_projects",
  IMAGE_CACHE_LIMIT_MB: "or_image_cache_limit_mb",
  PROVIDER_ENABLED_OPENROUTER: "or_provider_enabled_openrouter",
  MIGRATION_NAGA_REMOVED_V1: "or_migration_naga_removed_v1",
  CONTEXT_SESSION_PREFIX: "or_context_session_"
};

// Legacy Naga keys retained for one-time migration cleanup.
export const LEGACY_NAGA_STORAGE_KEYS = [
  "naga_api_key",
  "naga_provisioning_key",
  "or_model_naga",
  "or_favorites_naga",
  "or_recent_models_naga",
  "or_models_cache_naga",
  "or_models_cache_time_naga",
  "or_models_cache_version_naga",
  "naga_startups_cache",
  "naga_startups_cache_time",
  "or_provider_enabled_naga"
];

// Encryption settings (local storage only)
export const ENCRYPTION_KEY_STORAGE_KEY = "or_crypto_key";
export const ENCRYPTED_STORAGE_KEYS = [
  STORAGE_KEYS.PROVIDER,
  STORAGE_KEYS.API_KEY,
  STORAGE_KEYS.MODEL,
  STORAGE_KEYS.MODEL_PROVIDER,
  STORAGE_KEYS.RECENT_MODELS,
  STORAGE_KEYS.HISTORY_LIMIT,
  STORAGE_KEYS.HISTORY,
  STORAGE_KEYS.PROJECTS,
  STORAGE_KEYS.PROJECT_THREADS,
  STORAGE_KEYS.WEB_SEARCH,
  STORAGE_KEYS.REASONING,
  STORAGE_KEYS.PROVIDER_ENABLED_OPENROUTER
];

if (typeof globalThis !== "undefined") {
  globalThis.ENCRYPTED_STORAGE_KEYS = ENCRYPTED_STORAGE_KEYS;
}

// Excluded from encryption (cache + image data)
export const NON_ENCRYPTED_KEYS = [
  STORAGE_KEYS.MODELS_CACHE,
  STORAGE_KEYS.MODELS_CACHE_TIME,
  STORAGE_KEYS.MODELS_CACHE_VERSION,
  STORAGE_KEYS.IMAGE_CACHE,
  STORAGE_KEYS.IMAGE_CACHE_LIMIT_MB,
  STORAGE_KEYS.MIGRATION_NAGA_REMOVED_V1,
  ...LEGACY_NAGA_STORAGE_KEYS
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
  PROJECTS_QUERY: "projects_query",
  PROJECTS_STREAM: "projects_stream",
  IMAGE_QUERY: "image_query",
  MODELS_UPDATED: "models_updated",
  DEBUG_GET_STREAM_LOG: "debug_get_stream_log",
  DEBUG_CLEAR_STREAM_LOG: "debug_clear_stream_log",
  DEBUG_SET_ENABLED: "debug_set_enabled",
  CLOSE_SIDEPANEL: "close_sidepanel"
};

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  BALANCE: 60_000,
  CONFIG: 60_000,
  MODELS: 21_600_000,
  IMAGE: 10_800_000
};

export const MODELS_CACHE_SCHEMA_VERSION = 3;

// Default values
export const DEFAULTS = {
  HISTORY_LIMIT: 20,
  MAX_CONTEXT_MESSAGES: 16,
  MODEL: "openai/gpt-4o-mini",
  IMAGE_CACHE_LIMIT_MB: 512,
  PROVIDER_ENABLED_OPENROUTER: true
};

// UI constants
export const UI_CONSTANTS = {
  TEXTAREA_MAX_HEIGHT: 200,
  TEXTAREA_MIN_HEIGHT: 44,
  SCROLL_BUTTON_BOTTOM_OFFSET: 280,
  SCROLL_THRESHOLD: 100,
  CHARS_PER_TOKEN: 4,
  TOKEN_BAR_MAX_TOKENS: 4000,
  COPY_FEEDBACK_DURATION: 500,
  DEBOUNCE_DELAY: 150
};

// Error messages
export const ERROR_MESSAGES = {
  NO_API_KEY: "No API key set. Open the extension options and enter your API key.",
  NO_PROMPT: "Enter a prompt first.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  API_ERROR: "API error. Please try again later.",
  RATE_LIMIT: "Rate limit exceeded. Please wait a moment and try again.",
  INVALID_RESPONSE: "Invalid response from API. Please try again.",
  TIMEOUT: "Request timed out. Please try again.",
  IMAGE_MODEL_REQUIRED: "Selected model does not support image generation. Choose another model or disable image mode."
};

// API configuration
export const API_CONFIG = {
  BASE_URL: "https://openrouter.ai/api/v1",
  TIMEOUT: 120000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
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
  }
};

// Regex patterns (compiled once)
export const PATTERNS = {
  URL: /(https?:\/\/[^\s<>"]+)/g,
  EMAIL: /[\w.-]+@[\w.-]+\.\w+/g
};
