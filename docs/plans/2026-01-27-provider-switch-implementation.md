# Provider Switch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global provider switch (OpenRouter vs NagaAI) with separate API keys, provider-scoped models/favorites, and provider-aware API calls across sidepanel + Spaces.

**Architecture:** Introduce provider-aware config in the background service worker, and provider-scoped storage keys in the UI. Options selects the provider, background routes all API calls to the selected base URL, and UI loads models from that provider only.

**Tech Stack:** Chrome Extension (MV3), vanilla JS, Jest.

---

### Task 0: Baseline setup (worktree)

**Files:**
- None

**Step 1: Install dependencies**

Run: `npm install`
Expected: `added … packages` with no errors.

**Step 2: Run baseline tests**

Run: `npm test`
Expected: All tests pass. If failures are unrelated, stop and report before proceeding.

**Step 3: Commit any baseline fixes (if needed)**

Only if we must fix setup issues to proceed.

---

### Task 1: Provider helpers + tests (TDD)

**Files:**
- Modify: `src/shared/utils.js`
- Modify: `tests/utils.test.ts`

**Step 1: Write failing tests**

Add tests to `tests/utils.test.ts`:

```ts
const { getProviderLabel, normalizeProviderId, getProviderStorageKey, parseModelsResponse } = require("../src/shared/utils.js");

describe("provider helpers", () => {
  test("normalizeProviderId defaults to openrouter", () => {
    expect(normalizeProviderId(null)).toBe("openrouter");
    expect(normalizeProviderId("unknown")).toBe("openrouter");
  });

  test("getProviderLabel returns readable labels", () => {
    expect(getProviderLabel("openrouter")).toBe("OpenRouter");
    expect(getProviderLabel("naga"))?.toBe("NagaAI");
  });

  test("getProviderStorageKey returns scoped keys", () => {
    expect(getProviderStorageKey("or_model", "openrouter")).toBe("or_model_openrouter");
    expect(getProviderStorageKey("or_model", "naga")).toBe("or_model_naga");
  });

  test("parseModelsResponse handles OpenRouter and NagaAI shapes", () => {
    const or = parseModelsResponse({ data: [{ id: "openai/gpt-4o", name: "GPT-4o" }] });
    const naga = parseModelsResponse([{ id: "naga/gpt-4o", name: "GPT-4o" }]);
    expect(or[0].id).toBe("openai/gpt-4o");
    expect(naga[0].id).toBe("naga/gpt-4o");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test -- utils.test.ts`
Expected: FAIL with missing functions.

**Step 3: Implement minimal helpers**

Add to `src/shared/utils.js`:

```js
function normalizeProviderId(providerId) {
  if (providerId === 'openrouter' || providerId === 'naga') return providerId;
  return 'openrouter';
}

function getProviderLabel(providerId) {
  return normalizeProviderId(providerId) === 'naga' ? 'NagaAI' : 'OpenRouter';
}

function getProviderStorageKey(baseKey, providerId) {
  const provider = normalizeProviderId(providerId);
  return `${baseKey}_${provider}`;
}

function parseModelsResponse(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.data || []);
  return list.map(m => ({ id: m.id, name: m.name || m.id }));
}
```

Export in the CommonJS block at the bottom.

**Step 4: Run tests to verify pass**

Run: `npm test -- utils.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/utils.test.ts src/shared/utils.js
git commit -m "test: add provider helper utilities"
```

---

### Task 2: Provider-aware storage + Model dropdown keys

**Files:**
- Modify: `src/shared/constants.js`
- Modify: `src/modules/models-dropdown.js`

**Step 1: Add provider storage keys and config**

Update `src/shared/constants.js`:
- Add `STORAGE_KEYS.PROVIDER = "or_provider"`.
- Add `STORAGE_KEYS.API_KEY_NAGA = "naga_api_key"`.
- Add `STORAGE_KEYS.MODEL_OPENROUTER = "or_model_openrouter"` and `STORAGE_KEYS.MODEL_NAGA = "or_model_naga"`.
- Add provider-scoped favorites and recent models keys (use in UI).
- Add `PROVIDERS` map with base URLs and support flags.
- Update `ERROR_MESSAGES.NO_API_KEY` to be provider-generic.

**Step 2: Make ModelDropdownManager use configurable storage keys**

Update `src/modules/models-dropdown.js`:
- Add config options `favoritesKey` and `recentModelsKey` (default to existing keys).
- Replace hardcoded `or_favorites` and `or_recent_models` with config keys.

**Step 3: Quick manual check**

No existing tests for the dropdown; verify it still opens/closes and saving favorites writes the new key.

