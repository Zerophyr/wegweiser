# 🤖 Wegweiser v1.1.1

> Your friendly AI companion powered by OpenRouter and NagaAI - chat with models right from your browser sidebar!

## ✨ Features

### Core Functionality
- 🎯 **Side Panel Chat** - Chat with AI models directly in your browser sidebar
- 🔄 **Model Selection** - Combined model list across OpenRouter + NagaAI (only providers with keys)
- 💬 **Conversation Context** - Remembers last 8 messages for contextual conversations
- 📊 **Balance Display** - OpenRouter + NagaAI balance (NagaAI requires provisioning key)
- 🌐 **Web Search** - Enable web search for up-to-date information
- 🧠 **Reasoning Mode** - Real-time streaming reasoning display for complex queries

### Spaces (v1.1.1)
- 🏠 **Spaces** - Organize conversations by project or topic in a full-page experience
- 🎨 **5-Column Grid Layout** - Beautiful card-based overview with square cards
- 😀 **Emoji Icons** - Custom emoji picker to easily identify spaces
- 📁 **Multiple Threads** - Create and manage threads within each space
- ⚙️ **Custom Instructions** - Set AI behavior per space with system prompts
- 🤖 **Per-Space Models** - Choose different models for different projects
- 🌐 **Per-Space Web Search** - Enable/disable web search per space
- 🧠 **Per-Space Reasoning** - Enable/disable reasoning mode per space
- 🔄 **Chat Toggles** - Temporarily override web search/reasoning per message
- ⚙️ **Quick Settings Access** - Gear icon next to “Create Space” opens Options
- 🔗 **Source Citations** - Clickable [1], [2] references with clean URL removal
- 📋 **Copy Answers** - One-click copy button for AI responses in threads
- 🧾 **Adaptive Summaries** - Older turns are summarized to keep token usage low (short summaries accepted for small histories)
- 🗂️ **Archived Messages** - Expand “Earlier messages (N)” to view full history
- 🏷️ **Summary Badge** - "Summary updated" indicator after refresh
- 📤 **Thread Export** - Export threads as PDF, Markdown, or DOCX from the three-dot menu
- 💬 **Contextual Instructions** - Custom instructions adapt framing based on thread state to prevent model re-introductions
- 💾 **Persistent Storage** - All conversations saved locally with full history archived
- 📊 **Storage Monitoring** - Visual usage tracking with tiered warnings (70%/85%/95%)

### Quality of Life Features (v0.9.0)
- 📋 **Copy Answers** - One-click copy button for each AI response
- 🛑 **Stop Generation** - Cancel long-running requests with dedicated stop button
- 📏 **Smart Textarea** - Auto-resizing input field (up to 200px)
- ⌨️ **Enhanced Shortcuts** - Ctrl+Enter to send, Shift+Enter for new line, Escape to focus input
- 💰 **Token Estimate** - Approximate token count shown before sending
- 📊 **Token Usage Bar** - Visual progress bar with color-coded feedback (green/yellow/red)
- ⏱️ **Response Time** - Track generation speed for each response
- 🎯 **Context Badges** - Visual indicators showing conversation context usage

### Advanced Features
- 📝 **Markdown Support** - Beautiful formatting for AI responses with code blocks, headers, lists, and more
- 🎨 **Custom Themes** - Choose from Dark, Light, or Ocean themes
- 🔔 **Toast Notifications** - Visual feedback for all actions
- 📤 **Export History** - Export conversations as JSON or CSV
- 🔗 **Sources Display** - Clean source citations with favicon indicators and modal view
- 🔄 **Real-time Streaming** - Server-sent events for live response generation
- 🧭 **Provider Badges** - OR/NG badges in model lists to show provider availability
- 🧪 **Streaming Debug Log** - Optional log of the last 500 streaming events (Options)
- 🖼️ **IndexedDB Image Storage** - Image generations stored outside chrome.storage to avoid quota limits
- 🧹 **Image Cache Cleanup** - Clear generated images from Options
- 🎚️ **Image Cache Limit** - Adjustable cache size (128–2048 MB, default 512 MB)

### Security & Performance (v0.6.0)
- 🔒 **Enhanced Security** - API keys stored locally, CSP protection, input validation
- ⚡ **Optimized Rendering** - 66% faster response rendering
- 💾 **Smart Caching** - 1-hour model list cache, reduced API calls
- 🔄 **Retry Logic** - Automatic retry with exponential backoff
- 🧹 **Memory Management** - No memory leaks, automatic cleanup

