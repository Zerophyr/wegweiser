# Spaces Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Spaces feature for organizing AI conversations by project/topic, accessible via a Home button in the sidebar.

**Architecture:** New full-page `spaces.html` with two-panel layout (thread list + chat). Reuses existing streaming infrastructure and modules (markdown, toast, theme). Data stored in `chrome.storage.local` with separate keys for spaces and threads.

**Tech Stack:** Vanilla JavaScript, Chrome Extension APIs, existing modules (toast.js, markdown.js, theme.js)

---

## Task 1: Add Constants for Spaces

**Files:**
- Modify: `src/shared/constants.js`

**Step 1: Add new storage keys and message types**

Add after the existing `MESSAGE_TYPES` object (around line 25):

```javascript
// In MESSAGE_TYPES object, add:
  SPACES_QUERY: 'spaces_query',
  SPACES_STREAM: 'spaces_stream'
```

Add after the existing `STORAGE_KEYS` object (around line 14):

```javascript
// In STORAGE_KEYS object, add:
  SPACES: 'or_spaces',
  THREADS: 'or_threads',
  THEME: 'or_theme'
```

**Step 2: Verify the file loads without errors**

Run: Open Chrome, go to `chrome://extensions/`, reload the extension, check for errors in the service worker console.

Expected: No errors, extension loads normally.

**Step 3: Commit**

```bash
git add src/shared/constants.js
git commit -m "feat(spaces): add constants for spaces and threads storage"
```

---

## Task 2: Add Home Button to Sidebar HTML

**Files:**
- Modify: `src/sidepanel/sidepanel.html`

**Step 1: Add Home button next to settings icon**

Find the `#header` div (around line 11-18) and add the Home button before the settings icon:

```html
<div id="header" role="banner">
  <h1 style="font-size: inherit; margin: 0; font-weight: inherit;">Wegweiser</h1>
  <div style="display: flex; gap: 8px;">
    <div id="spaces-btn" title="Spaces" aria-label="Open Spaces" role="button" tabindex="0">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    </div>
    <div id="settings-icon" title="Open settings" aria-label="Open settings" role="button" tabindex="0">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
      </svg>
    </div>
  </div>
</div>
```

**Step 2: Verify visually**

Run: Reload extension, open sidebar.

Expected: Home icon appears next to settings icon.

**Step 3: Commit**

```bash
git add src/sidepanel/sidepanel.html
git commit -m "feat(spaces): add home button to sidebar header"
```

---

## Task 3: Style Home Button

**Files:**
- Modify: `src/sidepanel/sidepanel.css`

**Step 1: Add styles for spaces button**

Add after the `#settings-icon` styles (around line 88):

```css
#spaces-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

#spaces-btn:hover {
  background: #1f1f23;
  border-color: #3f3f46;
}

#spaces-btn svg {
  width: 18px;
  height: 18px;
  fill: #a1a1aa;
}

#spaces-btn:hover svg {
  fill: #e4e4e7;
}
```

**Step 2: Verify styling**

Run: Reload extension, open sidebar, hover over home button.

Expected: Button has same styling as settings, hover effect works.

**Step 3: Commit**

```bash
git add src/sidepanel/sidepanel.css
git commit -m "feat(spaces): style home button matching settings icon"
```

---

## Task 4: Add Home Button Click Handler

**Files:**
- Modify: `src/sidepanel/sidepanel.js`

**Step 1: Find the DOMContentLoaded or initialization section**

Look for where other button handlers are set up (settings icon handler). Add the spaces button handler nearby.

**Step 2: Add click handler to open Spaces page**

Add after the settings icon click handler:

```javascript
// Spaces button - open Spaces page
const spacesBtn = document.getElementById('spaces-btn');
if (spacesBtn) {
  const openSpacesPage = async () => {
    const spacesUrl = chrome.runtime.getURL('src/spaces/spaces.html');
    const tabs = await chrome.tabs.query({ url: spacesUrl });

    if (tabs.length > 0) {
      // Focus existing tab
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Open new tab
      chrome.tabs.create({ url: spacesUrl });
    }
  };

  spacesBtn.addEventListener('click', openSpacesPage);
  spacesBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSpacesPage();
    }
  });
}
```

**Step 3: Verify handler works**

Run: Reload extension, open sidebar, click home button.

