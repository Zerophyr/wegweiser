# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm install          # Install dev dependencies (Jest, TypeScript, ESLint, Prettier)
npm test            # Run Jest tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run build:ts    # Compile TypeScript (if .ts files present)
npm run watch:ts    # TypeScript watch mode
npm run lint        # Run ESLint
npm run format      # Format with Prettier
```

### Testing the Extension
1. Navigate to `chrome://extensions/` in Chrome
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked" and select this directory
4. After code changes, click the refresh icon on the extension card
5. To debug the sidebar: right-click the sidebar → Inspect

## Directory Structure

```
Wegweiser-extension/
├── src/
│   ├── background/
│   │   └── background.js        # Service worker
│   ├── sidepanel/
│   │   ├── sidepanel.html       # Sidebar UI
│   │   ├── sidepanel.css        # Sidebar styles
│   │   └── sidepanel.js         # Sidebar logic
│   ├── image-viewer/
│   │   ├── image-viewer.html    # Image viewer tab
│   │   ├── image-viewer.css     # Image viewer styles
│   │   └── image-viewer.js      # Image viewer logic
│   ├── spaces/
│   │   ├── spaces.html          # Full-page Spaces UI
│   │   ├── spaces.css           # Spaces styling
│   │   └── spaces.js            # Spaces logic, chat, storage
│   ├── options/
│   │   ├── options.html         # Settings page
│   │   └── options.js           # Settings logic
│   ├── modules/
│   │   ├── markdown.js          # Markdown rendering
│   │   ├── toast.js             # Notifications
│   │   ├── sources.js           # Source extraction
│   │   ├── source-cards.js      # Source hover cards
│   │   ├── exporter.js          # Thread export helpers
│   │   ├── theme.js             # Theme system
│   │   ├── models-dropdown.js   # Model selection
│   │   └── context-viz.js       # Context visualization
│   ├── lib/
│   │   └── purify.min.js        # DOMPurify for HTML sanitization
│   └── shared/
│       ├── constants.js         # Message types, storage keys
│       ├── debug-log.js         # Streaming debug log helpers
│       ├── image-store.js       # IndexedDB-backed image storage
│       ├── model-utils.js       # Provider/model helpers for background
│       ├── utils.js             # Common utilities
│       └── visibility-toggle.js # Options key visibility helpers
├── icons/                       # Extension icons
├── tests/                       # Jest test files
├── docs/                        # Documentation
│   ├── features/                # Feature documentation
│   ├── plans/                   # Design documents
│   └── releases/                # Release notes
├── manifest.json
├── README.md
└── CLAUDE.md
```

## Architecture Overview

### Component Communication Flow
This is a **Chrome Manifest V3 extension** with a service worker architecture:

```
User Input (src/sidepanel/sidepanel.js)
    ↓ chrome.runtime.sendMessage()
Service Worker (src/background/background.js) - handles API calls, manages context
    ↓ fetch() to provider API (OpenRouter or NagaAI)
API Response
    ↓ sendResponse()
Sidepanel UI (src/sidepanel/sidepanel.js) - renders markdown, displays sources
```

### Key Architectural Patterns

**Message-Based Architecture**: All communication between components uses `chrome.runtime.sendMessage()` with typed message objects defined in `src/shared/constants.js` (e.g., `MESSAGE_TYPES.OPENROUTER_QUERY`).

**Multi-Provider Routing**:
- Combined model IDs are stored as `provider:modelId`
- Requests route by the selected model provider (OpenRouter or NagaAI)
- Options uses compact provider cards with per-provider Enable toggles; models load only from enabled providers with keys

**Per-Tab Conversation Context**:
- `src/background/background.js` maintains a `Map<tabId, messages[]>` for conversation history
- Each tab has isolated context (16 messages max = 8 Q&A pairs)
- Context automatically trimmed with `splice(0, length - MAX_CONTEXT_MESSAGES)`
- Cleanup on tab close prevents memory leaks

