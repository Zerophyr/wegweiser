# Spaces Context Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single context icon near the Spaces chat input that opens a modal showing live context, summary, and optional archived messages.

**Architecture:** Implement a Spaces-only modal builder in `spaces.js` that reads thread data (summary, messages, archived). Add a UI button near chat input with a badge count based on live context size. No background calls required.

**Tech Stack:** Vanilla JS/HTML/CSS, Jest (jsdom)

---

### Task 1: Add context modal helpers + tests

**Files:**
- Modify: `src/spaces/spaces.js`
- Test: `tests/spaces-context-modal.test.ts`

**Step 1: Write the failing test**

```typescript
const { buildSpacesContextData } = require("../src/spaces/spaces.js");

test("buildSpacesContextData returns summary + live messages", () => {
  const thread = {
    summary: "Summary text",
    messages: [
      { role: "user", content: "A" },
      { role: "assistant", content: "B" },
      { role: "user", content: "C" }
    ],
    archivedMessages: [
      { role: "user", content: "Old" }
    ]
  };

  const result = buildSpacesContextData(thread);

  expect(result.summary).toBe("Summary text");
  expect(result.liveMessages.length).toBe(3);
  expect(result.archivedMessages.length).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/spaces-context-modal.test.ts`
Expected: FAIL (function missing)

**Step 3: Write minimal implementation**

```javascript
function buildSpacesContextData(thread) {
  const summary = thread?.summary || "";
  const liveMessages = Array.isArray(thread?.messages) ? thread.messages : [];
  const archivedMessages = Array.isArray(thread?.archivedMessages) ? thread.archivedMessages : [];
  return { summary, liveMessages, archivedMessages };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/spaces-context-modal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/spaces/spaces.js tests/spaces-context-modal.test.ts
git commit -m "feat: add spaces context data helper"
```

---

### Task 2: Add context icon near chat input + modal rendering

**Files:**
- Modify: `src/spaces/spaces.html`
- Modify: `src/spaces/spaces.css`
- Modify: `src/spaces/spaces.js`

**Step 1: Write the failing test**

```typescript
const { buildContextBadgeLabel } = require("../src/spaces/spaces.js");

test("buildContextBadgeLabel returns Q&A count", () => {
  expect(buildContextBadgeLabel(4)).toBe("2 Q&A");
  expect(buildContextBadgeLabel(1)).toBe("");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/spaces-context-modal.test.ts`
Expected: FAIL (helper missing)

**Step 3: Implement minimal UI + JS**

- Add a container near the chat input (e.g., `#spaces-context-viz`), similar in placement to sidepanel.
- Add a button with a badge element (hidden when <=2 messages).
- In `spaces.js`:
  - Add `buildContextBadgeLabel(contextSize)` and `updateSpacesContextButton(thread)`
  - Wire click handler to open modal (builds DOM with summary + live messages; archived section collapsible)
  - Use `buildSpacesContextData()` to populate

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/spaces-context-modal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/spaces/spaces.html src/spaces/spaces.css src/spaces/spaces.js tests/spaces-context-modal.test.ts
git commit -m "feat: add spaces context modal"
```

---

### Task 3: Visual polish + memory usage bar

**Files:**
- Modify: `src/spaces/spaces.css`
- Modify: `src/spaces/spaces.js`

**Step 1: Implement memory usage bar**

- Add a small bar in the modal footer (messages count / MAX_CONTEXT_MESSAGES)
- Show a warning text when > 75%

**Step 2: Manual check**

- Open Spaces, send two messages, click context icon
- Verify summary section appears if summary exists
- Verify archived section toggles open/closed

**Step 3: Commit**

```bash
git add src/spaces/spaces.css src/spaces/spaces.js
git commit -m "style: add spaces context usage bar"
```

---

### Task 4: Final verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 2: Manual smoke test**

- Confirm icon shows near chat input and updates after responses
- Ensure it stays hidden/inactive when no context exists
- Verify no conflicts with summarization flow

**Step 3: Commit final fixes (if any)**

```bash
git add -A
git commit -m "chore: finalize spaces context modal"
```