Expected: Console shows error (spaces.html doesn't exist yet), but no JS errors.

**Step 4: Commit**

```bash
git add src/sidepanel/sidepanel.js
git commit -m "feat(spaces): add click handler to open spaces page"
```

---

## Task 5: Create Spaces Directory and HTML Structure

**Files:**
- Create: `src/spaces/spaces.html`

**Step 1: Create the directory and HTML file**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Spaces - Wegweiser</title>
  <link rel="stylesheet" href="spaces.css">
</head>
<body>
  <!-- Spaces List View -->
  <div id="spaces-list-view" class="view active">
    <header class="header">
      <h1>Spaces</h1>
      <button id="create-space-btn" class="btn btn-primary">+ Create Space</button>
    </header>

    <main class="spaces-grid" id="spaces-grid">
      <!-- Space cards will be inserted here -->
    </main>

    <div id="empty-state" class="empty-state" style="display: none;">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
          <path d="M12 7h-2v4H6v2h4v4h2v-4h4v-2h-4z"/>
        </svg>
      </div>
      <h2>Create your first Space</h2>
      <p>Organize conversations by project or topic</p>
      <button class="btn btn-primary" id="empty-create-btn">+ Create Space</button>
    </div>

    <footer class="storage-footer" id="storage-footer">
      <div class="storage-bar">
        <div class="storage-fill" id="storage-fill"></div>
      </div>
      <span class="storage-text" id="storage-text">Calculating storage...</span>
    </footer>
  </div>

  <!-- Space View (two-panel) -->
  <div id="space-view" class="view">
    <header class="space-header">
      <button id="back-btn" class="btn-icon" title="Back to Spaces">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      <h2 id="space-title">Space Name</h2>
      <button id="space-settings-btn" class="btn-icon" title="Space Settings">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
      </button>
    </header>

    <div class="space-content">
      <!-- Thread List Panel -->
      <aside class="thread-panel">
        <button id="new-thread-btn" class="btn btn-secondary btn-full">+ New Thread</button>
        <div class="thread-list" id="thread-list">
          <!-- Thread items will be inserted here -->
        </div>
      </aside>

      <!-- Chat Panel -->
      <main class="chat-panel">
        <div id="chat-empty-state" class="chat-empty">
          <p>Select a thread or start a new one to begin chatting</p>
        </div>

        <div id="chat-container" class="chat-container" style="display: none;">
          <div class="chat-messages" id="chat-messages">
            <!-- Messages will be inserted here -->
          </div>

          <div class="chat-input-container">
            <textarea id="chat-input" placeholder="Type a message..." rows="1"></textarea>
            <button id="send-btn" class="btn btn-primary">Send</button>
            <button id="stop-btn" class="btn btn-danger" style="display: none;">Stop</button>
          </div>
        </div>
      </main>
    </div>
  </div>

  <!-- Create/Edit Space Modal -->
  <div id="space-modal" class="modal" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modal-title">Create Space</h3>
        <button class="modal-close" id="modal-close">&times;</button>
      </div>
      <form id="space-form">
        <div class="form-group">
          <label for="space-name">Name *</label>
          <input type="text" id="space-name" required placeholder="e.g., Project Research">
        </div>
        <div class="form-group">
          <label for="space-description">Description</label>
          <input type="text" id="space-description" placeholder="Optional description">
        </div>
        <div class="form-group">
          <label for="space-model">Model</label>
          <select id="space-model">
            <option value="">Loading models...</option>
          </select>
        </div>
        <div class="form-group">
          <label for="space-instructions">Custom Instructions</label>
          <textarea id="space-instructions" rows="3" placeholder="Optional instructions for AI responses in this space"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-save">Create Space</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Rename Thread Modal -->
  <div id="rename-modal" class="modal" style="display: none;">
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>Rename Thread</h3>
        <button class="modal-close" id="rename-modal-close">&times;</button>
      </div>
      <form id="rename-form">
        <div class="form-group">
          <label for="thread-title">Title</label>
          <input type="text" id="thread-title" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="rename-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div id="delete-modal" class="modal" style="display: none;">
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3 id="delete-title">Delete Space</h3>
        <button class="modal-close" id="delete-modal-close">&times;</button>
      </div>
      <p id="delete-message">Are you sure you want to delete this space and all its threads?</p>
      <p id="delete-size" class="text-muted"></p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="delete-cancel">Cancel</button>
        <button type="button" class="btn btn-danger" id="delete-confirm">Delete</button>
      </div>
    </div>
  </div>

  <!-- Storage Warning Banner -->
  <div id="storage-warning" class="storage-warning" style="display: none;">
    <span id="warning-message"></span>
    <button id="warning-close" class="warning-close">&times;</button>
  </div>

  <script src="../lib/purify.min.js"></script>
  <script src="../modules/toast.js"></script>
  <script src="../modules/markdown.js"></script>
  <script src="../modules/theme.js"></script>
  <script src="../shared/utils.js"></script>
  <script src="spaces.js"></script>
</body>
</html>
```

**Step 2: Verify file created**

Run: Check file exists at `src/spaces/spaces.html`.

Expected: File exists with proper HTML structure.

**Step 3: Commit**

```bash
git add src/spaces/spaces.html
git commit -m "feat(spaces): create spaces page HTML structure"
```

---

## Task 6: Create Spaces CSS

**Files:**
- Create: `src/spaces/spaces.css`

**Step 1: Create comprehensive CSS file**

```css
/* spaces.css - Styles for Spaces page */

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
  font-size: 14px;
  margin: 0;
  padding: 0;
  background: #0f0f0f;
  color: #e4e4e7;
  min-height: 100vh;
}

/* Views */
.view {
  display: none;
  min-height: 100vh;
}

.view.active {
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  background: linear-gradient(135deg, #1a1a1f 0%, #0f0f0f 100%);
  border-bottom: 1px solid #27272a;
}

.header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: #e4e4e7;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.btn-secondary {
  background: #27272a;
  color: #e4e4e7;
  border: 1px solid #3f3f46;
}

.btn-secondary:hover {
  background: #3f3f46;
  border-color: #52525b;
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.btn-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: #27272a;
  border-color: #3f3f46;
}

.btn-icon svg {
  fill: #a1a1aa;
}

.btn-icon:hover svg {
  fill: #e4e4e7;
}

.btn-full {
  width: 100%;
}

/* Spaces Grid */
.spaces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 32px;
  flex: 1;
  overflow-y: auto;
}

/* Space Card */
.space-card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.space-card:hover {
  border-color: #3f3f46;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.space-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.space-card-name {
  font-size: 16px;
  font-weight: 600;
  color: #e4e4e7;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.space-card-menu {
  opacity: 0;
  transition: opacity 0.2s;
}

.space-card:hover .space-card-menu {
  opacity: 1;
}

.space-card-description {
  color: #71717a;
  font-size: 13px;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.space-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #52525b;
  padding-top: 12px;
  border-top: 1px solid #27272a;
}

.space-card-model {
  display: flex;
  align-items: center;
  gap: 6px;
}

.space-card-threads {
  font-weight: 500;
}

/* Menu Dropdown */
.menu-dropdown {
  position: relative;
}

.menu-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  color: #71717a;
  font-size: 18px;
  border-radius: 4px;
}

.menu-btn:hover {
  background: #27272a;
  color: #e4e4e7;
}

.menu-items {
  position: absolute;
  right: 0;
  top: 100%;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 4px;
  min-width: 120px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  color: #e4e4e7;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
}

.menu-item:hover {
  background: #27272a;
}

.menu-item.danger {
  color: #ef4444;
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
  text-align: center;
}

.empty-icon svg {
  fill: #3f3f46;
  margin-bottom: 24px;
}

.empty-state h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #e4e4e7;
}

.empty-state p {
  color: #71717a;
  margin: 0 0 24px 0;
}

/* Storage Footer */
.storage-footer {
  padding: 12px 32px;
  background: #18181b;
  border-top: 1px solid #27272a;
  display: flex;
  align-items: center;
  gap: 16px;
}

.storage-bar {
  flex: 1;
  max-width: 200px;
  height: 6px;
  background: #27272a;
  border-radius: 3px;
  overflow: hidden;
}

.storage-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s ease, background 0.3s ease;
}

.storage-fill.warning {
  background: #f59e0b;
}