**Spaces Summaries + Archive (Token Control)**:
- Spaces threads now keep a rolling `thread.summary` and move older messages into `thread.archivedMessages`
- Live window: 12 messages before summary exists, 8 messages after summary exists
- Summary is injected as a system message after Space custom instructions; archived messages are never sent to the model
- Summary refresh uses `MESSAGE_TYPES.SUMMARIZE_THREAD` with `buildSummarizerMessages()` in `src/shared/utils.js`
- Summary acceptance uses an adaptive minimum length (80–200 chars based on history count)
- Storage footer shows two meters: Local Storage (settings + chats) and Image Storage (IndexedDB, configurable limit)

**Storage Strategy**:
- **chrome.storage.local**: API keys (OpenRouter + Naga), provisioning key, history, caches, debug log toggle
- **chrome.storage.sync**: Favorites, theme preferences (synced across devices)
- **IndexedDB**: Generated images (large data URLs stored outside local storage quota)
  - Options has a "Clear Images" button that wipes the IndexedDB image store
  - Image cache limit is user-configurable (128–2048 MB, default 512 MB)

**Caching System**: Models cached for 1 hour, balance for 60 seconds. Naga startups metadata cached for vendor labels. Cache keys include timestamps to detect expiry.

**Retry Logic**: Exponential backoff with 3 retries (delay = 1000ms × 2^attempt). Does NOT retry on client errors (4xx) or rate limits (429).

### File Load Order Dependencies
The `src/sidepanel/sidepanel.html` loads scripts in this specific order:
1. `src/lib/purify.min.js` - DOMPurify for sanitizing markdown output
2. `src/modules/toast.js` - Must load first (notifications used by all modules)
3. `src/modules/markdown.js` - Rendering utilities
4. `src/modules/sources.js` - Source extraction
5. `src/modules/source-cards.js` - Source hover cards
6. `src/modules/exporter.js` - Thread export helpers
7. `src/modules/theme.js` - Theme system
8. `src/shared/utils.js` - Shared helpers used by UI modules
9. `src/modules/models-dropdown.js` - Model selection UI
10. `src/modules/context-viz.js` - Context visualization
11. `src/sidepanel/sidepanel.js` - Main UI logic (depends on all above)

## Critical Code Patterns

### Modifying Conversation Context Behavior
Context management happens in `src/background/background.js` at the `callOpenRouter()` function:
- Context retrieval: `conversationContexts.get(tabId)` (line ~375)
- User message added: `context.push({ role: "user", content: prompt })` (line ~380)
- Trimming logic: `context.splice(0, context.length - MAX_CONTEXT_MESSAGES)` (line ~385)
- Assistant response added: `context.push({ role: "assistant", content })` (line ~455)

The `MAX_CONTEXT_MESSAGES` constant is in `src/shared/constants.js` (currently 16).

### Spaces Summary + Archive Flow
Spaces uses a separate summarization pipeline in `src/spaces/spaces.js`:
- `thread.summary` and `thread.summaryUpdatedAt` store the rolling summary
- `thread.archivedMessages` and `thread.archivedUpdatedAt` store older messages for UI-only viewing
- Summary updates call background `SUMMARIZE_THREAD` (no history/context side-effects)
- UI renders an "Earlier messages (N)" toggle and a "Summary updated" badge

### Contextual Custom Instructions
`buildStreamMessages()` in `src/spaces/spaces.js` varies how Space custom instructions are sent:
- **First message** (empty thread): instructions sent as-is in a system message
- **Follow-up messages** (thread has history): instructions wrapped with `[Ongoing conversation. Follow these standing instructions without re-introducing yourself:]` prefix
- This prevents models from re-introducing themselves mid-thread

### Thread Export
The thread three-dot menu includes an "Export" submenu (Markdown, PDF, DOCX):
- `exportThread()` in `src/spaces/spaces.js` loads the thread, combines `archivedMessages` + `messages` via `getFullThreadMessages()`, and calls the appropriate `exporter.js` function
- `sanitizeFilename()` strips special chars and caps at 50 characters
- Submenu opens to the left to avoid clipping by the thread panel

### Adding Features That Access Page Content
The "Summarize Page" feature demonstrates the pattern for accessing webpage content:

