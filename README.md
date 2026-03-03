# 🤖 Wegweiser v1.2.0

> Your friendly AI companion powered by OpenRouter - chat with models right from your browser sidebar!

## ✨ Features

### Core Functionality
- 🎯 **Side Panel Chat** - Chat with AI models directly in your browser sidebar
- 🔄 **Model Selection** - OpenRouter model list with favorites and recently used models
- 🏠 **Projects** - Full-page workspace to organize projects, threads, and custom instructions
- 💬 **Conversation Context** - Remembers last 8 messages for contextual conversations
- 💾 **Per-Tab Answer Persistence** - Sidebar answers stay until cleared, scoped to the current tab
- 💰 **Token Insights** - Token estimate + usage bar before and after sending
- 🧾 **Adaptive Summaries** - Automatic summaries keep long Projects threads usable
- 📊 **Balance Display** - Live OpenRouter balance and credits usage
- 🗃️ **Encrypted IndexedDB Chats** - Chat data stored in IndexedDB with AES-GCM encryption
- 🔐 **Encrypted Local Settings** - Sensitive settings encrypted at rest with a device-local key
- 🌐 **Web Search** - Enable web search for up-to-date information
- 🧠 **Reasoning Mode** - Real-time streaming reasoning display for complex queries
- 🖼️ **Image Generation** - Generate images and view/download in the sidebar or Projects

## 🚀 Installation

### From Chrome Web Store
_(Coming soon)_

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the extension directory

## 👩‍💻 Contributor Security & Quality Setup

1. Use SSH for git remotes (no embedded credentials):
   - `git remote set-url origin git@github.com:Zerophyr/wegweiser.git`
2. Install local git hooks once per clone:
   - `npm run hooks:install`
3. Run security scans before release work:
   - `npm run security:scan`
4. Follow TDD for behavior changes (Red -> Green -> Refactor):
   - Write/update a failing test first.
   - Run the failing test and confirm expected failure.
   - Implement minimal code to pass.
   - Re-run full unit tests and smoke tests for relevant flows.
5. Use local TDD guardrails before pushing:
   - `npm run tdd:check:staged`
   - `npm run test:related`

### 🔁 Developer Workflow (Local -> PR)

Run these in order for feature/bugfix branches:

1. `npm ci`
2. `npm run hooks:install` *(once per clone)*
3. `npm run security:scan:staged` *(before commit)*
4. `npm run tdd:check:staged`
5. `npm run test:related` *(quick loop for changed source files)*
6. `npm test -- --runInBand` *(pre-PR gate)*
7. `npm run test:smoke` *(UI flow gate)*
8. Push and open PR *(required checks: `build`, `browser-smoke`, `tdd-guard`, `secrets`)*

Use `test:related` for fast iteration and always run the full Jest + smoke gates before opening a PR.

### 🛠️ TDD Guardrail Tuning Policy (Maintainers)

For the next 2 weeks, track `tdd-guard` false positives and tune only `scripts/tdd/tdd-check.config.json`:

- Allowed tuning:
  - `areaAliases` improvements
  - `ignoredSourceGlobs` for clearly non-behavioral/vendor/generated paths
- Not allowed:
  - broad ignores for core runtime folders (`src/background`, `src/sidepanel`, `src/projects`, `src/options`)
  - disabling `tdd-guard` or removing required status checks

### 🔐 Branch Protection Baseline (Maintainers)

Configure GitHub branch protection for `main` with:

- Require pull request before merge
- Required approvals: 1
- Dismiss stale approvals: enabled
- Require status checks: enabled
- Require branches to be up to date: enabled
- Required checks: `build`, `browser-smoke`, `tdd-guard`, `secrets`
- Restrict force pushes: enabled
- Restrict deletions: enabled
- Include administrators: enabled

## 🔑 Setup