.storage-fill.danger {
  background: #ef4444;
}

.storage-text {
  font-size: 12px;
  color: #71717a;
}

/* Storage Warning Banner */
.storage-warning {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}

.storage-warning.medium {
  background: #f59e0b;
  color: #000;
}

.storage-warning.high {
  background: #f97316;
  color: #fff;
}

.storage-warning.critical {
  background: #ef4444;
  color: #fff;
}

.warning-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 20px;
  cursor: pointer;
  opacity: 0.8;
}

.warning-close:hover {
  opacity: 1;
}

/* Space View */
.space-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: linear-gradient(135deg, #1a1a1f 0%, #0f0f0f 100%);
  border-bottom: 1px solid #27272a;
}

.space-header h2 {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

.space-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Thread Panel */
.thread-panel {
  width: 280px;
  background: #18181b;
  border-right: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.thread-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
}

.thread-item {
  padding: 12px;
  background: #0f0f0f;
  border: 1px solid #27272a;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.thread-item:hover {
  border-color: #3f3f46;
}

.thread-item.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.thread-title {
  font-size: 14px;
  font-weight: 500;
  color: #e4e4e7;
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 24px;
}

.thread-time {
  font-size: 11px;
  color: #52525b;
}

.thread-menu {
  position: absolute;
  right: 8px;
  top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.thread-item:hover .thread-menu {
  opacity: 1;
}

/* Chat Panel */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #52525b;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.chat-message {
  margin-bottom: 20px;
}

.chat-message-user {
  text-align: right;
}

.chat-message-user .chat-bubble {
  background: #3b82f6;
  color: white;
  display: inline-block;
  text-align: left;
}

.chat-message-assistant .chat-bubble {
  background: #27272a;
  color: #e4e4e7;
}

.chat-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 80%;
  line-height: 1.5;
  word-break: break-word;
}

.chat-bubble p {
  margin: 0;
}

.chat-bubble p + p {
  margin-top: 12px;
}

.chat-input-container {
  padding: 16px 24px;
  background: #18181b;
  border-top: 1px solid #27272a;
  display: flex;
  gap: 12px;
}

#chat-input {
  flex: 1;
  padding: 12px;
  background: #0f0f0f;
  color: #e4e4e7;
  border: 1px solid #27272a;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  min-height: 44px;
  max-height: 200px;
}

#chat-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-small {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: #71717a;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #e4e4e7;
}

/* Form */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #a1a1aa;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  background: #0f0f0f;
  color: #e4e4e7;
  border: 1px solid #27272a;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.text-muted {
  color: #71717a;
  font-size: 13px;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #0f0f0f;
}

::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: #27272a;
  border-radius: 12px;
  width: fit-content;
}

.typing-dot {
  width: 8px;
  height: 8px;
  background: #60a5fa;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Light theme overrides */
body.theme-light {
  background: #ffffff;
  color: #1f2937;
}

body.theme-light .header {
  background: linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);
  border-bottom-color: #e5e7eb;
}

body.theme-light .header h1 {
  color: #1f2937;
}

body.theme-light .space-card {
  background: #f9fafb;
  border-color: #e5e7eb;
}

body.theme-light .space-card:hover {
  border-color: #d1d5db;
}

body.theme-light .space-card-name {
  color: #1f2937;
}

body.theme-light .space-card-footer {
  border-top-color: #e5e7eb;
  color: #6b7280;
}

body.theme-light .storage-footer {
  background: #f9fafb;
  border-top-color: #e5e7eb;
}

body.theme-light .space-header {
  background: linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);
  border-bottom-color: #e5e7eb;
}

body.theme-light .thread-panel {
  background: #f9fafb;
  border-right-color: #e5e7eb;
}

body.theme-light .thread-item {
  background: #ffffff;
  border-color: #e5e7eb;
}

body.theme-light .thread-item:hover {
  border-color: #d1d5db;
}

body.theme-light .thread-title {
  color: #1f2937;
}

body.theme-light .chat-message-assistant .chat-bubble {
  background: #f3f4f6;
  color: #1f2937;
}

body.theme-light .chat-input-container {
  background: #f9fafb;
  border-top-color: #e5e7eb;
}

body.theme-light #chat-input {
  background: #ffffff;
  border-color: #e5e7eb;
  color: #1f2937;
}

body.theme-light .modal-content {
  background: #ffffff;
  border-color: #e5e7eb;
}

body.theme-light .form-group input,
body.theme-light .form-group select,
body.theme-light .form-group textarea {
  background: #f9fafb;
  border-color: #e5e7eb;
  color: #1f2937;
}

body.theme-light .btn-secondary {
  background: #f3f4f6;
  color: #1f2937;
  border-color: #d1d5db;
}

body.theme-light .btn-secondary:hover {
  background: #e5e7eb;
}

body.theme-light .btn-icon {
  background: #f9fafb;
  border-color: #e5e7eb;
}

body.theme-light .btn-icon:hover {
  background: #f3f4f6;
}

body.theme-light .btn-icon svg {
  fill: #6b7280;
}

body.theme-light .menu-items {
  background: #ffffff;
  border-color: #e5e7eb;
}

body.theme-light .menu-item {
  color: #1f2937;
}

body.theme-light .menu-item:hover {
  background: #f3f4f6;
}
```

**Step 2: Verify file created**

Run: Check file exists at `src/spaces/spaces.css`.

Expected: File exists with complete styling.

**Step 3: Commit**

```bash
git add src/spaces/spaces.css
git commit -m "feat(spaces): add comprehensive CSS styling"
```

---

## Task 7: Create Spaces JavaScript - Part 1 (Storage & Data)

**Files:**
- Create: `src/spaces/spaces.js`

**Step 1: Create the JavaScript file with storage functions**

```javascript
// spaces.js - Spaces feature logic

// Storage keys (match constants.js)
const STORAGE_KEYS = {
  SPACES: 'or_spaces',
  THREADS: 'or_threads',
  API_KEY: 'or_api_key',
  MODEL: 'or_model'
};

const MAX_STORAGE_BYTES = 10485760; // 10MB

// ============ UTILITY FUNCTIONS ============

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function generateThreadTitle(firstMessage) {
  // Get first sentence or first 50 chars
  const firstSentence = firstMessage.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) {
    return firstSentence.trim();
  }
  return firstMessage.substring(0, 50).trim() + '...';
}

