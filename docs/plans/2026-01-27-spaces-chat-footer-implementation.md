# Spaces Chat Footer + Loading Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent streaming bubble in Spaces with a sidebar-style footer that shows model, tokens, response time, context badge, and token usage bar.

**Architecture:** Extend Spaces chat rendering to support optional `meta` on assistant messages and render a footer when present. During streaming, create a live assistant bubble with typing dots and update it in place as chunks arrive and when completion metadata is received. Persist metadata with the assistant message so it survives reload.

**Tech Stack:** Chrome MV3 extension, vanilla JS, DOM APIs, Jest, CSS.

---

### Task 1: Add shared token bar helper + tests

**Files:**
- Modify: `src/shared/utils.js`
- Modify: `tests/utils.test.ts`

**Step 1: Write the failing test**

Add tests for a new helper that computes token bar percentage and gradient.

```ts
import { getTokenBarStyle } from "../src/shared/utils";

test("getTokenBarStyle returns 0% and green for null tokens", () => {
  const res = getTokenBarStyle(null, 4000);
  expect(res.percent).toBe(0);
  expect(res.gradient).toContain("#22c55e");
});

test("getTokenBarStyle returns yellow for mid usage", () => {
  const res = getTokenBarStyle(2400, 4000);
  expect(res.percent).toBe(60);
  expect(res.gradient).toContain("#eab308");
});

test("getTokenBarStyle returns red for high usage", () => {
  const res = getTokenBarStyle(3600, 4000);
  expect(res.percent).toBe(90);
  expect(res.gradient).toContain("#ef4444");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils.test.ts`
Expected: FAIL with missing export `getTokenBarStyle`.

**Step 3: Write minimal implementation**

In `src/shared/utils.js` add:

```js
function getTokenBarStyle(tokens, maxTokens = 4000) {
  if (!tokens || !maxTokens) {
    return { percent: 0, gradient: 'linear-gradient(90deg, #22c55e, #16a34a)' };
  }
  const percent = Math.round(Math.min((tokens / maxTokens) * 100, 100));
  let gradient = 'linear-gradient(90deg, #22c55e, #16a34a)';
  if (percent >= 80) {
    gradient = 'linear-gradient(90deg, #ef4444, #dc2626)';
  } else if (percent >= 50) {
    gradient = 'linear-gradient(90deg, #eab308, #ca8a04)';
  }
  return { percent, gradient };
}
```

Ensure it is exported in the module pattern used in `utils.js`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/utils.js tests/utils.test.ts
git commit -m "feat: add token bar style helper"
```

---

### Task 2: Render assistant footer in Spaces

**Files:**
- Modify: `src/spaces/spaces.js`
- Modify: `src/spaces/spaces.css`

**Step 1: Write the failing test**

Add a minimal JSDOM test in a new file to validate HTML structure for assistant messages with `meta`. Create `tests/spaces-render.test.ts` with a simple DOM, then call `renderChatMessages` (you may need to expose it on `window` in `spaces.js` for testing).

```ts
import "../src/spaces/spaces.js";

test("assistant messages with meta render footer", () => {
  document.body.innerHTML = '<div id="chat-messages"></div>';
  window.renderChatMessages([
    { role: 'assistant', content: 'Hi', meta: { model: 'openai/gpt-4o-mini', tokens: 10, responseTimeSec: 1.2, contextSize: 4, createdAt: Date.now() } }
  ]);
  const footer = document.querySelector('.chat-footer');
  expect(footer).not.toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/spaces-render.test.ts`
Expected: FAIL because `renderChatMessages` is not exposed and/or footer not rendered.

**Step 3: Implement rendering**

In `src/spaces/spaces.js`:
- Add `window.renderChatMessages = renderChatMessages;` (only in non-production or behind a guard) so tests can call it.
- Update `renderChatMessages` to include optional `.chat-meta` and `.chat-footer` blocks when `msg.meta` exists.
- Include `answer-time`, `answer-tokens`, and `answer-context-badge` equivalents for Spaces (class names can be `.chat-time`, `.chat-tokens`, `.chat-context-badge`).
- Use `getTokenBarStyle` for the token bar width and gradient.

**Step 4: Add CSS**

In `src/spaces/spaces.css`, add styles for `.chat-meta`, `.chat-footer`, `.chat-stats`, `.token-usage-bar`, `.token-usage-fill` mirroring the sidebar sizes and colors.

**Step 5: Run tests**

Run: `npm test -- tests/spaces-render.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/spaces/spaces.js src/spaces/spaces.css tests/spaces-render.test.ts
git commit -m "feat(spaces): render assistant footer metadata"
```

---

### Task 3: Streaming bubble + metadata persistence

**Files:**
- Modify: `src/spaces/spaces.js`

**Step 1: Write the failing test**

Add a test to ensure `meta` is persisted when streaming completes. Mock `addMessageToThread` and confirm it receives `meta`.

```ts
// in tests/spaces-render.test.ts

test("assistant messages persist meta on completion", async () => {
  const meta = { model: 'openai/gpt-4o-mini', tokens: 12, responseTimeSec: 0.8, contextSize: 4 };
  // call a new helper that builds assistant message object and returns it
  const msg = window.buildAssistantMessage('Hello', meta);
  expect(msg.meta).toEqual(meta);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/spaces-render.test.ts`
Expected: FAIL because helper not defined.

**Step 3: Implement streaming changes**

In `src/spaces/spaces.js`:
- Add a small helper `buildAssistantMessage(content, meta)` for testability.
- In `sendMessage`, replace the standalone typing indicator with creation of a streaming assistant bubble via a new function `createStreamingAssistantMessage()` that returns references to DOM nodes.
- Track `startTime` for response time calculation.
- In `streamMessage`, update the bubble in place as chunks arrive. On `complete`, compute `responseTimeSec`, build the `meta`, update the DOM, and call `addMessageToThread` with `{ role: 'assistant', content: fullContent, meta }`.

**Step 4: Run tests**

Run: `npm test -- tests/spaces-render.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/spaces/spaces.js tests/spaces-render.test.ts
git commit -m "feat(spaces): persist model/tokens metadata"
```

---

### Task 4: Full test run

**Step 1: Run all tests**

Run: `npm test`
Expected: PASS.

**Step 2: Commit (if needed)**

```bash
git status --short
```
If any changes remain (e.g., snapshots), commit them.

---

### Task 5: Manual verification checklist

- Open `chrome://extensions`, load unpacked from the worktree.
- Open Spaces, select a thread, send a message.
- Verify a typing bubble appears immediately.
- When complete, verify model and tokens display in the footer, token bar is filled with color, and the footer persists after reload.

---
