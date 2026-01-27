# Multi-Provider Models Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow OpenRouter and NagaAI models to be used at the same time with prefixed display names (NG-/OR-), model-driven routing, and consistent favorites/ordering in both the sidebar and Spaces.

**Architecture:** Background builds a combined model list with provider + displayName metadata and routes API calls based on the selected model’s provider. UI surfaces prefixed display names only, stores the raw model id plus provider, and uses a single dropdown component for consistent sorting and favorites.

**Tech Stack:** MV3 Chrome extension (JavaScript), chrome.storage, Jest tests.

---

### Task 1: Add model naming + combined ID helpers

**Files:**
- Modify: `src/shared/utils.js:94-175`
- Modify: `src/shared/utils.js:320-340` (exports)
- Test: `tests/utils.test.ts`

**Step 1: Write the failing tests**

Add tests for new helpers (example assertions below).

```ts
describe("model display helpers", () => {
  const { getModelBaseName, buildModelDisplayName, buildCombinedModelId, parseCombinedModelId } = require("../src/shared/utils.js");

  test("getModelBaseName strips provider segments", () => {
    expect(getModelBaseName("anthropic/claude-3-opus")).toBe("claude-3-opus");
    expect(getModelBaseName("openai/gpt-4o")).toBe("gpt-4o");
    expect(getModelBaseName("mistral:latest")).toBe("latest");
  });

  test("buildModelDisplayName prefixes NG-/OR-", () => {
    expect(buildModelDisplayName("naga", "anthropic/claude-3-opus")).toBe("NG-claude-3-opus");
    expect(buildModelDisplayName("openrouter", "openai/gpt-4o")).toBe("OR-gpt-4o");
  });

  test("combined model IDs round-trip", () => {
    const id = buildCombinedModelId("naga", "anthropic/claude-3-opus");
    expect(id).toBe("naga:anthropic/claude-3-opus");
    expect(parseCombinedModelId(id)).toEqual({ provider: "naga", modelId: "anthropic/claude-3-opus" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils.test.ts`
Expected: FAIL with “getModelBaseName is not a function” (or similar).

**Step 3: Implement helpers**

In `src/shared/utils.js` add:
- `getModelBaseName(modelId)` → last segment after `/` or `:`.
- `buildModelDisplayName(providerId, modelId)` → prefix with `NG-` or `OR-` + base name.
- `buildCombinedModelId(providerId, modelId)` → `${provider}:${modelId}`.
- `parseCombinedModelId(combinedId)` → split on first `:` and normalize provider.

Export the new helpers at the bottom of `utils.js`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/utils.test.ts src/shared/utils.js
git commit -m "feat: add model display helpers"
```

---

### Task 2: Combine models and route by model provider in background

**Files:**
- Modify: `src/shared/constants.js:6-45`
- Modify: `src/background/background.js:40-330` (config + model fetching)
- Modify: `src/background/background.js:520-880` (request routing + streaming)

**Step 1: Write the failing test (helpers only)**

If you add a small helper in `utils.js` for sorting or building display names in Task 1, this task can skip tests. Otherwise add a unit test for any new utility you introduce before using it in background.

**Step 2: Update storage keys**

Add `MODEL_PROVIDER: "or_model_provider"` to `STORAGE_KEYS` in `src/shared/constants.js`.

**Step 3: Update config loading**

In `loadConfig()` read `STORAGE_KEYS.MODEL_PROVIDER` and prefer it for routing. Fallback order:
1) `or_model_provider`
2) `or_provider` (legacy)
3) `openrouter` default

Return `{ modelProvider, apiKey, model }` where `apiKey` is based on `modelProvider`.

**Step 4: Update set_model message**

Change the `set_model` handler to accept `{ model, provider }`:
- Store `or_model` = raw model id
- Store `or_model_provider` = provider
- Update cachedConfig accordingly

**Step 5: Combine model lists**

In the `get_models` handler:
- Read both API keys from storage.
- For each provider with a key, fetch models (or use provider-specific cache keys).
- Map each model to `{ id: buildCombinedModelId(provider, rawId), rawId, provider, displayName }`.
- Return a single combined list (omit providers without keys).

**Step 6: Route by model provider**

Use `cfg.modelProvider` to select `providerConfig` in:
- `callOpenRouter`
- `callOpenRouterWithMessages`
- `streamOpenRouterResponse`
- `getProviderBalance`

Allow streaming to accept an optional `customProvider` (for Spaces). If provided, use it instead of `cfg.modelProvider`.

**Step 7: Run tests**

Run: `npm test`
Expected: PASS.

**Step 8: Commit**

```bash
git add src/shared/constants.js src/background/background.js