// ============ STORAGE FUNCTIONS ============

async function loadSpaces() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SPACES]);
    return result[STORAGE_KEYS.SPACES] || [];
  } catch (e) {
    console.error('Error loading spaces:', e);
    return [];
  }
}

async function saveSpaces(spaces) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SPACES]: spaces });
}

async function loadThreads(spaceId = null) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.THREADS]);
    const threads = result[STORAGE_KEYS.THREADS] || [];
    if (spaceId) {
      return threads.filter(t => t.spaceId === spaceId);
    }
    return threads;
  } catch (e) {
    console.error('Error loading threads:', e);
    return [];
  }
}

async function saveThreads(threads) {
  await chrome.storage.local.set({ [STORAGE_KEYS.THREADS]: threads });
}

async function getThreadCount(spaceId) {
  const threads = await loadThreads(spaceId);
  return threads.length;
}

async function checkStorageUsage() {
  const bytesInUse = await chrome.storage.local.getBytesInUse();
  const percentUsed = (bytesInUse / MAX_STORAGE_BYTES) * 100;

  return {
    bytesInUse,
    maxBytes: MAX_STORAGE_BYTES,
    percentUsed,
    formatted: `${(bytesInUse / 1024 / 1024).toFixed(1)}MB of 10MB`
  };
}

async function estimateItemSize(item) {
  const json = JSON.stringify(item);
  return new Blob([json]).size;
}

// ============ SPACE CRUD ============

