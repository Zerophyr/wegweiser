# Provider Badges in Model List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace NG-/OR- prefixes with raw model labels and add compact provider badges (OR/NG) per model row.

**Architecture:** Keep vendor grouping and sorting, but change displayName to raw model id and render a compact badge in the dropdown row based on the model provider. Badge uses model.provider with fallback to combined id prefix.

**Tech Stack:** Chrome extension (service worker), JS modules, Jest.

---

### Task 1: Update display-name behavior to raw model id

**Files:**
- Modify: `src/shared/model-utils.js`
- Modify: `src/shared/utils.js`
- Modify: `tests/utils.test.ts`

**Step 1: Write the failing test**

Update model display expectations to raw id (no NG/OR prefix):
```ts
expect(buildModelDisplayName("naga", "anthropic/claude-3-opus")).toBe("anthropic/claude-3-opus");
expect(buildModelDisplayName("openrouter", "openai/gpt-4o")).toBe("openai/gpt-4o");
```

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/utils.test.ts`
Expected: FAIL on `buildModelDisplayName` assertions.

**Step 3: Implement minimal change**

Update `buildModelDisplayName` in both `model-utils.js` and `utils.js` to return the raw model id (string) without prefixes. Keep `getModelBaseName` unchanged for sorting.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/utils.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/shared/model-utils.js src/shared/utils.js tests/utils.test.ts
git commit -m "feat: use raw model ids for display names"
```

---

### Task 2: Render provider badges in model dropdown

**Files:**
- Modify: `src/modules/models-dropdown.js`
- Modify: `tests/models-dropdown.test.ts`

**Step 1: Write the failing test**

Add tests to assert:
- Model rows show raw id labels (no NG-/OR- prefixes).
- A compact badge shows `OR` or `NG` based on `model.provider`.

Example:
```ts
dropdown.setModels([
  { id: "openrouter:openai/gpt-4o", provider: "openrouter", rawId: "openai/gpt-4o", displayName: "openai/gpt-4o" },
  { id: "naga:openai/gpt-4o", provider: "naga", rawId: "openai/gpt-4o", displayName: "openai/gpt-4o" }
]);
```
Expect each row to contain badge text `OR` / `NG`.

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: FAIL (badge missing).

**Step 3: Implement minimal change**

- Add helper to resolve provider label for badge:
  - Use `model.provider` when present.
  - Else parse combined id prefix (`openrouter:`/`naga:`).
- Update `createModelItem` to render a small badge (e.g., `span`) to the right of the model name and left of the star icon.
- Badge text: `OR` for OpenRouter, `NG` for NagaAI; fallback `?`.
- Add basic inline styles for size, padding, border radius, and muted background.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/modules/models-dropdown.js tests/models-dropdown.test.ts
git commit -m "feat: add provider badges to model rows"
```

---

### Task 3: Update existing dropdown tests for raw labels

**Files:**
- Modify: `tests/models-dropdown.test.ts`

**Step 1: Write the failing test**

Update any existing assertions that expect `NG-` or `OR-` in text to expect raw ids instead.

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: FAIL on old expectations.

**Step 3: Implement minimal change**

Replace expected display strings with raw ids (e.g., `openai/gpt-4o`).

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/models-dropdown.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add tests/models-dropdown.test.ts
git commit -m "test: update dropdown expectations for raw labels"
```

---

### Task 4: End-to-end verification

**Step 1: Run full test suite**
Run: `npm test`
Expected: all tests pass.

**Step 2: Commit any final fixes**
```bash
git add -A
git commit -m "chore: finalize provider badge display"
```
(if needed)
