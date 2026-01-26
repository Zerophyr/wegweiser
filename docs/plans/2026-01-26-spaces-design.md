# Spaces Feature Design

**Date:** 2026-01-26
**Status:** Ready for implementation

## Overview

Spaces is a new full-page experience for organizing AI conversations by project or topic. It lives separately from the existing sidebar, which remains as "Quick Chat" for one-off queries.

### Entry Point

A Home button (house SVG icon) next to the Options button in the sidebar header. Clicking opens `spaces.html` in a new browser tab.

### Core Features

- Space cards with name, description, model, custom instructions
- Multiple threads per space with auto-generated titles (renameable)
- Two-panel layout: thread list (left) + chat (right)
- Full chat with streaming, markdown, using space's model/instructions
- Unlimited thread history (no 16-message cap like sidebar)
- Storage monitoring with warnings at 70%/85%/95%

### Out of Scope

- Collaboration/sharing
- File uploads
- Sidebar integration (Spaces is standalone)

---

## Data Models

### Space Object

```javascript
{
  id: "space_1234567890",
  name: "Project Research",
  description: "Research for Q1 product launch",
  model: "anthropic/claude-3-opus",
  customInstructions: "Always cite sources. Be concise.",
  createdAt: 1706300000000,
  updatedAt: 1706300000000
}
```

### Thread Object

```javascript
{
  id: "thread_1234567890",
  spaceId: "space_1234567890",
  title: "Competitor analysis",
  messages: [
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ],
  createdAt: 1706300000000,
  updatedAt: 1706300000000
}
```

### Storage Strategy

- **Separate storage**: `STORAGE_KEYS.SPACES` for spaces, `STORAGE_KEYS.THREADS` for threads
- Threads reference parent space via `spaceId`
- No message limit per thread - user manages by creating new threads
- Estimated: ~500KB per 100 threads with moderate conversation length
- Well within chrome.storage.local's 10MB limit

---

## Storage Monitoring

### Warning Thresholds

| Usage | Action |
|-------|--------|
| < 70% | No warning |
| 70-85% | Yellow banner: "Storage is filling up. Consider deleting old threads." |
| 85-95% | Orange banner: "Storage almost full. Delete threads to continue using Spaces." |
| > 95% | Red banner + block new threads: "Storage full. Delete threads to free space." |

### Deletion Features

- Delete individual threads via context menu or button in thread list
- Delete entire space (with confirmation) - removes space + all its threads
- "Clear all threads" option in space settings (keeps space, removes threads)
- Show thread size estimate in deletion confirmation: "This will free ~15KB"

### Storage Indicator

Small storage meter in Spaces List footer: "Using 2.3MB of 10MB"

---

## UI Design

### Spaces List (Landing Page)

```
┌──────────────────────────────────────────────────────────┐
│ Spaces                                   [+ Create Space] │
├──────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌─────────────────────┐         │
│ │ Project Research  ⋮ │  │ Learning Notes    ⋮ │         │
│ │ Research for Q1...  │  │ Course materials... │         │
│ │                     │  │                     │         │
│ │ claude-3 │ 5 threads│  │ gpt-4 │ 12 threads │         │
│ └─────────────────────┘  └─────────────────────┘         │
│                                                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Using 2.3MB of 10MB                                      │
└──────────────────────────────────────────────────────────┘
```

**Space Card**
- Space name (bold, truncated if long)
- Description (muted, 2 lines max)
- Footer: model name + thread count
- Three-dot menu on hover: Edit, Delete
- Click anywhere enters the space

**Empty State**
Centered message: "Create your first Space to organize conversations by project" with prominent Create button.

**Create/Edit Space Modal**
- Name (required)
- Description (optional)
- Model dropdown (defaults to current sidebar model)
- Custom instructions textarea (optional)

### Space View (Two-Panel Layout)

```
┌──────────────────────────────────────────────────────────┐
│ ← Back    Project Research                    ⚙️ Settings │
├─────────────────┬────────────────────────────────────────┤
│ + New Thread    │                                        │
│─────────────────│     Select a thread or start a new     │
│ ● Competitor... │           one to begin chatting        │
│   Market resea..│                                        │
│   Pricing stra..│                                        │
│                 │                                        │
│                 │                                        │
│                 │                                        │
│                 ├────────────────────────────────────────┤
│                 │ [Message input]                 [Send] │
└─────────────────┴────────────────────────────────────────┘
```

**Header Bar**
- Back arrow: returns to Spaces List
- Space name: centered
- Settings icon: opens edit modal (name, description, model, instructions)