1. **Message Handler** (src/background/background.js:~408): Handles `SUMMARIZE_PAGE` message type
2. **Permission Check** (src/background/background.js:~420): Uses `chrome.permissions.contains({origins: [url]})`
3. **Permission Request Flow**: If no permission, returns `{requiresPermission: true, url}` to trigger UI flow
4. **Content Extraction** (src/background/background.js:~435): Uses `chrome.scripting.executeScript()` to inject extraction code
5. **UI Retry Logic** (src/sidepanel/sidepanel.js:~355): Auto-retries after permission grant
6. **Error Handling** (src/sidepanel/sidepanel.js:~387): Shows clear messages for permission denial

When adding new features that need page access, follow this permission-first pattern.

### Security Requirements
**NEVER bypass these security measures:**
- All user input must go through `escapeHtml()` before rendering
- URLs must be validated with `validateUrl()` (http/https only)
- API keys MUST only be stored in `chrome.storage.local` (never sync)
- Maintain the Content Security Policy in manifest.json

### Color System
All colors are centralized in `src/modules/theme.js` as 28 CSS custom properties. **Never hardcode hex colors** -- use `var(--color-*)` in CSS and JS inline styles.

**Available variables:**

| Variable | Dark | Light | Usage |
|---|---|---|---|
| `--color-bg` | `#0f0f0f` | `#ffffff` | Page background |
| `--color-bg-secondary` | `#18181b` | `#f9fafb` | Cards, inputs, panels |
| `--color-bg-tertiary` | `#27272a` | `#f3f4f6` | Chips, hover states |
| `--color-bg-elevated` | `#111113` | `#ffffff` | Popovers, source cards |
| `--color-text` | `#e4e4e7` | `#1f2937` | Primary content |
| `--color-text-secondary` | `#d4d4d8` | `#374151` | Labels, descriptions |
| `--color-text-muted` | `#a1a1aa` | `#6b7280` | Timestamps, meta, placeholders |
| `--color-text-on-primary` | `#ffffff` | `#ffffff` | Text on colored buttons |
| `--color-border` | `#27272a` | `#e5e7eb` | Dividers, card edges |
| `--color-border-hover` | `#3f3f46` | `#d1d5db` | Interactive hover borders |
| `--color-primary` | `#3b82f6` | `#3b82f6` | Buttons, active states |
| `--color-primary-hover` | `#2563eb` | `#2563eb` | Button hover |
| `--color-primary-subtle` | `rgba(59,130,246,0.1)` | `rgba(59,130,246,0.08)` | Blue-tinted backgrounds |
| `--color-success` | `#10b981` | `#059669` | Positive states |
| `--color-error` | `#ef4444` | `#dc2626` | Error states |
| `--color-warning` | `#f59e0b` | `#d97706` | Warning states |
| `--color-info` | `#0ea5e9` | `#0284c7` | Info/debug badges |
| `--color-accent` | `#8b5cf6` | `#7c3aed` | Purple accents |
| `--color-link` | `#60a5fa` | `#2563eb` | In-content links |
| `--color-link-hover` | `#93c5fd` | `#1d4ed8` | Link hover |
| `--color-topic-1` through `--color-topic-6` | blue/emerald/amber/pink/violet/cyan 400 | 600 variants | Topic heading colors |
| `--color-shadow` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.1)` | Box shadows |
| `--color-scrollbar` | `#27272a` | `#e5e7eb` | Scrollbar thumb |
| `--color-scrollbar-hover` | `#3f3f46` | `#d1d5db` | Scrollbar thumb hover |

**How theming works:**
1. `initTheme()` injects `:root` defaults and a `body.theme-light` variable override block
2. `applyTheme()` sets all variables on `document.documentElement` using `camelToKebab()` conversion
3. CSS/JS reference `var(--color-*)` -- theme switches automatically update everything
4. Light theme semantic colors shift one Tailwind shade darker (500 → 600) for contrast on white