async function createSpace(data) {
  const spaces = await loadSpaces();
  const space = {
    id: generateId('space'),
    name: data.name,
    description: data.description || '',
    model: data.model || '',
    customInstructions: data.customInstructions || '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  spaces.push(space);
  await saveSpaces(spaces);
  return space;
}

async function updateSpace(id, data) {
  const spaces = await loadSpaces();
  const index = spaces.findIndex(s => s.id === id);
  if (index === -1) throw new Error('Space not found');

  spaces[index] = {
    ...spaces[index],
    ...data,
    updatedAt: Date.now()
  };
  await saveSpaces(spaces);
  return spaces[index];
}

async function deleteSpace(id) {
  const spaces = await loadSpaces();
  const filtered = spaces.filter(s => s.id !== id);
  await saveSpaces(filtered);

  // Also delete all threads in this space
  const threads = await loadThreads();
  const filteredThreads = threads.filter(t => t.spaceId !== id);
  await saveThreads(filteredThreads);
}

async function getSpace(id) {
  const spaces = await loadSpaces();
  return spaces.find(s => s.id === id);
}

// ============ THREAD CRUD ============

async function createThread(spaceId, title = 'New Thread') {
  const threads = await loadThreads();
  const thread = {
    id: generateId('thread'),
    spaceId,
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  threads.push(thread);
  await saveThreads(threads);
  return thread;
}

async function updateThread(id, data) {
  const threads = await loadThreads();
  const index = threads.findIndex(t => t.id === id);
  if (index === -1) throw new Error('Thread not found');

  threads[index] = {
    ...threads[index],
    ...data,
    updatedAt: Date.now()
  };
  await saveThreads(threads);
  return threads[index];
}

async function deleteThread(id) {
  const threads = await loadThreads();
  const filtered = threads.filter(t => t.id !== id);
  await saveThreads(filtered);
}

async function getThread(id) {
  const threads = await loadThreads();
  return threads.find(t => t.id === id);
}

async function addMessageToThread(threadId, message) {
  const thread = await getThread(threadId);
  if (!thread) throw new Error('Thread not found');

  thread.messages.push(message);
  thread.updatedAt = Date.now();

  // Auto-generate title from first user message if title is default
  if (thread.messages.length === 1 && message.role === 'user' && thread.title === 'New Thread') {
    thread.title = generateThreadTitle(message.content);
  }

  const threads = await loadThreads();
  const index = threads.findIndex(t => t.id === threadId);
  threads[index] = thread;
  await saveThreads(threads);

  return thread;
}
```

**Step 2: Verify file created**

Run: Check file exists at `src/spaces/spaces.js`.

Expected: File exists with storage functions.

**Step 3: Commit**

```bash
git add src/spaces/spaces.js
git commit -m "feat(spaces): add storage and CRUD functions"
```

---

## Task 8: Create Spaces JavaScript - Part 2 (UI State & Rendering)

**Files:**
- Modify: `src/spaces/spaces.js`

**Step 1: Add UI state and rendering functions**

Append to `src/spaces/spaces.js`:

```javascript

// ============ UI STATE ============

let currentSpaceId = null;
let currentThreadId = null;
let isStreaming = false;
let streamPort = null;
let editingSpaceId = null;
let renamingThreadId = null;
let deletingItem = null; // { type: 'space'|'thread', id: string }

// ============ DOM ELEMENTS ============

const elements = {};

function initElements() {
  // Views
  elements.spacesListView = document.getElementById('spaces-list-view');
  elements.spaceView = document.getElementById('space-view');

  // Spaces list
  elements.spacesGrid = document.getElementById('spaces-grid');
  elements.emptyState = document.getElementById('empty-state');
  elements.createSpaceBtn = document.getElementById('create-space-btn');
  elements.emptyCreateBtn = document.getElementById('empty-create-btn');
  elements.storageFooter = document.getElementById('storage-footer');
  elements.storageFill = document.getElementById('storage-fill');
  elements.storageText = document.getElementById('storage-text');
  elements.storageWarning = document.getElementById('storage-warning');
  elements.warningMessage = document.getElementById('warning-message');
  elements.warningClose = document.getElementById('warning-close');

  // Space view
  elements.backBtn = document.getElementById('back-btn');
  elements.spaceTitle = document.getElementById('space-title');
  elements.spaceSettingsBtn = document.getElementById('space-settings-btn');
  elements.newThreadBtn = document.getElementById('new-thread-btn');
  elements.threadList = document.getElementById('thread-list');
  elements.chatEmptyState = document.getElementById('chat-empty-state');
  elements.chatContainer = document.getElementById('chat-container');
  elements.chatMessages = document.getElementById('chat-messages');
  elements.chatInput = document.getElementById('chat-input');
  elements.sendBtn = document.getElementById('send-btn');
  elements.stopBtn = document.getElementById('stop-btn');

  // Space modal
  elements.spaceModal = document.getElementById('space-modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalClose = document.getElementById('modal-close');
  elements.spaceForm = document.getElementById('space-form');
  elements.spaceName = document.getElementById('space-name');
  elements.spaceDescription = document.getElementById('space-description');
  elements.spaceModel = document.getElementById('space-model');
  elements.spaceInstructions = document.getElementById('space-instructions');
  elements.modalCancel = document.getElementById('modal-cancel');
  elements.modalSave = document.getElementById('modal-save');

  // Rename modal
  elements.renameModal = document.getElementById('rename-modal');
  elements.renameModalClose = document.getElementById('rename-modal-close');
  elements.renameForm = document.getElementById('rename-form');
  elements.threadTitle = document.getElementById('thread-title');
  elements.renameCancel = document.getElementById('rename-cancel');

  // Delete modal
  elements.deleteModal = document.getElementById('delete-modal');
  elements.deleteTitle = document.getElementById('delete-title');
  elements.deleteModalClose = document.getElementById('delete-modal-close');
  elements.deleteMessage = document.getElementById('delete-message');
  elements.deleteSize = document.getElementById('delete-size');
  elements.deleteCancel = document.getElementById('delete-cancel');
  elements.deleteConfirm = document.getElementById('delete-confirm');
}

// ============ VIEW SWITCHING ============

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  if (viewName === 'list') {
    elements.spacesListView.classList.add('active');
    currentSpaceId = null;
    currentThreadId = null;
  } else if (viewName === 'space') {
    elements.spaceView.classList.add('active');
  }
}

// ============ RENDERING ============

async function renderSpacesList() {
  const spaces = await loadSpaces();

  if (spaces.length === 0) {
    elements.spacesGrid.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    return;
  }

  elements.spacesGrid.style.display = 'grid';
  elements.emptyState.style.display = 'none';

  // Sort by updatedAt descending
  spaces.sort((a, b) => b.updatedAt - a.updatedAt);

  const cardsHtml = await Promise.all(spaces.map(async space => {
    const threadCount = await getThreadCount(space.id);
    const modelName = space.model ? space.model.split('/').pop() : 'Default model';

    return `
      <div class="space-card" data-space-id="${space.id}">
        <div class="space-card-header">
          <h3 class="space-card-name">${escapeHtml(space.name)}</h3>
          <div class="space-card-menu menu-dropdown">
            <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu(this)">&#8942;</button>
            <div class="menu-items" style="display: none;">
              <button class="menu-item" onclick="event.stopPropagation(); openEditSpaceModal('${space.id}')">Edit</button>
              <button class="menu-item danger" onclick="event.stopPropagation(); openDeleteModal('space', '${space.id}')">Delete</button>
            </div>
          </div>
        </div>
        <p class="space-card-description">${escapeHtml(space.description) || 'No description'}</p>
        <div class="space-card-footer">
          <span class="space-card-model">🤖 ${escapeHtml(modelName)}</span>
          <span class="space-card-threads">${threadCount} thread${threadCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  }));

  elements.spacesGrid.innerHTML = cardsHtml.join('');

  // Add click handlers
  document.querySelectorAll('.space-card').forEach(card => {
    card.addEventListener('click', () => {
      const spaceId = card.dataset.spaceId;
      openSpace(spaceId);
    });
  });
}

async function renderThreadList() {
  if (!currentSpaceId) return;

  const threads = await loadThreads(currentSpaceId);

  // Sort by updatedAt descending
  threads.sort((a, b) => b.updatedAt - a.updatedAt);

  if (threads.length === 0) {
    elements.threadList.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">No threads yet</p>';
    return;
  }

  elements.threadList.innerHTML = threads.map(thread => `
    <div class="thread-item ${thread.id === currentThreadId ? 'active' : ''}" data-thread-id="${thread.id}">
      <h4 class="thread-title">${escapeHtml(thread.title)}</h4>
      <span class="thread-time">${formatRelativeTime(thread.updatedAt)}</span>
      <div class="thread-menu menu-dropdown">
        <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu(this)">&#8942;</button>
        <div class="menu-items" style="display: none;">
          <button class="menu-item" onclick="event.stopPropagation(); openRenameModal('${thread.id}')">Rename</button>
          <button class="menu-item danger" onclick="event.stopPropagation(); openDeleteModal('thread', '${thread.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', () => {
      const threadId = item.dataset.threadId;
      openThread(threadId);
    });
  });
}

function renderChatMessages(messages) {
  if (!messages || messages.length === 0) {
    elements.chatMessages.innerHTML = '';
    return;
  }

  elements.chatMessages.innerHTML = messages.map(msg => `
    <div class="chat-message chat-message-${msg.role}">
      <div class="chat-bubble">${msg.role === 'assistant' ? applyMarkdownStyles(msg.content) : escapeHtml(msg.content)}</div>
    </div>
  `).join('');

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function renderStorageUsage() {
  const usage = await checkStorageUsage();

  elements.storageFill.style.width = `${Math.min(usage.percentUsed, 100)}%`;
  elements.storageText.textContent = `Using ${usage.formatted}`;

  // Update fill color based on usage
  elements.storageFill.classList.remove('warning', 'danger');
  if (usage.percentUsed >= 85) {
    elements.storageFill.classList.add('danger');
  } else if (usage.percentUsed >= 70) {
    elements.storageFill.classList.add('warning');
  }

  // Show warning banner if needed
  if (usage.percentUsed >= 95) {
    showStorageWarning('critical', 'Storage full. Delete threads to free space.');
  } else if (usage.percentUsed >= 85) {
    showStorageWarning('high', 'Storage almost full. Delete threads to continue using Spaces.');
  } else if (usage.percentUsed >= 70) {
    showStorageWarning('medium', 'Storage is filling up. Consider deleting old threads.');
  } else {
    hideStorageWarning();
  }
}

function showStorageWarning(level, message) {
  elements.storageWarning.className = `storage-warning ${level}`;
  elements.storageWarning.style.display = 'flex';
  elements.warningMessage.textContent = message;
}

function hideStorageWarning() {
  elements.storageWarning.style.display = 'none';
}

// ============ ESCAPE HTML ============

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

**Step 2: Verify file updated**

Run: Check `src/spaces/spaces.js` contains the UI functions.

Expected: File includes state management and rendering functions.

**Step 3: Commit**

```bash
git add src/spaces/spaces.js
git commit -m "feat(spaces): add UI state management and rendering"
```

---

## Task 9: Create Spaces JavaScript - Part 3 (Actions & Events)

**Files:**
- Modify: `src/spaces/spaces.js`

**Step 1: Add action handlers and event binding**

Append to `src/spaces/spaces.js`:

```javascript

// ============ ACTIONS ============

async function openSpace(spaceId) {
  const space = await getSpace(spaceId);
  if (!space) {
    showToast('Space not found', 'error');
    return;
  }

  currentSpaceId = spaceId;
  currentThreadId = null;

  elements.spaceTitle.textContent = space.name;
  elements.chatEmptyState.style.display = 'flex';
  elements.chatContainer.style.display = 'none';

  showView('space');
  await renderThreadList();
}

async function openThread(threadId) {
  const thread = await getThread(threadId);
  if (!thread) {
    showToast('Thread not found', 'error');
    return;
  }

  currentThreadId = threadId;

  elements.chatEmptyState.style.display = 'none';
  elements.chatContainer.style.display = 'flex';

  renderChatMessages(thread.messages);
  await renderThreadList(); // Update active state
}

async function createNewThread() {
  if (!currentSpaceId) return;

  const thread = await createThread(currentSpaceId);
  await renderThreadList();
  openThread(thread.id);
  showToast('New thread created', 'success');
}

function toggleMenu(button) {
  // Close all other menus
  document.querySelectorAll('.menu-items').forEach(menu => {
    if (menu !== button.nextElementSibling) {
      menu.style.display = 'none';
    }
  });

  const menu = button.nextElementSibling;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-dropdown')) {
    document.querySelectorAll('.menu-items').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});

// ============ MODAL HANDLERS ============

function openCreateSpaceModal() {
  editingSpaceId = null;
  elements.modalTitle.textContent = 'Create Space';
  elements.modalSave.textContent = 'Create Space';
  elements.spaceForm.reset();
  elements.spaceModal.style.display = 'flex';
  elements.spaceName.focus();
}

async function openEditSpaceModal(spaceId) {
  const space = await getSpace(spaceId);
  if (!space) return;

  editingSpaceId = spaceId;
  elements.modalTitle.textContent = 'Edit Space';
  elements.modalSave.textContent = 'Save Changes';

  elements.spaceName.value = space.name;
  elements.spaceDescription.value = space.description;
  elements.spaceModel.value = space.model;
  elements.spaceInstructions.value = space.customInstructions;

  elements.spaceModal.style.display = 'flex';
  elements.spaceName.focus();
}

function closeSpaceModal() {
  elements.spaceModal.style.display = 'none';
  editingSpaceId = null;
}

async function handleSpaceFormSubmit(e) {
  e.preventDefault();

  const data = {
    name: elements.spaceName.value.trim(),
    description: elements.spaceDescription.value.trim(),
    model: elements.spaceModel.value,
    customInstructions: elements.spaceInstructions.value.trim()
  };

  if (!data.name) {
    showToast('Name is required', 'error');
    return;
  }

  try {
    if (editingSpaceId) {
      await updateSpace(editingSpaceId, data);
      showToast('Space updated', 'success');

      // Update title if viewing this space
      if (currentSpaceId === editingSpaceId) {
        elements.spaceTitle.textContent = data.name;
      }
    } else {
      await createSpace(data);
      showToast('Space created', 'success');
    }

    closeSpaceModal();
    await renderSpacesList();
    await renderStorageUsage();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openRenameModal(threadId) {
  const thread = await getThread(threadId);
  if (!thread) return;

  renamingThreadId = threadId;
  elements.threadTitle.value = thread.title;
  elements.renameModal.style.display = 'flex';
  elements.threadTitle.focus();
  elements.threadTitle.select();
}

function closeRenameModal() {
  elements.renameModal.style.display = 'none';
  renamingThreadId = null;
}

async function handleRenameFormSubmit(e) {
  e.preventDefault();

  const title = elements.threadTitle.value.trim();
  if (!title) {
    showToast('Title is required', 'error');
    return;
  }

  try {
    await updateThread(renamingThreadId, { title });
    showToast('Thread renamed', 'success');
    closeRenameModal();
    await renderThreadList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openDeleteModal(type, id) {
  deletingItem = { type, id };

  if (type === 'space') {
    const space = await getSpace(id);
    const threadCount = await getThreadCount(id);
    elements.deleteTitle.textContent = 'Delete Space';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${space.name}" and all its threads?`;
    elements.deleteSize.textContent = `This will delete ${threadCount} thread${threadCount !== 1 ? 's' : ''}.`;
  } else {
    const thread = await getThread(id);
    const size = await estimateItemSize(thread);
    elements.deleteTitle.textContent = 'Delete Thread';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${thread.title}"?`;
    elements.deleteSize.textContent = `This will free ~${(size / 1024).toFixed(1)}KB.`;
  }

  elements.deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  elements.deleteModal.style.display = 'none';
  deletingItem = null;
}

