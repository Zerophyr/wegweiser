# Spaces Archive + Summary Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve older Space messages in an expandable archive while keeping them out of the prompt, and show a “Summary updated” badge after successful summarization.

**Architecture:** When summary updates, move old messages into `thread.archivedMessages` and keep `thread.messages` as the live window. Render a collapsed archive toggle that loads full bubbles on demand. Badge appears briefly after summary refresh.

**Tech Stack:** Chrome MV3 extension, plain JS, Jest.

---

### Task 1: Add archive data model + helpers

**Files:**
- Modify: `src/spaces/spaces.js`
- Test: `tests/spaces-archive.test.ts`

**Step 1: Write the failing test**

```javascript
const win = window;

function loadSpaces() {
  if (win.__SPACES_LOADED__) return;
  win.__TEST__ = true;
  require("../src/spaces/spaces.js");
  win.__SPACES_LOADED__ = true;
}

describe("spaces archive helpers", () => {
  beforeEach(() => {
    loadSpaces();
  });

  test("appendArchivedMessages appends in order", () => {
    const current = [{ role: "user", content: "a" }];
    const incoming = [{ role: "assistant", content: "b" }];
    const result = win.appendArchivedMessages?.(current, incoming) || [];
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe("b");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/spaces-archive.test.ts`
Expected: FAIL (helper missing)

**Step 3: Write minimal implementation**

```javascript
function appendArchivedMessages(currentArchive, newMessages) {
  const safeCurrent = Array.isArray(currentArchive) ? currentArchive : [];
  const safeNew = Array.isArray(newMessages) ? newMessages : [];
  return [...safeCurrent, ...safeNew];
}
```

Expose in `window.__TEST__`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/spaces-archive.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/spaces-archive.test.ts src/spaces/spaces.js
git commit -m "test: add archive helper"
```

---

### Task 2: Archive old messages during summarization

**Files:**
- Modify: `src/spaces/spaces.js`
- Test: `tests/spaces-archive.test.ts`

**Step 1: Write the failing test**

```javascript
test("summarization moves old messages to archive", () => {
  const thread = {
    messages: Array.from({ length: 14 }).map((_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` })),
    summary: "",
    archivedMessages: []
  };
  const { historyToSummarize, liveMessages } = win.splitMessagesForSummary?.(thread.messages, 12);
  const updatedArchive = win.appendArchivedMessages?.(thread.archivedMessages, historyToSummarize);
  expect(updatedArchive).toHaveLength(2);
  expect(liveMessages).toHaveLength(12);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/spaces-archive.test.ts`
Expected: FAIL until helper exposed and test added

**Step 3: Implement in `sendMessage`**

- When summary updates successfully, move `historyToSummarize` into `thread.archivedMessages` via `appendArchivedMessages`.
- Save `archivedMessages` and `archivedUpdatedAt` in the thread.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/spaces-archive.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/spaces/spaces.js tests/spaces-archive.test.ts
git commit -m "feat: archive old space messages"
```

---

### Task 3: Render archived messages toggle + badge

**Files:**
- Modify: `src/spaces/spaces.js`
- Modify: `src/spaces/spaces.css`
- Test: `tests/spaces-archive.test.ts`

**Step 1: Write the failing test**

```javascript
test("renderChatMessages shows archive toggle when archivedMessages exist", () => {
  document.body.innerHTML = '<div id="chat-messages"></div>';
  win.renderChatMessages?.([
    { role: "assistant", content: "Hi", meta: { createdAt: Date.now() } }
  ], { archivedMessages: [{ role: "user", content: "Old" }] });
  expect(document.querySelector('.chat-archive-toggle')).not.toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/spaces-archive.test.ts`
Expected: FAIL

**Step 3: Implement rendering**

- Add an optional `thread` argument to `renderChatMessages(messages, thread)`.
- If `thread.archivedMessages?.length`, render a collapsed archive block with toggle.
- On toggle open: render full bubbles for archived messages (reuse `renderChatMessages` logic or a new `renderArchivedMessages` helper).
- On close: remove archived DOM nodes.
- Add a “Summary updated” badge near summary indicator when `summaryUpdatedAt` is recent (<30s).

**Step 4: Run test to verify it passes**

Run: `npx jest tests/spaces-archive.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/spaces/spaces.js src/spaces/spaces.css tests/spaces-archive.test.ts
git commit -m "feat: render archive toggle and summary badge"
```

---

### Task 4: Final verification

**Step 1: Run full test suite**

Run: `npx jest`
Expected: PASS

**Step 2: Manual smoke test**

- Trigger summary and confirm old messages appear in archive toggle.
- Expand/collapse to verify bubbles render correctly.
- Confirm summary badge appears after update and fades.

---

## Notes
- Archived messages are never sent in the prompt.
- Keep DOM light by rendering archive content only when expanded.