**Left Panel: Thread List**
- "New Thread" button at top (always visible)
- Thread items: title (truncated), last updated time
- Active thread highlighted with accent color
- Hover shows three-dot menu: Rename, Delete
- Sorted by most recently updated
- Scrollable

**Right Panel: Chat Area**
- Empty state when no thread selected
- Full chat UI matching sidebar (messages, streaming, markdown)
- Input bar fixed at bottom with Send button
- Uses space's model and custom instructions automatically

---

## Sidebar Home Button

### Placement

```
┌─────────────────────────────────┐
│ OpenRouter Buddy      🏠  ⚙️    │
├─────────────────────────────────┤
│ ...existing sidebar content...  │
```

Order: Home | Options

### Behavior

- Click opens `chrome.tabs.create({ url: 'spaces.html' })`
- If Spaces tab already open, focus it instead of creating duplicate
- Tooltip: "Spaces"

### Visual Design

- SVG house icon
- Same size and style as Options button
- Matching hover state

---

## Chat Functionality

### Message Flow

1. User types message in Space chat input
2. `spaces.js` sends message to background via `chrome.runtime.sendMessage()`
3. Message type: `MESSAGE_TYPES.SPACES_QUERY`
   ```javascript
   {
     type: "SPACES_QUERY",
     prompt: "user message",
     threadId: "thread_123",
     spaceId: "space_456",
     model: "anthropic/claude-3-opus",
     customInstructions: "Always cite sources..."
   }
   ```
4. Background builds context: custom instructions (system) + thread messages + new prompt
5. Calls OpenRouter API with space's model
6. Streams response back via port (reuse existing streaming)
7. `spaces.js` updates UI and saves thread to storage

### Differences from Sidebar

| Aspect | Sidebar | Spaces |
|--------|---------|--------|
| Context limit | 16 messages | Unlimited (full thread) |
| Model | Global setting | Per-space setting |
| System prompt | None | Custom instructions |
| Persistence | Per-tab, memory only | Saved to storage |
| Streaming | Yes | Yes (reuse same code) |

### Thread Auto-Title

After first assistant response, generate title from first user message (first 50 chars or first sentence, whichever shorter).

---

## File Structure

### New Files

```
src/
├── spaces/
│   ├── spaces.html      # Full-page Spaces UI
│   ├── spaces.css       # Styles (reuse theme variables)
│   └── spaces.js        # Spaces logic, chat, storage
```

### Files to Modify

| File | Changes |
|------|---------|
| `manifest.json` | Add `spaces.html` to web_accessible_resources if needed |
| `src/sidepanel/sidepanel.html` | Add Home button with SVG house icon |
| `src/sidepanel/sidepanel.js` | Add click handler for Home button |
| `src/sidepanel/sidepanel.css` | Style for Home button |
| `src/background/background.js` | Add `SPACES_QUERY` message handler |
| `src/shared/constants.js` | Add new message types and storage keys |

### Reusable Modules

Spaces imports existing modules:
- `src/modules/markdown.js` - Response rendering
- `src/modules/toast.js` - Notifications
- `src/modules/theme.js` - Theme consistency

### New Constants

```javascript
// Message types
MESSAGE_TYPES.SPACES_QUERY = 'SPACES_QUERY';

// Storage keys
STORAGE_KEYS.SPACES = 'spaces';
STORAGE_KEYS.THREADS = 'threads';
```

---

## Implementation Notes

### Storage Monitoring Implementation

```javascript
async function checkStorageUsage() {
  const bytesInUse = await chrome.storage.local.getBytesInUse();
  const maxBytes = 10485760; // 10MB
  const percentUsed = (bytesInUse / maxBytes) * 100;

  if (percentUsed >= 95) {
    showStorageWarning('critical');
  } else if (percentUsed >= 85) {
    showStorageWarning('high');
  } else if (percentUsed >= 70) {
    showStorageWarning('medium');
  }

  return { bytesInUse, maxBytes, percentUsed };
}
```

### Focus Existing Tab

```javascript
async function openSpacesPage() {
  const spacesUrl = chrome.runtime.getURL('src/spaces/spaces.html');
  const tabs = await chrome.tabs.query({ url: spacesUrl });

  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: spacesUrl });
  }
}
```

### ID Generation

```javascript
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// Usage: generateId('space') -> "space_1706300000000_abc123xyz"
// Usage: generateId('thread') -> "thread_1706300000000_def456uvw"
```