## 🚀 Installation

### From Chrome Web Store
_(Coming soon)_

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the extension directory

## 🔑 Setup

1. Get your API key:
   - OpenRouter: [openrouter.ai](https://openrouter.ai)
   - NagaAI: [naga.ac](https://naga.ac)
2. Click the extension icon or open the side panel
3. Click the gear icon (⚙️) to open options
4. Choose your provider (OpenRouter or NagaAI) to edit keys
5. Enter your API key (NagaAI: add provisioning key to see balance)
6. Click "Save" (models refresh automatically)
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
   - **Ocean** - Blue/teal theme
3. Theme applies immediately

### Options Highlights
1. **Provider keys**: Switch provider to edit OpenRouter or NagaAI keys
2. **Provisioning key**: Optional NagaAI key to enable balance display
3. **Key visibility**: Eye icons hide/show keys (always hidden on reload)
4. **Streaming debug log**: Toggle logging and download the last 500 stream events (includes summaries)
5. **Image storage**: Clear generated images and set the storage limit (IndexedDB)
6. **Spaces behavior**: Toggle auto-collapse when opening Spaces

## 🛠️ Development

### Prerequisites
```bash
npm install
```

### TypeScript Development
```bash
# Build TypeScript
npm run build:ts

# Watch mode
npm run watch:ts
```

### Testing
```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Linting & Formatting
```bash
# Lint code
npm run lint

# Format code
npm run format
```

## 📁 Project Structure

```
Wegweiser-extension/
├── src/
│   ├── background/         # Service worker
│   ├── sidepanel/          # Sidebar UI
│   ├── spaces/             # Spaces UI
│   ├── image-viewer/        # Image viewer tab for generated images
│   ├── options/            # Options page
│   ├── modules/            # UI modules (markdown, toast, models, themes)
│   ├── lib/                # Vendor libs (DOMPurify)
│   └── shared/             # Shared helpers + constants
│       └── image-store.js   # IndexedDB-backed image storage
├── icons/                  # Extension icons
├── tests/                  # Jest tests
├── docs/                   # Documentation + plans
├── manifest.json
├── README.md
└── CLAUDE.md
```

## 🔒 Privacy & Security

- **Local API Key Storage** - API keys stored locally only (not synced)
- **Masked Keys** - API/provisioning keys are hidden by default with a visibility toggle
- **Content Security Policy** - Strict CSP prevents injection attacks
- **Input Validation** - All user input sanitized
- **URL Validation** - Only HTTPS links allowed
- **Local Image Storage** - Generated images stored in IndexedDB on your device
- **Image Cleanup** - Manual clear option available in Options
- **No Telemetry** - No data collected or shared

## 🎯 Quality Metrics

| Category | Score | Notes |
|----------|-------|-------|
| **Security** | 8/10 | API key isolation, CSP, input validation |
| **Performance** | 9/10 | Optimized rendering, smart caching |
| **Code Quality** | 8/10 | TypeScript ready, modular, tested |
| **User Experience** | 8.5/10 | Themes, shortcuts, markdown, toasts |
| **Overall** | 8.5/10 | Production-ready |

## 📝 Changelog

### v1.1.1 (Latest)
- 🧾 **Adaptive Summaries** - Summarize older Space turns to reduce token usage
- ✅ **Short Summary Acceptance** - Minimum summary length adapts to history size
- 🗂️ **Archived Messages** - Collapsible “Earlier messages (N)” with full bubbles
- 🏷️ **Summary Badge** - Visual indicator after summary refresh
- 🔁 **Multi-Provider Models** - Combined OpenRouter + NagaAI model list with provider badges
- 💳 **NagaAI Balance Support** - Provisioning key unlocks balance display
- 👁️ **Key Visibility Toggle** - Inline eye icons for API/provisioning keys in Options
- 🧪 **Streaming Debug Log** - Optional log for troubleshooting stuck streams
- 📤 **Thread Export** - Export threads as PDF, Markdown, or DOCX via three-dot menu
- 💬 **Contextual Instructions** - Custom instructions adapt framing to prevent model re-introductions mid-thread
- 🎚️ **Image Cache Limit** - Slider in Options to cap IndexedDB image storage
- 🧭 **Spaces Shortcut** - Settings gear in Spaces + optional sidepanel auto-close

### v1.1.0
- 🎨 **Grid Layout** - Spaces now display in a 5-column grid with square cards
- 😀 **Emoji Icons** - Custom emoji picker for space icons
- 🌐 **Web Search Toggle** - Enable/disable web search per space
- 🧠 **Reasoning Toggle** - Enable/disable reasoning mode per space
- 🔄 **Chat Toggles** - Temporarily override web search/reasoning above chat input
- 🔗 **Source Citations** - Clickable citation numbers [1], [2] in spaces
- 🧹 **Clean URLs** - Plain URLs removed from answers, only citations remain
- 📋 **Copy Button** - Copy AI responses in space threads
- 🎯 **Improved Sources** - Better URL extraction and cleanup in all responses

### v1.0.0
- 🏠 **Spaces Feature** - Full-page experience for organizing conversations by project
- 📁 **Thread Management** - Create, rename, and delete threads within spaces
- ⚙️ **Custom Instructions** - Per-space system prompts for AI behavior
- 🤖 **Per-Space Models** - Choose different models for different projects
- 💾 **Persistent Storage** - Unlimited conversation history with local storage
- 📊 **Storage Monitoring** - Visual usage tracking with warnings at 70%/85%/95%
- 🏠 **Home Button** - Quick access to Spaces from sidebar header
- 🔄 **Extended Streaming** - Background script supports custom message arrays

### v0.9.0
- 📋 **Copy Button** - One-click copy for each AI response with visual feedback
- 🛑 **Stop Generation** - Cancel streaming requests with dedicated stop button
- 📏 **Auto-resize Textarea** - Dynamic height adjustment up to 200px
- ⌨️ **Enhanced Keyboard Shortcuts** - Ctrl+Enter, Shift+Enter, Escape
- 💰 **Token Estimate** - Approximate token count before sending
- 📊 **Token Usage Bar** - Visual progress bar with color-coded feedback
- ⏱️ **Response Time Tracking** - Generation speed display for each answer
- 🎯 **Context Badges** - Visual indicators for conversation context usage
- 🔧 **Port Cleanup** - Fixed streaming stuck state bugs
- ♿ **Accessibility** - ARIA labels and screen reader support

### v0.8.0
- 🔄 **Real-time Streaming** - Port-based streaming for live response generation
- 🧠 **Reasoning Display** - Separate section for reasoning steps during generation
- 🎨 **Compact UI** - Collapsible model section and context visualization
- 📦 **Model Dropdown** - Enhanced model selection with favorites and recent models
- 🔍 **Context Visualization** - Interactive display of conversation context

### v0.7.0
- 📝 **Markdown Support** - Beautiful formatting for AI responses
- 🎨 **Custom Themes** - Dark, Light, and Ocean themes
- 🔔 **Toast Notifications** - Visual feedback system
- 📤 **Export History** - JSON/CSV export functionality
- 📚 **TypeScript Support** - TypeScript configuration added
- 🧪 **Testing Framework** - Jest testing setup
- 📖 **Comprehensive Documentation** - Full user and developer guides

### v0.6.0
- 🔒 **Security** - API keys now stored locally only
- ⚡ **Performance** - 66% faster rendering
- 💾 **Smart Caching** - 1-hour model list cache
- 🔄 **Retry Logic** - Exponential backoff for failed requests
- 🧹 **Memory Management** - Fixed memory leak with tab cleanup
- ⌨️ **Keyboard Shortcuts** - Basic keyboard navigation
- 📦 **Constants Module** - Centralized configuration
- 🎨 **UI Improvements** - Two-column options layout

### v0.5.0
- 🎯 **Initial Release** - Basic chat functionality
- 🔄 **Model Selection** - Choose from 100+ models
- 🖱️ **Context Menu** - Right-click integration
- 📜 **History Management** - Conversation history tracking

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Built with [OpenRouter API](https://openrouter.ai) and [NagaAI API](https://naga.ac)
- Inspired by the Chrome Extensions community
- Thanks to all contributors!

## 📞 Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-repo/issues)
- **Questions**: Check the [FAQ](#faq) or open a discussion
- **Feature Requests**: Submit via GitHub Issues

## ❓ FAQ

**Q: Is this extension free?**
A: The extension is free. You only pay for API usage from your selected provider.

**Q: Which models are supported?**
A: All models available on providers with API keys set.

**Q: Does it work offline?**
A: No, internet connection required for API calls.

**Q: Is my data private?**
A: Yes, all data stays local. No telemetry or tracking.

**Q: Can I use my own API key?**
A: Yes, you must use your own API key for OpenRouter or NagaAI.

---

**Made with ❤️ by the Wegweiser team**

*Version 1.1.1 | January 2026*