**Step 4: Commit**

```bash
git add src/shared/constants.js src/modules/models-dropdown.js
git commit -m "feat: add provider keys and dropdown storage config"
```

---

### Task 3: Background service worker provider routing

**Files:**
- Modify: `src/background/background.js`

**Step 1: Update config loading**

Refactor `loadConfig()` to:
- Read provider from `STORAGE_KEYS.PROVIDER` (default `openrouter`).
- Pick API key from `STORAGE_KEYS.API_KEY` or `STORAGE_KEYS.API_KEY_NAGA`.
- Pick model from `STORAGE_KEYS.MODEL_OPENROUTER` / `STORAGE_KEYS.MODEL_NAGA`.
- Cache provider in `cachedConfig` to avoid stale data.

**Step 2: Provider-aware API calls**

Update chat/summarize/stream to use provider base URL and headers from `PROVIDERS`:
- Use `PROVIDERS[provider].baseUrl`.
- Only add `:online` suffix for OpenRouter.
- Only add `X-Title` header for OpenRouter.
- For NagaAI streaming, set `stream_options: { include_usage: true }` so tokens show up.

**Step 3: Models and balance**

- Update `GET_MODELS` handler to use provider base URL, provider-scoped cache keys, and `parseModelsResponse` logic.
- Update balance handler to return `{ ok: true, supported: false }` for NagaAI. For OpenRouter, keep current behavior.

**Step 4: Add a `SET_PROVIDER` message**

Add a new message type to refresh cached config when provider changes:
- `MESSAGE_TYPES.SET_PROVIDER` in constants.
- Handler updates cachedConfig and clears balance/model caches.

**Step 5: Manual validation**

Verify logs show provider base URL and that model/cache selection changes when provider changes.

**Step 6: Commit**

```bash
git add src/background/background.js

git commit -m "feat: route background requests by provider"
```

---

### Task 4: Options UI for provider switch + provider-scoped models

**Files:**
- Modify: `src/options/options.html`
- Modify: `src/options/options.js`

**Step 1: Add provider dropdown in Options**

Add a select above API key with options:
- OpenRouter (value `openrouter`)
- NagaAI (value `naga`)

**Step 2: Update Options logic**

In `options.js`:
- Load provider from storage, set dropdown.
- Update API key label/placeholder based on provider.
- Load and save API key to provider-specific storage key.
- Load/save model to provider-specific key using `getProviderStorageKey`.
- Use `ModelDropdownManager` with provider-specific favorites/recent keys.
- Load models via background `get_models` (not direct fetch).
- On provider change: persist provider, call `SET_PROVIDER`, clear model input, reload models.

**Step 3: Manual validation**

Check:
- Switching provider changes label/placeholder.
- Different keys are preserved per provider.
- Model list reloads from selected provider.

**Step 4: Commit**

```bash
git add src/options/options.html src/options/options.js

git commit -m "feat: add provider switch to options"
```

---

### Task 5: Sidepanel + Spaces provider awareness

**Files:**
- Modify: `src/sidepanel/sidepanel.js`
- Modify: `src/spaces/spaces.js`

**Step 1: Sidepanel provider messaging**

- Read provider from storage, use `getProviderLabel` for status text.
- Update balance UI to render `Not supported` when background returns `supported: false`.
- Ensure model dropdown uses provider-scoped favorites/recent keys.

**Step 2: Spaces default model selection**

- Use provider-scoped default model key to set the “Use default model” selection.
- Ensure model load uses provider-scoped cache by relying on `get_models`.

**Step 3: Manual validation**

- Send message in sidepanel and Spaces with each provider selected.
- Confirm labels + balance behavior.

**Step 4: Commit**

```bash
git add src/sidepanel/sidepanel.js src/spaces/spaces.js

git commit -m "feat: provider-aware UI in sidepanel and spaces"
```

---

### Task 6: Manifest + docs and full test pass

**Files:**
- Modify: `manifest.json`
- Modify: `README.md` (if needed)

**Step 1: Add host permission**

Add: `"https://api.naga.ac/*"` to `host_permissions`.

**Step 2: Update README**

Document provider switch and NagaAI API key setup.

**Step 3: Run full tests**

Run: `npm test`
Expected: PASS.

**Step 4: Commit**

```bash
git add manifest.json README.md

git commit -m "docs: add NagaAI provider setup" 
```

---

### Task 7: Final verification

**Files:**
- None

**Step 1: Smoke test extension**

- Load unpacked extension.
- Switch provider in Options.
- Load models and send a message.
- Verify balance shows Not supported for NagaAI.

**Step 2: Report results**

Summarize any issues or fixes needed.