**Adding new colors:**
1. Add the camelCase key to both `THEMES.dark.colors` and `THEMES.light.colors` in `theme.js`
2. Add the kebab-case variable to both the `:root` and `body.theme-light` blocks in `initTheme()`
3. Reference as `var(--color-your-new-color)` in CSS or inline styles

**Gradient endpoints:** Darker shades used as gradient endpoints (e.g., `#1d4ed8`, `#dc2626`) are intentionally kept hardcoded since they don't need theme adaptation.

### Adding Visual Feedback
The codebase uses multiple feedback layers:
1. **Toast notifications**: `showToast(message, type)` for user actions
2. **Status bar**: Update `metaEl.textContent` in src/sidepanel/sidepanel.js
3. **Badges**: Add inline badges like `<span class="context-badge">` for metadata
4. **Loading indicators**: Use `.typing-indicator` class with animation

Always provide feedback at multiple layers for important operations (see context memory implementation as reference).

### Markdown Rendering Pipeline
Responses flow through:
1. `extractSources()` - Pulls out URLs and [number] references
2. `applyMarkdownStyles()` - Converts markdown to HTML with escaping
3. Streaming renderer - Chunks text for perceived responsiveness (30ms delays)

When modifying markdown support, update both `src/modules/markdown.js` and the preview in options page.

### Debugging Tips
- **Service worker logs**: Open `chrome://extensions/` → Click "service worker" link under extension
- **Sidepanel logs**: Right-click sidebar → Inspect (opens DevTools)
- **Context size tracking**: Already implemented with console logs at lines src/background/background.js:389, 403-404, 460
- **Message flow**: Look for `console.log` statements showing message types and payloads
- **Streaming debug log**: Options → "Streaming Debug Log" (download last 500 stream events, includes summary start/response/error)

## Storage Keys Reference
All storage keys are defined in `src/shared/constants.js` as `STORAGE_KEYS.*`:
- `PROVIDER` - Last selected model provider (used as default when picking a model)
- `API_KEY` - OpenRouter API key (local only)
- `API_KEY_NAGA` - NagaAI API key (local only)
- `API_KEY_NAGA_PROVISIONAL` - NagaAI provisioning key (local only, for balance)
- `MODEL` - Selected model id (raw)
- `MODEL_PROVIDER` - Provider that owns the selected model
- `FAVORITES` - OpenRouter favorites (sync)
- `FAVORITES_NAGA` - NagaAI favorites (sync)
- `RECENT_MODELS` - OpenRouter recent models (local)
- `RECENT_MODELS_NAGA` - NagaAI recent models (local)
- `HISTORY` - Recent prompts array (local)
- `HISTORY_LIMIT` - History limit (local)
- `WEB_SEARCH` - Web search toggle (local)
- `REASONING` - Reasoning toggle (local)
- `MODELS_CACHE` / `MODELS_CACHE_TIME` - OpenRouter model cache
- `MODELS_CACHE_NAGA` / `MODELS_CACHE_TIME_NAGA` - NagaAI model cache
- `NAGA_STARTUPS_CACHE` / `NAGA_STARTUPS_CACHE_TIME` - NagaAI vendor label cache
- `SPACES` - User spaces array (local)
- `THREADS` - All threads across spaces (local)
- `THEME` - Current theme name (sync)
- `DEBUG_STREAM` - Streaming debug log toggle (local)
- `COLLAPSE_ON_SPACES` - Auto-close side panel when opening Spaces (local)
- `IMAGE_CACHE_LIMIT_MB` - Image cache size limit in MB (local)
- `PROVIDER_ENABLED_OPENROUTER` - Enable OpenRouter models (local)
- `PROVIDER_ENABLED_NAGA` - Enable NagaAI models (local)

## Common Gotchas

**Context Menu Not Updating**: After changing custom prompts, the background service worker needs to recreate menus. The options page sends a message to trigger this, but if the service worker is inactive, it may not receive it. The extension handles this with retry logic in `syncContextMenusWithBackground()`.

**Sidebar State Persistence**: The sidebar doesn't persist state across reloads. History is loaded from `chrome.storage.local` on init. Don't assume variables survive between sidebar opens.

