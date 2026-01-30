# Image Generation (Final Image) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single-image generation mode (OpenRouter + NagaAI) with compact cards, download, and 3‑hour cache in side panel and Spaces.

**Architecture:** Add a background handler for a new image message type, a shared image-cache helper around chrome.storage.local, and UI helpers for compact cards plus full-size view (new tab in side panel, lightbox in Spaces). Only a text entry "Image generated" is persisted in history/threads.

**Tech Stack:** Chrome MV3 extension (JS), `chrome.storage.local`, `fetch`, DOM APIs, Jest (jsdom).

---

### Task 1: Add image cache helpers (TTL + storage) with tests

**Files:**
- Create: `src/shared/image-cache.js`
- Modify: `src/shared/constants.js`
- Test: `tests/image-cache.test.ts`

**Step 1: Write the failing test**

```ts
const {
  pruneExpiredImageCache,
  putImageCacheEntry,
  getImageCacheEntry
} = require("../src/shared/image-cache.js");
const { STORAGE_KEYS, CACHE_TTL } = require("../src/shared/constants.js");

describe("image cache", () => {
  beforeEach(() => {
    (global as any).chrome.storage.local.get.mockResolvedValue({
      [STORAGE_KEYS.IMAGE_CACHE]: {}
    });
    (global as any).chrome.storage.local.set.mockResolvedValue(undefined);
  });

  test("pruneExpiredImageCache drops expired entries", () => {
    const now = 1000;
    const cache = {
      a: { imageId: "a", expiresAt: now - 1 },
      b: { imageId: "b", expiresAt: now + 1 }
    };
    const pruned = pruneExpiredImageCache(cache, now);
    expect(pruned.a).toBeUndefined();
    expect(pruned.b).toBeDefined();
  });

  test("putImageCacheEntry writes entry with TTL", async () => {
    const entry = { imageId: "x", mimeType: "image/png", data: "data" };
    await putImageCacheEntry(entry, 1000);
    expect((global as any).chrome.storage.local.set).toHaveBeenCalled();
  });

  test("getImageCacheEntry returns null when expired", async () => {
    const now = 1000;
    (global as any).chrome.storage.local.get.mockResolvedValue({
      [STORAGE_KEYS.IMAGE_CACHE]: {
        x: { imageId: "x", expiresAt: now - 1 }
      }
    });
    const res = await getImageCacheEntry("x", now);
    expect(res).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/image-cache.test.ts`
Expected: FAIL with "Cannot find module ../src/shared/image-cache.js" or missing exports.

**Step 3: Write minimal implementation**

Create `src/shared/image-cache.js` with:
- `IMAGE_CACHE_TTL_MS = 3 * 60 * 60 * 1000` (or via `CACHE_TTL.IMAGE`)
- `pruneExpiredImageCache(cache, now = Date.now())`
- `getImageCacheEntry(imageId, now)`
- `putImageCacheEntry(entry, now)`
- `cleanupImageCache(now)`

Also add to `src/shared/constants.js`:
- `STORAGE_KEYS.IMAGE_CACHE = "or_image_cache"`
- `CACHE_TTL.IMAGE = 10_800_000` (3 hours)

Ensure `putImageCacheEntry`:
- loads cache via `chrome.storage.local.get`
- prunes expired entries
- writes updated cache via `chrome.storage.local.set`

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/image-cache.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/constants.js src/shared/image-cache.js tests/image-cache.test.ts
git commit -m "feat: add image cache helpers with TTL"
```

---

### Task 2: Add image request message type + background handler tests

**Files:**
- Modify: `src/shared/constants.js`
- Create: `tests/background-image.test.ts`

**Step 1: Write the failing test**

```ts
const { MESSAGE_TYPES } = require("../src/shared/constants.js");

