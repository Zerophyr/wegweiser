# Undo Toast Pattern Design

**Date:** 2026-01-16
**Status:** Implemented

## Problem

Native browser `confirm()` dialogs are intrusive and break user flow when clearing answers or deleting history.

## Solution

Replace confirmation dialogs with an "undo toast" pattern: execute immediately, show a toast with "Undo" button for 5 seconds.

## Implementation

### Toast Enhancement (`src/modules/toast.js`)

Extended `showToast()` to accept an options object with optional action button:

```javascript
showToast('Message', 'info', {
  duration: 5000,
  action: { label: 'Undo', onClick: () => restore() }
});
```

- Backwards compatible with legacy `showToast(msg, type, duration)` signature
- Action button styled as underlined link
- Clicking action dismisses toast and calls callback
- `removeToast()` handles already-removed toasts gracefully

### Sidepanel Clear Answers (`src/sidepanel/sidepanel.js`)

1. Store current HTML in `savedAnswersHtml`
2. Clear UI immediately
3. Show undo toast (5 seconds)
4. On timeout: clear conversation context in background
5. On undo: restore HTML, cancel timeout

### Options - Single Delete (`src/options/options.js`)

1. If previous pending delete exists, commit it first
2. Remove item from DOM
3. Show undo toast (5 seconds)
4. On timeout: persist deletion to storage
5. On undo: reload history list

### Options - Clear All History (`src/options/options.js`)

1. Commit any pending single delete
2. Clear list UI
3. Show undo toast with item count
4. On timeout: persist empty array
5. On undo: reload history list

## Files Changed

- `src/modules/toast.js` - Added action button support
- `src/sidepanel/sidepanel.js` - Undo pattern for clear answers
- `src/options/options.js` - Undo pattern for delete/clear history
- `tests/toast.test.ts` - Tests for action button feature

## Test Coverage

109 tests passing, including 8 new tests for action button functionality.