git commit -m "feat: combine models and route by model provider"
```

---

### Task 3: Update ModelDropdownManager for displayName + provider-aware favorites

**Files:**
- Modify: `src/modules/models-dropdown.js:120-360`
- Test: `tests/models-dropdown.test.ts`

**Step 1: Write the failing test**

Add a test to ensure the dropdown renders `displayName` when present.

```ts
test("renders displayName when provided", () => {
  document.body.innerHTML = '<input id="model-input" />';
  const input = document.getElementById("model-input");
  const dropdown = new ModelDropdownManager({ inputElement: input, onModelSelect: jest.fn() });

  dropdown.setModels([{ id: "openrouter:openai/gpt-4o", displayName: "OR-gpt-4o" }]);
  dropdown.show("");

  expect(document.querySelector('.model-dropdown-item')?.textContent).toContain("OR-gpt-4o");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/models-dropdown.test.ts`
Expected: FAIL (still showing `id`).

**Step 3: Implement displayName + provider-aware favorite hooks**

Update `models-dropdown.js`:
- Use `model.displayName || model.name || model.id` for rendering and filtering.
- Add optional config hooks:
  - `onToggleFavorite(modelId, isFavorite)` to persist favorites externally.
  - `onAddRecent(modelId, recentList)` to persist recents externally.
- Add `setRecentlyUsed(list)` to override loaded recents when combining providers.

**Step 4: Run tests**

Run: `npm test -- tests/models-dropdown.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/models-dropdown.js tests/models-dropdown.test.ts

git commit -m "feat: render display names in model dropdown"
```

---

### Task 4: Update Options to use combined models + save model provider

**Files:**
- Modify: `src/options/options.html:65-115`
- Modify: `src/options/options.js:20-220`

**Step 1: Update Options helper text**

Change provider help text to clarify it edits keys only, and models are combined when keys are set.

**Step 2: Load combined models**

In `loadModels()`:
- Use `get_models` response containing `{ id, provider, rawId, displayName }`.
- Pass the list to `ModelDropdownManager` and render display names.
- Maintain a local map for `{ combinedId -> model }` to resolve provider + rawId when saving.

**Step 3: Update model selection state**

When a model is selected:
- Set `modelInput.value` to `displayName`.
- Store the combined id in the hidden select (or a dedicated variable).

**Step 4: Save model + provider**

On Save:
- Parse combined id to `{ provider, modelId }`.
- Store `or_model` and `or_model_provider` in `chrome.storage.local`.
- Keep existing key save behavior for the selected provider.
- Notify `provider_settings_updated` after saving.

**Step 5: Run tests**

Run: `npm test`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/options/options.html src/options/options.js

git commit -m "feat: options save combined model provider"
```

---

### Task 5: Update Sidepanel and Spaces to use combined models

**Files:**
- Modify: `src/sidepanel/sidepanel.js:970-1120`
- Modify: `src/spaces/spaces.js:410-1210`

**Step 1: Sidepanel model loading + selection**

- Use combined model list from `get_models`.
- Map combined id → `{ provider, rawId, displayName }`.
- On selection, send `set_model` with `model` (rawId) and `provider`.
- Display `displayName` in status/meta instead of raw id.

**Step 2: Spaces model loading + persistence**

- Use combined list for space model selection.
- Store `space.modelProvider` and `space.modelDisplayName` on save.
- Use `modelDisplayName` in space cards + thread meta.
- When streaming/summarizing, pass `modelProvider` alongside `model`.

**Step 3: Provider update notice**

Keep the toast that reminds users to adjust models when provider keys change.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/sidepanel/sidepanel.js src/spaces/spaces.js

git commit -m "feat: use combined models in sidepanel and spaces"
```

---

### Task 6: Final verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS (all suites).

**Step 2: Manual sanity check**

- Set OpenRouter + Naga keys in Options.
- Confirm models show `NG-...` and `OR-...` only for providers with keys.
- Pick `NG-*` model and confirm requests route to Naga (balance shows Not supported).
- Pick `OR-*` model and confirm OpenRouter balance updates.

**Step 3: Commit (if any remaining changes)**

```bash
git add -A

git commit -m "chore: verify multi-provider models"
```