async function handleDeleteConfirm() {
  if (!deletingItem) return;

  try {
    if (deletingItem.type === 'space') {
      await deleteSpace(deletingItem.id);
      showToast('Space deleted', 'success');

      if (currentSpaceId === deletingItem.id) {
        showView('list');
      }
      await renderSpacesList();
    } else {
      await deleteThread(deletingItem.id);
      showToast('Thread deleted', 'success');

      if (currentThreadId === deletingItem.id) {
        currentThreadId = null;
        elements.chatEmptyState.style.display = 'flex';
        elements.chatContainer.style.display = 'none';
      }
      await renderThreadList();
    }

    closeDeleteModal();
    await renderStorageUsage();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============ MODEL LOADING ============

async function loadModels() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_models' });
    if (response.ok && response.models) {
      const currentModel = (await chrome.storage.local.get([STORAGE_KEYS.MODEL]))[STORAGE_KEYS.MODEL] || '';

      elements.spaceModel.innerHTML = '<option value="">Use default model</option>' +
        response.models.map(m =>
          `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${m.name}</option>`
        ).join('');
    }
  } catch (err) {
    console.error('Error loading models:', err);
  }
}

// ============ EVENT BINDINGS ============

function bindEvents() {
  // Create space buttons
  elements.createSpaceBtn.addEventListener('click', openCreateSpaceModal);
  elements.emptyCreateBtn.addEventListener('click', openCreateSpaceModal);

  // Space modal
  elements.modalClose.addEventListener('click', closeSpaceModal);
  elements.modalCancel.addEventListener('click', closeSpaceModal);
  elements.spaceForm.addEventListener('submit', handleSpaceFormSubmit);

  // Rename modal
  elements.renameModalClose.addEventListener('click', closeRenameModal);
  elements.renameCancel.addEventListener('click', closeRenameModal);
  elements.renameForm.addEventListener('submit', handleRenameFormSubmit);

  // Delete modal
  elements.deleteModalClose.addEventListener('click', closeDeleteModal);
  elements.deleteCancel.addEventListener('click', closeDeleteModal);
  elements.deleteConfirm.addEventListener('click', handleDeleteConfirm);

  // Storage warning
  elements.warningClose.addEventListener('click', hideStorageWarning);

  // Space view
  elements.backBtn.addEventListener('click', async () => {
    showView('list');
    await renderSpacesList();
  });

  elements.spaceSettingsBtn.addEventListener('click', () => {
    if (currentSpaceId) {
      openEditSpaceModal(currentSpaceId);
    }
  });

  elements.newThreadBtn.addEventListener('click', createNewThread);

  // Close modals on backdrop click
  [elements.spaceModal, elements.renameModal, elements.deleteModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSpaceModal();
      closeRenameModal();
      closeDeleteModal();
    }
  });
}
```

**Step 2: Verify file updated**

Run: Check `src/spaces/spaces.js` contains event handlers.

Expected: File includes all modal and action handlers.

**Step 3: Commit**

```bash
git add src/spaces/spaces.js
git commit -m "feat(spaces): add action handlers and event bindings"
```

---

## Task 10: Create Spaces JavaScript - Part 4 (Chat & Streaming)

**Files:**
- Modify: `src/spaces/spaces.js`

**Step 1: Add chat functionality with streaming**

Append to `src/spaces/spaces.js`:

```javascript