1. Get your API key:
   - OpenRouter: [openrouter.ai](https://openrouter.ai)

2. Click the extension icon or open the side panel
3. Click the gear icon (⚙️) to open options
4. Enter your OpenRouter API key in the provider card
5. Models refresh automatically after key updates
6. If no valid API key is set, the sidebar shows a setup panel with an “Open Options” shortcut
7. Select your preferred model from the search dropdown
8. Click "Save" if you changed the model

## 📖 User Guide

### Basic Chat
1. Open the side panel (click extension icon)
2. Type your prompt in the text box
3. Press `Enter` or click "Ask" button
4. View AI responses with markdown formatting

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Enter` or `Ctrl/Cmd + Enter` | Send message |
| `Shift + Enter` | New line in prompt |
| `Ctrl/Cmd + K` | Clear answers |
| `Escape` | Focus prompt input |

### Export History
1. Open Options (gear icon)
2. Scroll to "Prompt History"
3. Click "Export History (JSON)" or "Export History (CSV)"
4. Save file to desired location

### Themes
1. Open Options
2. Select theme from dropdown:
   - **Dark** - Default dark theme
   - **Light** - Clean light theme
3. Theme applies immediately

### Release Packaging & CRX Signing
1. Run packaging:
   - `npm run release`
2. Optional signed CRX output requires both environment variables:
   - `CWS_PRIVATE_KEY_PATH` (path to private key file)
   - `CHROME_PATH` (path to Chrome/Chromium executable)
3. If either variable is missing or invalid, release still creates the upload ZIP and skips signed CRX.
4. Never commit key files or place credentials in git remote URLs.

### Options Highlights
1. **Provider card**: Add your OpenRouter API key to unlock model loading
2. **Balance display**: Uses OpenRouter credits endpoint automatically
3. **Key visibility**: Eye icons hide/show keys (always hidden on reload)
4. **Streaming debug log**: Toggle logging and download the last 500 stream events (includes summaries)
5. **Image storage**: Clear generated images and set the storage limit (IndexedDB)
6. **Projects behavior**: Toggle auto-collapse when opening Projects

## 📁 Project Structure

```
Wegweiser-extension/
├── .github/                # CI workflows
├── scripts/                # Build/release/security utilities
├── src/
│   ├── background/         # Service worker + provider/API orchestration + background-* helpers
│   ├── sidepanel/          # Sidebar UI + sidepanel-* helpers
│   ├── projects/           # Projects UI + projects-* helper modules
│   ├── options/            # Options page + options-* controllers/history helpers
│   ├── image-viewer/       # Image viewer tab for generated images
│   ├── modules/            # Shared UI modules (markdown, models, streaming, provider utils)
│   ├── shared/             # Shared storage/security utilities
│   └── lib/                # Vendor libs (DOMPurify)
├── tests/                  # Jest test suite (feature tests + utility module tests)
├── icons/                  # Extension icons
├── privacy-policy.html
├── manifest.json
├── package.json
└── README.md
```

## 🔒 Privacy & Security

- **Local API Key Storage** - API keys stored locally only (not synced)
- **Encrypted at Rest** - Settings and chat data are encrypted with a device-local key (no passphrase)
- **Encrypted Chat Storage** - Chats live in IndexedDB, encrypted per record
- **Key Marker Clarification** - Storage key markers (for example `v1:`) are compatibility metadata, not a security boundary
- **Masked Keys** - API/provisioning keys are hidden by default with a visibility toggle
- **Content Security Policy** - Strict CSP prevents injection attacks
- **Input Validation** - All user input sanitized
- **URL Validation** - Only HTTPS links allowed
- **Local Image Storage** - Generated images stored in IndexedDB on your device
- **Image Cleanup** - Manual clear option available in Options
- **No Telemetry** - No data collected or shared
- **Security Policy** - See `SECURITY.md` for reporting and incident-response guidance

### Secret Incident Recovery

If a credential is exposed:
1. Revoke the leaked token/key immediately.
2. Rotate and replace credentials in local settings/CI.
3. Verify remotes contain no embedded credentials:
   - `git remote -v`
4. Run scans:
   - `npm run security:scan`
   - `git log --all -G "ghp_[A-Za-z0-9]{36}|github_pat_" --oneline`

## 📝 Changelog

### v1.2.0 (Latest)
- 🧱 **Controller Refactor** - Extracted Projects and Sidepanel render/state orchestration into dedicated controller modules
- 🛡️ **Sink Coverage Expansion** - Added broader sink inventory tests and tightened safe HTML coverage across trusted/static paths
- 🧼 **Mechanical Sink Cleanup** - Replaced clear-only DOM writes with safer clear primitives where applicable
- 🔁 **Model Sync Reliability** - Strengthened Sidepanel model sync hooks for storage/focus/visibility refresh scenarios
- ✅ **Regression Coverage** - Added new Projects/Sidepanel controller tests and updated line-budget gates for smaller orchestration roots

### v1.1.5
- 🔐 **Encrypted Local Storage** - Sensitive local data encrypted at rest with a device-local key
- 🧩 **Automatic Migration** - Plaintext settings are migrated to encrypted storage on first read
- 🛡️ **No Passphrase Required** - Encryption is transparent with no extra steps for users
- 🗃️ **Encrypted IndexedDB Chats** - Chat data migrated to IndexedDB and encrypted at rest

### v1.1.4
- 🧭 **Onboarding Setup Panel** - Sidebar shows a setup card with “Open Options” when no API key is configured
- 🧠 **Context Timeline Reliability** - Sidebar context timeline persists across reopen/service worker idle
- 🧠 **Context Badge Refresh** - Context icon now updates on sidebar reopen

### v1.1.1
- 🧾 **Adaptive Summaries** - Summarize older Project turns to reduce token usage
- ✅ **Short Summary Acceptance** - Minimum summary length adapts to history size
- 🗂️ **Archived Messages** - Collapsible “Earlier messages (N)” with full bubbles
- 🏷️ **Summary Badge** - Visual indicator after summary refresh
- 🔁 **Model Browser** - OpenRouter model list with search, favorites, and recents
- 💳 **OpenRouter Balance Support** - Credit balance and usage in options/sidebar
- 👁️ **Key Visibility Toggle** - Inline eye icons for API/provisioning keys in Options
- 🧪 **Streaming Debug Log** - Optional log for troubleshooting stuck streams
- 📤 **Thread Export** - Export threads as PDF, Markdown, or DOCX via three-dot menu
- 💬 **Contextual Instructions** - Custom instructions adapt framing to prevent model re-introductions mid-thread
- 🎚️ **Image Cache Limit** - Slider in Options to cap IndexedDB image storage
- 🧭 **Projects Shortcut** - Settings gear in Projects + optional sidepanel auto-close

### v1.1.0
- 🎨 **Grid Layout** - Projects now display in a 5-column grid with square cards
- 😀 **Emoji Icons** - Custom emoji picker for Project icons
- 🌐 **Web Search Toggle** - Enable/disable web search per Project
- 🧠 **Reasoning Toggle** - Enable/disable reasoning mode per Project
- 🔄 **Chat Toggles** - Temporarily override web search/reasoning above chat input
- 🔗 **Source Citations** - Clickable citation numbers [1], [2] in Projects
- 🧹 **Clean URLs** - Plain URLs removed from answers, only citations remain
- 📋 **Copy Button** - Copy AI responses in Project threads
- 🎯 **Improved Sources** - Better URL extraction and cleanup in all responses

### v1.0.0
- 🏠 **Projects Feature** - Full-page experience for organizing conversations by project
- 📁 **Thread Management** - Create, rename, and delete threads within Projects
- ⚙️ **Custom Instructions** - Per-Project system prompts for AI behavior
- 🤖 **Per-Project Models** - Choose different models for different projects
- 💾 **Persistent Storage** - Unlimited conversation history with local storage
- 📊 **Storage Monitoring** - Visual usage tracking with warnings at 70%/85%/95%
- 🏠 **Home Button** - Quick access to Projects from sidebar header
- 🔄 **Extended Streaming** - Background script supports custom message arrays

