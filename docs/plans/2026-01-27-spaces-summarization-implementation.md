# Spaces Summarization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add adaptive thread summarization in Spaces to cap token usage while preserving recent context.

**Architecture:** Maintain a per-thread rolling summary stored outside `messages`. When a thread exceeds the live window, summarize older messages into `thread.summary`, keep only the last N messages (N=12 when no summary, N=8 once summary exists), and send prompts with Space custom instructions + summary + live window.

**Tech Stack:** Chrome MV3 extension, plain JS, Jest (unit tests), chrome.storage.local.

---

### Task 1: Add pure helpers for window sizing + message splitting

**Files:**
- Modify: `src/spaces/spaces.js`
- Test: `tests/spaces-summarization.test.ts`

**Step 1: Write the failing test**

```javascript
const win = window;

function loadSpaces() {
  if (win.__SPACES_LOADED__) return;
  win.__TEST__ = true;
  require("../src/spaces/spaces.js");
  win.__SPACES_LOADED__ = true;
}

describe("spaces summarization helpers", () => {
  beforeEach(() => {
    loadSpaces();
  });

  test("getLiveWindowSize returns 12 when no summary", () => {
    expect(win.getLiveWindowSize?.(null)).toBe(12);
  });

  test("getLiveWindowSize returns 8 when summary exists", () => {
    expect(win.getLiveWindowSize?.("summary")).toBe(8);
  });

  test("splitMessagesForSummary separates history and live window", () => {
    const messages = Array.from({ length: 14 }).map((_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`
    }));
    const { historyToSummarize, liveMessages } = win.splitMessagesForSummary?.(messages, 12);
    expect(historyToSummarize).toHaveLength(2);
    expect(liveMessages).toHaveLength(12);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/spaces-summarization.test.ts`
Expected: FAIL (helpers not defined)

**Step 3: Write minimal implementation**

```javascript
function getLiveWindowSize(summary) {
  return summary ? 8 : 12;
}

function splitMessagesForSummary(messages, liveWindowSize) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  if (safeMessages.length <= liveWindowSize) {
    return { historyToSummarize: [], liveMessages: safeMessages };
  }
  const cutoffIndex = safeMessages.length - liveWindowSize;
  return {
    historyToSummarize: safeMessages.slice(0, cutoffIndex),
    liveMessages: safeMessages.slice(cutoffIndex)
  };
}
```

Expose helpers under `window.__TEST__`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/spaces-summarization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/spaces-summarization.test.ts src/spaces/spaces.js
git commit -m "test: add spaces summarization helpers"
```

---

### Task 2: Add summarization request path in background

**Files:**
- Modify: `src/shared/constants.js`
- Modify: `src/background/background.js`
- Test: `tests/utils.test.ts` (minimal sanity for prompt builder if needed)

**Step 1: Write the failing test**

Add a small test for a new helper `buildSummarizerMessages(summary, history)` (placed in `src/shared/utils.js` or `src/modules/sources.js` if preferred):

```javascript
const { buildSummarizerMessages } = require("../src/shared/utils.js");

test("buildSummarizerMessages includes system summary prompt", () => {
  const messages = buildSummarizerMessages("old", [{ role: "user", content: "hi" }]);
  expect(messages[0].role).toBe("system");
  expect(messages[0].content).toMatch(/summarize/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/utils.test.ts`
Expected: FAIL (helper missing)

**Step 3: Write minimal implementation**

In `src/shared/utils.js`:

```javascript
function buildSummarizerMessages(previousSummary, historyToSummarize) {
  const systemPrompt = [
    "You are a concise summarizer.",
    "Capture user goals, decisions, constraints, key facts, and open questions.",
    "Avoid long quotes and verbosity; keep only durable context."
  ].join(" ");

  const messages = [{ role: "system", content: systemPrompt }];
  if (previousSummary) {
    messages.push({ role: "system", content: `Summary so far:\n${previousSummary}` });
  }
  messages.push(...historyToSummarize);
  return messages;
}
```

Export it in `module.exports`.

Add a new message type in `src/shared/constants.js`:

```javascript
SUMMARIZE_THREAD: "summarize_thread"
```

In `src/background/background.js`, add a handler for `summarize_thread` that:
- Accepts `messages` + optional `model`.
- Calls OpenRouter with those messages and returns `{ ok: true, summary }`.
- Does NOT write to conversation context or history.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/utils.js src/shared/constants.js src/background/background.js tests/utils.test.ts
git commit -m "feat: add background summarization request"
```

---

### Task 3: Integrate summarization in Spaces send flow

**Files:**
- Modify: `src/spaces/spaces.js`
- Test: `tests/spaces-summarization.test.ts`

**Step 1: Write the failing test**

Extend `tests/spaces-summarization.test.ts`:

```javascript
test("buildStreamMessages includes summary as system message", () => {
  const result = win.buildStreamMessages?.([], "prompt", "custom", "summary");
  expect(result[0].role).toBe("system");
  expect(result[0].content).toMatch(/custom/i);
  expect(result[1].role).toBe("system");
  expect(result[1].content).toMatch(/Summary/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/spaces-summarization.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

In `src/spaces/spaces.js`:
- Extend `buildStreamMessages(messages, prompt, systemInstruction, summary)` to add summary as a system message after custom instructions.
- Add `thread.summary` + `thread.summaryUpdatedAt` when saving.
- In `sendMessage` after adding the user message:
  - Compute `liveWindowSize = getLiveWindowSize(thread.summary)`.
  - Use `splitMessagesForSummary` to split old vs. live.
  - If `historyToSummarize` has items and the user message is not extremely long, call background `summarize_thread` with `buildSummarizerMessages(thread.summary, historyToSummarize)`.
  - If response summary is valid (>= 200 chars), persist `thread.summary`, delete `historyToSummarize` from `thread.messages`, and keep only `liveMessages`.
  - If summary fails, leave messages unchanged and show a toast.
- When streaming, use `buildStreamMessages(thread.messages, content, space.customInstructions, thread.summary)`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/spaces-summarization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/spaces/spaces.js tests/spaces-summarization.test.ts
git commit -m "feat: summarize old space messages"
```

---

### Task 4: UX feedback + guardrails

**Files:**
- Modify: `src/spaces/spaces.js`

**Step 1: Write the failing test**

If no UI tests exist, add a small unit test asserting the summarization skip for long prompts:

```javascript
test("shouldSkipSummarization returns true for long prompts", () => {
  expect(win.shouldSkipSummarization?.("a".repeat(10000))).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/spaces-summarization.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Add `shouldSkipSummarization(prompt)` that estimates tokens by length (`Math.ceil(len / 4)`) and skips if > 2000.
- Add a lightweight toast “Updating summary…” before summarization.
- On failure, show `showToast("Summary update failed; continuing without it", "error")`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/spaces-summarization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/spaces/spaces.js tests/spaces-summarization.test.ts
git commit -m "feat: add summarization guardrails"
```

---

### Task 5: Final verification

**Step 1: Run full test suite**

Run: `npx jest`
Expected: PASS

**Step 2: Manual smoke test**

- Create a Space and a thread.
- Send 7+ turns to trigger summary creation.
- Verify older turns collapse into a summary and new prompts stay responsive.

**Step 3: Commit (if needed)**

```bash
git add -A
git commit -m "chore: verify spaces summarization"
```

---

## Notes
- Keep summary separate from `thread.messages`.
- Summary should be injected after Space custom instructions.
- Use a smaller live window once summary exists to reduce tokens.