// ============ CHAT FUNCTIONALITY ============

async function sendMessage() {
  const content = elements.chatInput.value.trim();
  if (!content || !currentThreadId || !currentSpaceId || isStreaming) return;

  const space = await getSpace(currentSpaceId);
  if (!space) return;

  // Add user message to thread
  await addMessageToThread(currentThreadId, {
    role: 'user',
    content
  });

  // Clear input
  elements.chatInput.value = '';
  elements.chatInput.style.height = 'auto';

  // Re-render messages
  const thread = await getThread(currentThreadId);
  renderChatMessages(thread.messages);

  // Show typing indicator
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'chat-message chat-message-assistant';
  typingIndicator.id = 'typing-indicator';
  typingIndicator.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  elements.chatMessages.appendChild(typingIndicator);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // Show stop button, hide send
  elements.sendBtn.style.display = 'none';
  elements.stopBtn.style.display = 'block';
  isStreaming = true;

  // Start streaming
  try {
    await streamMessage(content, space, thread);
  } catch (err) {
    console.error('Stream error:', err);
    showToast(err.message || 'Failed to send message', 'error');
  } finally {
    // Remove typing indicator
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();

    // Restore buttons
    elements.sendBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    isStreaming = false;

    await renderThreadList();
  }
}

async function streamMessage(content, space, thread) {
  return new Promise((resolve, reject) => {
    // Create port for streaming
    streamPort = chrome.runtime.connect({ name: 'streaming' });

    let fullContent = '';
    let assistantBubble = null;

    // Remove typing indicator and add empty assistant message
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message chat-message-assistant';
    messageDiv.innerHTML = '<div class="chat-bubble"></div>';
    assistantBubble = messageDiv.querySelector('.chat-bubble');
    elements.chatMessages.appendChild(messageDiv);

    streamPort.onMessage.addListener(async (msg) => {
      if (msg.type === 'content') {
        fullContent += msg.content;
        assistantBubble.innerHTML = applyMarkdownStyles(fullContent);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
      } else if (msg.type === 'complete') {
        // Save assistant message to thread
        await addMessageToThread(currentThreadId, {
          role: 'assistant',
          content: fullContent
        });

        streamPort.disconnect();
        streamPort = null;
        resolve();
      } else if (msg.type === 'error') {
        streamPort.disconnect();
        streamPort = null;
        reject(new Error(msg.error));
      }
    });

    streamPort.onDisconnect.addListener(() => {
      streamPort = null;
      if (isStreaming) {
        resolve(); // Might be stopped by user
      }
    });

    // Build messages array with custom instructions
    const messages = [];
    if (space.customInstructions) {
      messages.push({ role: 'system', content: space.customInstructions });
    }
    messages.push(...thread.messages);

    // Send stream request
    streamPort.postMessage({
      type: 'start_stream',
      prompt: content,
      messages: messages,
      model: space.model || null,
      webSearch: false,
      reasoning: false,
      tabId: `space_${space.id}`
    });
  });
}

function stopStreaming() {
  if (streamPort) {
    streamPort.disconnect();
    streamPort = null;
  }
  isStreaming = false;
  elements.sendBtn.style.display = 'block';
  elements.stopBtn.style.display = 'none';
  showToast('Generation stopped', 'info');
}

// ============ CHAT INPUT HANDLERS ============

function setupChatInput() {
  // Auto-resize textarea
  elements.chatInput.addEventListener('input', () => {
    elements.chatInput.style.height = 'auto';
    elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 200) + 'px';
  });

  // Send on Enter (Shift+Enter for new line)
  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button
  elements.sendBtn.addEventListener('click', sendMessage);

  // Stop button
  elements.stopBtn.addEventListener('click', stopStreaming);
}

// ============ INITIALIZATION ============

