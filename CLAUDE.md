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
│       └── utils.js             # Common utilities
├── icons/                       # Extension icons
├── tests/                       # Jest test files
├── docs/                        # Documentation
│   ├── features/                # Feature documentation
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
    ↓ fetch() to OpenRouter API
API Response
    ↓ sendResponse()
Sidepanel UI (src/sidepanel/sidepanel.js) - renders markdown, displays sources
```

### Key Architectural Patterns

**Message-Based Architecture**: All communication between components uses `chrome.runtime.sendMessage()` with typed message objects defined in `src/shared/constants.js` (e.g., `MESSAGE_TYPES.OPENROUTER_QUERY`).

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

**Storage Strategy**:
- **chrome.storage.local**: API keys, history, cache (never synced for security)
- **chrome.storage.sync**: Favorites, theme preferences (synced across devices)

**Caching System**: Models cached for 1 hour, balance for 60 seconds. Cache keys include timestamps to detect expiry.

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

### Adding New Features to Context Menu
Context menu prompts are configured in two places:
1. **src/options/options.js** (lines ~280-340): UI for editing prompts, saves to `chrome.storage.local`
2. **src/background/background.js** (lines ~100-150): Creates menu items from stored prompts on startup

After modifying prompts in options, call `syncContextMenusWithBackground()` to update immediately without reloading.

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
- UI renders an “Earlier messages (N)” toggle and a “Summary updated” badge

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

## Storage Keys Reference
All storage keys are defined in `src/shared/constants.js` as `STORAGE_KEYS.*`:
- `API_KEY` - OpenRouter API key (local only)
- `MODEL` - Currently selected model
- `HISTORY` - Recent prompts array
- `FAVORITES` - Favorited models (sync)
- `THEME` - Current theme name (sync)
- `CUSTOM_PROMPTS` - Context menu prompts (local)
- `SPACES` - User spaces array (local)
- `THREADS` - All threads across spaces (local)
- Cache keys: `MODELS_CACHE`, `BALANCE_CACHE`, `CONFIG_CACHE`

## Common Gotchas

**Context Menu Not Updating**: After changing custom prompts, the background service worker needs to recreate menus. The options page sends a message to trigger this, but if the service worker is inactive, it may not receive it. The extension handles this with retry logic in `syncContextMenusWithBackground()`.

**Sidebar State Persistence**: The sidebar doesn't persist state across reloads. History is loaded from `chrome.storage.local` on init. Don't assume variables survive between sidebar opens.

**Async Message Handlers**: When using `chrome.runtime.onMessage.addListener()`, you MUST `return true` if you're using `sendResponse()` asynchronously. See src/background/background.js message handlers for examples.

**CSS Variable Theming**: Themes work by setting CSS variables on the document element. When adding new UI elements, use variables like `--color-bg`, `--color-text` instead of hardcoded colors.

**Tab ID Management**: For context isolation, always use the correct tabId. The sidepanel gets its tabId via `chrome.tabs.query({ active: true, currentWindow: true })`. Context menu requests send tabId from the originating tab.

**Summarize Page Permissions**: The "Summarize Page" feature requires optional host permissions that are granted at runtime. First use on a domain triggers a Chrome permission dialog. If users report the feature "not working," they likely denied the permission. The UX includes automatic retry after permission grant and clear error messages on denial.

## Extension Manifest Notes
- **Manifest V3**: Uses service workers, not persistent background pages
- **Side Panel API**: Requires `sidePanel` permission and configuration
- **Host Permissions**: `https://openrouter.ai/*` for API calls (automatic)
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
- **v1.1.1**: Spaces adaptive summaries, archived messages toggle, summary badge
- **v1.1.0**: Spaces UI improvements - 5-column grid layout, emoji icons, web search/reasoning toggles, source citations, copy button, clean URL removal
- **v1.0.0**: Spaces feature - full-page experience for organizing conversations by project
- **v0.9.1**: DOMPurify integration, comprehensive unit tests (101 tests)
- **v0.9.0**: Copy button, stop generation, token estimation, accessibility improvements
- **v0.8.0**: Real-time streaming, reasoning display, model dropdown enhancements
- **v0.7.0**: Markdown support, themes, toast notifications, export features
- **v0.6.0**: Security enhancements, performance optimization, caching
- **v0.5.0**: Initial release with basic chat

See README.md for detailed changelog.