describe("image message type", () => {
  test("IMAGE_QUERY constant exists", () => {
    expect(MESSAGE_TYPES.IMAGE_QUERY).toBe("image_query");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/background-image.test.ts`
Expected: FAIL (missing constant).

**Step 3: Implement constant**

Add `IMAGE_QUERY: "image_query"` to `MESSAGE_TYPES` in `src/shared/constants.js`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/background-image.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/constants.js tests/background-image.test.ts
git commit -m "feat: add image query message type"
```

---

### Task 3: Implement background image generation (OpenRouter + NagaAI) with tests

**Files:**
- Modify: `src/background/background.js`
- Modify: `src/shared/constants.js`
- Test: `tests/background-image.test.ts`

**Step 1: Extend the failing test**

```ts
describe("background image routing", () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    (global as any).chrome.storage.local.get.mockResolvedValue({
      or_provider: "openrouter",
      or_model_provider: "openrouter",
      or_api_key: "sk-test",
      or_model: "openai/dall-e-3"
    });
  });

  test("builds OpenRouter image request", async () => {
    // Require background after mocks
    require("../src/background/background.js");
    const handler = (global as any).__TEST__?.handleMessage;
    await handler({ type: "image_query", prompt: "cat", provider: "openrouter", model: "openai/dall-e-3" });
    expect((global as any).fetch).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/background-image.test.ts`
Expected: FAIL (no test hook / handler, no image routing).

**Step 3: Implement minimal handler + provider calls**

In `src/background/background.js`:
- Add a new message branch for `MESSAGE_TYPES.IMAGE_QUERY`.
- Add helper `callImageGeneration({ prompt, provider, model })`.
- For provider endpoints, consult official docs and implement:
  - OpenRouter images endpoint (likely `/images/generations`).
  - NagaAI images endpoint (per docs).
- Normalize response to `{ imageId, mimeType, dataBase64 }` (data URL or base64 string).
- Use existing auth header helper.

Add a test hook if `globalThis.__TEST__` is set to expose a `handleMessage` helper for unit tests.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/background-image.test.ts`
Expected: PASS with mocked fetch.

**Step 5: Commit**

```bash
git add src/background/background.js src/shared/constants.js tests/background-image.test.ts
git commit -m "feat: add background image generation handler"
```

---

### Task 4: Add shared image card UI helpers

**Files:**
- Create: `src/modules/image-cards.js`
- Modify: `src/sidepanel/sidepanel.html`
- Modify: `src/spaces/spaces.html`
- Test: `tests/image-cards.test.ts`

**Step 1: Write the failing test**

```ts
const { buildImageCard } = require("../src/modules/image-cards.js");

describe("image cards", () => {
  test("buildImageCard renders ready state with actions", () => {
    const el = buildImageCard({
      state: "ready",
      imageUrl: "data:image/png;base64,AAA",
      expiresAt: Date.now() + 1000,
      mode: "sidepanel"
    });
    expect(el.querySelector(".image-card")).not.toBeNull();
    expect(el.querySelector(".image-download-btn")).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/image-cards.test.ts`
Expected: FAIL (module missing).

**Step 3: Implement minimal module + wire scripts**

In `src/modules/image-cards.js`:
- Export `buildImageCard({ state, imageUrl, expiresAt, mode, onView, onDownload })`.
- Render DOM for states: `generating`, `ready`, `expired`, `error`.
- Provide TTL hint text for generating/ready.

Update `src/sidepanel/sidepanel.html` and `src/spaces/spaces.html` to load the new module before main scripts.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/image-cards.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/image-cards.js src/sidepanel/sidepanel.html src/spaces/spaces.html tests/image-cards.test.ts
git commit -m "feat: add shared image card helper"
```

---

### Task 5: Side panel image mode + card integration

**Files:**
- Modify: `src/sidepanel/sidepanel.html`
- Modify: `src/sidepanel/sidepanel.css`
- Modify: `src/sidepanel/sidepanel.js`

**Step 1: Write the failing test**

Add a small DOM test to verify the image toggle exists after initialization.

```ts
const fs = require("fs");
const path = require("path");

describe("sidepanel image toggle", () => {
  test("image toggle button exists", () => {
    const html = fs.readFileSync(path.join(__dirname, "../src/sidepanel/sidepanel.html"), "utf8");
    expect(html).toMatch(/image-toggle/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/sidepanel-image.test.ts`
Expected: FAIL (no image toggle).

**Step 3: Implement minimal UI + behavior**

- Add a toggle/button (with ARIA pressed state) near the existing toggles.
- Add CSS for `.image-toggle` + `.image-card` states using theme variables.
- In `sidepanel.js`, track `imageModeEnabled`.
- On send: if image mode, send `IMAGE_QUERY` and render generating card.
- On response: store via `putImageCacheEntry`, render ready card with View/Download; View opens new tab (`window.open`) with `noopener`.
- On error: render error state.
- Add a history-only entry: `Image generated`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/sidepanel-image.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/sidepanel/sidepanel.html src/sidepanel/sidepanel.css src/sidepanel/sidepanel.js tests/sidepanel-image.test.ts
git commit -m "feat: add sidepanel image mode"
```

---

### Task 6: Spaces image mode + lightbox

**Files:**
- Modify: `src/spaces/spaces.html`
- Modify: `src/spaces/spaces.css`
- Modify: `src/spaces/spaces.js`
- Test: `tests/spaces-image.test.ts`

**Step 1: Write the failing test**

```ts
const win = window as any;

describe("spaces image lightbox", () => {
  beforeEach(() => {
    win.__TEST__ = true;
    require("../src/spaces/spaces.js");
  });

  test("openImageLightbox attaches modal", () => {
    const { openImageLightbox } = win.__TEST__ || {};
    openImageLightbox?.("data:image/png;base64,AAA");
    expect(document.querySelector(".image-lightbox"))
      .not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/spaces-image.test.ts`
Expected: FAIL (no lightbox helper).

**Step 3: Implement minimal UI + behavior**

- Add image toggle to Spaces chat toolbar (mirroring side panel).
- Use `buildImageCard` for generating/ready/expired states.
- On click: open lightbox modal with full-size image and Download button.
- On expiration: show expired state.
- On send: `IMAGE_QUERY` if image mode; store only `Image generated` in thread messages.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/spaces-image.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/spaces/spaces.html src/spaces/spaces.css src/spaces/spaces.js tests/spaces-image.test.ts
git commit -m "feat: add spaces image mode with lightbox"
```

---

### Task 7: Wire image cache into UI + TTL cleanup

**Files:**
- Modify: `src/sidepanel/sidepanel.js`
- Modify: `src/spaces/spaces.js`
- Modify: `src/shared/image-cache.js`
- Test: `tests/image-cache.test.ts`

**Step 1: Extend failing test**

Add a test that `cleanupImageCache()` removes expired entries and persists the pruned cache.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/image-cache.test.ts`
Expected: FAIL (cleanup not implemented).

**Step 3: Implement cleanup + UI usage**

- Call `cleanupImageCache()` on app init (sidepanel + spaces).
- When rendering a card, call `getImageCacheEntry` to determine expired vs ready.
- If entry expired, show expired UI and disable actions.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/image-cache.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/image-cache.js src/sidepanel/sidepanel.js src/spaces/spaces.js tests/image-cache.test.ts
git commit -m "feat: hook image cache into UI"
```

---

### Task 8: End-to-end verification

**Files:**
- Modify: `docs/plans/2026-01-30-image-generation-implementation.md` (optional notes)

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 2: Manual smoke test (extension)**

- Load unpacked extension.
- Enable Image mode in side panel and generate image.
- Verify: generating card, ready card, new-tab view, download, expiry hint.
- Repeat in Spaces: lightbox opens, download works, expired state after TTL.

**Step 3: Commit (if any changes)**

```bash
git add -A
git commit -m "chore: verify image generation feature"
```

---

Plan complete and saved to `docs/plans/2026-01-30-image-generation-implementation.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
