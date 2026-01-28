# Model Vendor Labels With NG/OR Pairing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Naga vendor label mapping and NG/OR paired sorting so identical models are grouped under the same vendor and shown as NG- / OR- pairs.

**Architecture:** Enrich Naga model data in the background worker using `/v1/startups` to map `owned_by` to a vendor display label, cache that mapping, and pass `vendorLabel` into combined model entries. The dropdown prefers `vendorLabel` when present, falls back to inference for OpenRouter. Display names use provider prefix + base model name, and vendor groups sort by base name with NG before OR.

**Tech Stack:** Chrome extension (service worker), JS modules, Jest.

---

### Task 1: Add Naga startups cache keys

**Files:**
- Modify: `src/shared/constants.js`

**Step 1: Write the failing test**

No unit test needed (constants only).

**Step 2: Implement change**

Add storage keys for the Naga startups cache and its timestamp:
```js
NAGA_STARTUPS_CACHE: "naga_startups_cache",
NAGA_STARTUPS_CACHE_TIME: "naga_startups_cache_time",
```
Place them near other cache keys.

**Step 3: Commit**
```bash
git add src/shared/constants.js
git commit -m "feat: add naga startups cache keys"
```

---

### Task 2: Enrich Naga models with vendorLabel

**Files:**
- Modify: `src/background/background.js`

**Step 1: Write the failing test**

No direct unit tests for background; behavior is validated via dropdown tests in Task 4.

**Step 2: Implement minimal change**

1) Add a helper to fetch and cache Naga startups:
- Reads `STORAGE_KEYS.NAGA_STARTUPS_CACHE` and `STORAGE_KEYS.NAGA_STARTUPS_CACHE_TIME`
- If cached and fresh (use `CACHE_TTL.MODELS`), return the cached array/map
- Fetch `GET ${PROVIDERS.naga.baseUrl}/startups` with no auth header
- Parse `data` or array response into list
- Store cache and timestamp
- On failure, return an empty map

2) Update `parseModelsPayload` to capture `owned_by` (or `ownedBy`) into `ownedBy`.

3) In `getProviderModels`, when provider is `naga`, call the startups helper, then attach `vendorLabel` to each model:
```js
const vendorLabel = startupsMap[model.ownedBy] || toTitleCase(model.ownedBy) || "Other";
```
`toTitleCase` should be a small helper that capitalizes the first letter only (matching existing vendor label formatting).

4) When building `combinedModels`, include `vendorLabel` on each entry so the dropdown can use it.

**Step 3: Commit**
```bash
git add src/background/background.js
git commit -m "feat: map naga owned_by to vendor labels"
```

---

### Task 3: Update model display names to use base model name

**Files:**
- Modify: `src/shared/model-utils.js`
- Modify: `src/shared/utils.js`
- Modify: `tests/utils.test.ts`

**Step 1: Write the failing test**

Update the `buildModelDisplayName` expectations to use base names:
```ts
expect(buildModelDisplayName("naga", "anthropic/claude-3-opus")).toBe("NG-claude-3-opus");
expect(buildModelDisplayName("openrouter", "openai/gpt-4o")).toBe("OR-gpt-4o");
```

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/utils.test.ts`
Expected: FAIL on `buildModelDisplayName` assertions.

**Step 3: Implement minimal change**

Update `buildModelDisplayName` (both `model-utils.js` and `utils.js`) to use `getModelBaseName(modelId)` instead of the raw model id.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/utils.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/shared/model-utils.js src/shared/utils.js tests/utils.test.ts
git commit -m "feat: prefix display names with base model id"
```

---

### Task 4: Prefer vendorLabel and update inference (Qwen)

**Files:**
- Modify: `src/modules/models-dropdown.js`
- Modify: `tests/models-dropdown.test.ts`

**Step 1: Write the failing test**

Add/adjust tests to ensure:
1) `vendorLabel` is preferred when present:
```ts
dropdown.setModels([
  { id: "naga:qwen/qwen-2.5", rawId: "qwen/qwen-2.5", provider: "naga", vendorLabel: "Qwen", displayName: "NG-qwen-2.5" }
]);
```
Expect provider header to be `Qwen`.

2) Inference maps qwen to `Qwen` (not Alibaba).

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: FAIL on header label.

**Step 3: Implement minimal change**

- In `getVendorLabelForModel`, return `model.vendorLabel` if set and non-empty.
- Update `inferVendorFromModelName` to return `qwen` for qwen-prefixed models.
- Update label formatting to special-case `qwen` -> `Qwen`.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/modules/models-dropdown.js tests/models-dropdown.test.ts
git commit -m "feat: honor naga vendor labels and qwen inference"
```

---

### Task 5: Sort vendor groups by base model name with NG before OR

**Files:**
- Modify: `src/modules/models-dropdown.js`
- Modify: `tests/models-dropdown.test.ts`

**Step 1: Write the failing test**

Add a test that loads two providers of the same model and verifies order:
- Models: `NG-gpt-4o`, `OR-gpt-4o`, `OR-gpt-4o-mini`
- Expect order in the vendor group: `NG-gpt-4o`, `OR-gpt-4o`, `OR-gpt-4o-mini`

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: FAIL on ordering.

**Step 3: Implement minimal change**

- Add helper `getModelBaseName` in the dropdown (using `rawId` or the combined id portion after `:`; split on `/` or `:` and take last segment).
- Update sort comparator in `render()` to sort by base name first, then provider order (naga first). Use `model.provider` if present or parse from combined id.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/modules/models-dropdown.js tests/models-dropdown.test.ts
git commit -m "feat: sort models by base name with NG first"
```

---

### Task 6: End-to-end verification

**Step 1: Run full test suite**
Run: `npm test`
Expected: all tests pass.

**Step 2: Commit any final fixes**
```bash
git add -A
git commit -m "chore: finalize vendor grouping updates"
```
(if needed)