**Async Message Handlers**: When using `chrome.runtime.onMessage.addListener()`, you MUST `return true` if you're using `sendResponse()` asynchronously. See src/background/background.js message handlers for examples.

**CSS Variable Theming**: All colors are managed through 28 CSS custom properties defined in `src/modules/theme.js`. **NEVER hardcode hex colors** in CSS or JS -- always use `var(--color-*)` variables. Light/dark theming works automatically through variable redefinition. See the Color System section below for the full variable reference.

**Tab ID Management**: For context isolation, always use the correct tabId. The sidepanel gets its tabId via `chrome.tabs.query({ active: true, currentWindow: true })`. Context menu requests send tabId from the originating tab.

**Summarize Page Permissions**: The "Summarize Page" feature requires optional host permissions that are granted at runtime. First use on a domain triggers a Chrome permission dialog. If users report the feature "not working," they likely denied the permission. The UX includes automatic retry after permission grant and clear error messages on denial.

## Extension Manifest Notes
- **Manifest V3**: Uses service workers, not persistent background pages
- **Side Panel API**: Requires `sidePanel` permission and configuration
- **Host Permissions**: `https://openrouter.ai/*` and `https://api.naga.ac/*` for API calls (automatic)
- **Optional Host Permissions**: `<all_urls>` for page summarization (runtime user grant required)
- **CSP**: Strict policy prevents inline scripts; all JS must be in separate files
- **Web Accessible Resources**: Currently none (no resources exposed to web pages)
- **Service Worker Imports**: When using `"type": "module"` in the service worker, use absolute paths from extension root (e.g., `/src/shared/constants.js`) rather than relative paths. Relative paths don't resolve correctly in Chrome extension service workers.

## Permission Management

The extension uses **optional host permissions** for the "Summarize Page" feature, which requires runtime permission grants:

### How It Works
1. Extension requests `optional_host_permissions: ["<all_urls>"]` in manifest.json
2. When user clicks "Summarize Page", src/background/background.js checks if permission exists for that domain
3. If no permission: Returns `{ok: false, error: "PERMISSION_NEEDED", requiresPermission: true, url}`
4. src/sidepanel/sidepanel.js detects this and calls `chrome.permissions.request({origins: [origin]})`
5. Chrome shows native permission dialog to user
6. If granted: Permission saved per-domain, summarization auto-retries
7. If denied: Friendly error message shown

### Key Implementation Points
- **Permission check**: `chrome.permissions.contains({origins: [url]})` in src/background/background.js before `executeScript()`
- **Permission request**: New `REQUEST_PERMISSION` message type in src/shared/constants.js
- **Auto-retry logic**: src/sidepanel/sidepanel.js automatically retries summarization after permission grant
- **Scope**: Permissions granted per origin (e.g., `https://example.com/*`)
- **Persistence**: Once granted, permission remembered for that domain

### Why This Pattern
- `activeTab` permission doesn't work for actions triggered from sidebar context
- Optional permissions allow runtime requests from any context (including sidebar buttons)
- Better security: no automatic access to all websites
- Chrome Web Store compliance: preferred over broad `host_permissions`

## Version History Context
The codebase is currently at **v1.1.1** with these major milestones:
- **v1.1.1**: Spaces adaptive summaries, archived messages toggle, summary badge, multi-provider model list + badges, NagaAI balance support, key visibility toggles, streaming debug log
- **v1.1.0**: Spaces UI improvements - 5-column grid layout, emoji icons, web search/reasoning toggles, source citations, copy button, clean URL removal
- **v1.0.0**: Spaces feature - full-page experience for organizing conversations by project
- **v0.9.1**: DOMPurify integration, comprehensive unit tests (101 tests)
- **v0.9.0**: Copy button, stop generation, token estimation, accessibility improvements
- **v0.8.0**: Real-time streaming, reasoning display, model dropdown enhancements
- **v0.7.0**: Markdown support, themes, toast notifications, export features
- **v0.6.0**: Security enhancements, performance optimization, caching
- **v0.5.0**: Initial release with basic chat

See README.md for detailed changelog.