async function init() {
  initElements();
  bindEvents();
  setupChatInput();

  // Initialize theme
  if (typeof initTheme === 'function') {
    initTheme();
  }

  // Load data
  await loadModels();
  await renderSpacesList();
  await renderStorageUsage();

  showView('list');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
```

**Step 2: Verify file updated**

Run: Check `src/spaces/spaces.js` contains chat functionality.

Expected: File includes streaming chat and initialization.

**Step 3: Commit**

```bash
git add src/spaces/spaces.js
git commit -m "feat(spaces): add chat streaming and initialization"
```

---

## Task 11: Update Background Script for Spaces

**Files:**
- Modify: `src/background/background.js`

**Step 1: Update the streaming function to accept custom messages array**

Find the `streamOpenRouterResponse` function (around line 635). Modify it to accept and use a custom messages array when provided.

In the streaming port message handler (around line 616), update to accept custom messages:

```javascript
port.onMessage.addListener(async (msg) => {
  if (msg.type === 'start_stream') {
    try {
      await streamOpenRouterResponse(
        msg.prompt,
        msg.webSearch,
        msg.reasoning,
        msg.tabId,
        port,
        () => isDisconnected,
        msg.messages,  // Custom messages array (for Spaces)
        msg.model      // Custom model (for Spaces)
      );
    } catch (e) {
      // ... existing error handling
    }
  }
});
```

**Step 2: Update streamOpenRouterResponse function signature**

Modify the function to accept optional messages array and model override:

```javascript
async function streamOpenRouterResponse(prompt, webSearch, reasoning, tabId, port, isDisconnectedFn, customMessages = null, customModel = null) {
  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }

  // ... safeSendMessage helper stays the same ...

  // Use custom messages if provided (for Spaces), otherwise use conversation context
  let context;
  if (customMessages) {
    // Spaces mode: use provided messages array
    context = [...customMessages];
    // Add the new user message
    context.push({ role: "user", content: prompt });
  } else {
    // Sidebar mode: use per-tab context
    context = conversationContexts.get(tabId) || [];
    context.push({ role: "user", content: prompt });

    if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
    }
    conversationContexts.set(tabId, context);
  }

  // Use custom model if provided, otherwise use config model
  let modelName = customModel || cfg.model || DEFAULTS.MODEL;
  if (webSearch && !modelName.endsWith(':online')) {
    modelName = `${modelName}:online`;
  }

  // ... rest of the function stays the same, but skip context saving for Spaces ...

  // Near the end, only save to sidebar context if not using customMessages
  if (!customMessages) {
    context.push({ role: "assistant", content: fullContent });
    if (context.length > DEFAULTS.MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - DEFAULTS.MAX_CONTEXT_MESSAGES);
    }
    conversationContexts.set(tabId, context);
    await addHistoryEntry(prompt, fullContent);
  }

  // ... rest stays the same ...
}
```

**Step 3: Verify changes**

Run: Reload extension, check service worker logs for errors.

Expected: No errors, streaming still works in sidebar.

**Step 4: Commit**

```bash
git add src/background/background.js
git commit -m "feat(spaces): extend streaming to support custom messages and model"
```

---

## Task 12: Add Light Theme Support to Sidebar Home Button

**Files:**
- Modify: `src/modules/theme.js`

**Step 1: Add light theme styles for spaces button**

Find the light theme styles section and add:

```css
body.theme-light #spaces-btn {
  background: #f9fafb;
  border-color: #e5e7eb;
}

body.theme-light #spaces-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

body.theme-light #spaces-btn svg {
  fill: #6b7280;
}
```

**Step 2: Verify styling**

Run: Open sidebar, switch to light theme, check home button appearance.

Expected: Home button has proper light theme styling.

**Step 3: Commit**

```bash
git add src/modules/theme.js
git commit -m "feat(spaces): add light theme support for home button"
```

---

## Task 13: Integration Testing

**Files:**
- No new files, manual testing

**Step 1: Test Spaces list view**

1. Click Home button in sidebar
2. Verify Spaces page opens in new tab
3. Click "Create Space" button
4. Fill in name, description, select model, add instructions
5. Click Create
6. Verify space card appears

Expected: Space created and displayed correctly.

**Step 2: Test Space view and threads**

1. Click on a space card
2. Verify two-panel layout appears
3. Click "New Thread"
4. Type a message and send
5. Verify streaming response appears
6. Verify thread title auto-generates

Expected: Chat works with streaming, thread saved.

**Step 3: Test thread management**

1. Create multiple threads
2. Switch between threads
3. Rename a thread
4. Delete a thread
5. Verify changes persist after page reload

Expected: All CRUD operations work correctly.

**Step 4: Test storage warnings**

1. Open Chrome DevTools
2. In Console, run: `chrome.storage.local.getBytesInUse(console.log)`
3. Verify storage meter shows correct usage
4. (Optional) Create many threads to approach limits

Expected: Storage UI updates correctly.

**Step 5: Test theme sync**

1. Change theme in sidebar options
2. Reload Spaces page
3. Verify theme matches

Expected: Theme consistent across pages.

**Step 6: Commit test results**

If all tests pass:

```bash
git add -A
git commit -m "feat(spaces): complete Spaces feature implementation

- Add Home button to sidebar header
- Create full-page Spaces experience
- Implement space and thread CRUD
- Add streaming chat with custom instructions
- Add storage monitoring with warnings
- Support light/dark themes"
```

---

## Task 14: Final Cleanup and Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md` (if needed)

**Step 1: Update README with Spaces feature**

Add to the Features section:

```markdown
### Spaces (NEW)
- 🏠 **Spaces** - Organize conversations by project or topic
- 📁 **Multiple Threads** - Create and manage threads within each space
- ⚙️ **Custom Instructions** - Set AI behavior per space
- 🤖 **Per-Space Models** - Choose different models for different projects
- 💾 **Persistent Storage** - All conversations saved locally
- 📊 **Storage Monitoring** - Visual usage tracking with warnings
```

**Step 2: Update CLAUDE.md if architecture changed**

Add any new file paths or patterns discovered during implementation.

**Step 3: Commit documentation**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add Spaces feature to documentation"
```

---

## Summary

This implementation plan covers:

1. **Tasks 1-4**: Add Home button to sidebar
2. **Tasks 5-6**: Create Spaces page structure and styling
3. **Tasks 7-10**: Implement Spaces JavaScript (storage, UI, actions, chat)
4. **Task 11**: Extend background script for custom messages
5. **Task 12**: Add theme support
6. **Tasks 13-14**: Testing and documentation

Total: 14 tasks, ~50 individual steps

Each task is atomic and can be committed independently. The implementation follows TDD principles where applicable and maintains the existing codebase patterns.


