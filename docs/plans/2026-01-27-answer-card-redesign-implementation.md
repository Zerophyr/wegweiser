# Answer Card Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign answer cards in Sidebar and Spaces with topic-colored headings, domain source chips + hover cards, and an export dropdown (PDF/Markdown/DOCX).

**Architecture:** Extend the markdown + sources pipeline to replace numeric references with domain chips and add hover cards via a small module. Add a shared action row renderer for copy/export + source stack/count. Implement export helpers for PDF/MD/DOCX and wire into both Sidebar and Spaces.

**Tech Stack:** Chrome MV3 extension, vanilla JS, DOM, Jest, CSS.

---

### Task 1: Topic-colored headings (markdown headings)

**Files:**
- Modify: `src/modules/markdown.js`
- Modify: `src/sidepanel/sidepanel.css`
- Modify: `src/spaces/spaces.css`
- Test: `tests/markdown.test.ts`

**Step 1: Write the failing test**

Add a test that asserts headings get topic classes.

```ts
import { applyMarkdownStyles } from "../src/modules/markdown";

test("headings get topic classes", () => {
  const html = applyMarkdownStyles("# Topic One\n\n## Topic Two");
  expect(html).toContain("topic-heading");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/markdown.test.ts`
Expected: FAIL with missing class.

**Step 3: Implement minimal changes**

In `src/modules/markdown.js`:
- After markdown render, add topic classes to `h1-h3` elements.
- Add deterministic color class `topic-color-1..6` based on heading text hash.

**Step 4: Run tests**

Run: `npm test -- tests/markdown.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/markdown.js src/sidepanel/sidepanel.css src/spaces/spaces.css tests/markdown.test.ts
git commit -m "feat(ui): color topic headings"
```

---

### Task 2: Source chips + hover cards

**Files:**
- Modify: `src/modules/sources.js`
- Create: `src/modules/source-cards.js`
- Modify: `src/sidepanel/sidepanel.html`
- Modify: `src/spaces/spaces.html`
- Modify: `src/sidepanel/sidepanel.css`
- Modify: `src/spaces/spaces.css`
- Test: `tests/utils.test.ts`

**Step 1: Write failing tests**

Add tests for `extractSources` to return domain metadata and for chip label formatting.

```ts
import { extractSources } from "../src/modules/sources";

test("extractSources returns domain names", () => {
  const { sources } = extractSources("https://example.com [1]");
  expect(sources[0].title).toContain("example.com");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils.test.ts`
Expected: FAIL (missing export or behavior).

**Step 3: Implement chips and hover cards**

- Update `extractSources` to also compute `domain` for each source and keep it on source objects.
- Add `renderSourceChips(container, sources)` that replaces `[n]` references with chip spans.
- Create `src/modules/source-cards.js` to render hover cards on `.source-chip` hover.
- Load `source-cards.js` in both `sidepanel.html` and `spaces.html`.

**Step 4: Update CSS**

Add `.source-chip` styling and `.source-card` styling in both CSS files.

**Step 5: Run tests**

Run: `npm test -- tests/utils.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/modules/sources.js src/modules/source-cards.js src/sidepanel/sidepanel.html src/spaces/spaces.html src/sidepanel/sidepanel.css src/spaces/spaces.css tests/utils.test.ts
git commit -m "feat(ui): source chips and hover cards"
```

---

### Task 3: Action row + export dropdown (PDF/MD/DOCX)

**Files:**
- Create: `src/modules/exporter.js`
- Modify: `src/sidepanel/sidepanel.js`
- Modify: `src/spaces/spaces.js`
- Modify: `src/sidepanel/sidepanel.css`
- Modify: `src/spaces/spaces.css`
- Modify: `src/sidepanel/sidepanel.html`
- Modify: `src/spaces/spaces.html`
- Create: `src/lib/docx.min.js`
- Test: `tests/utils.test.ts`

**Step 1: Write failing test**

Add a test for Markdown export content.

```ts
import { exportMarkdown } from "../src/modules/exporter";

test("exportMarkdown formats thread", () => {
  const md = exportMarkdown([{ role: 'user', content: 'Hi' }]);
  expect(md).toContain("## User");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils.test.ts`
Expected: FAIL (missing export).

**Step 3: Implement exporter**

- `exportMarkdown(messages)` returns a transcript markdown string.
- `exportPdf(htmlString, filename)` opens print dialog.
- `exportDocx(messages, filename)` uses docx library to create blob.

**Step 4: Wire action row**

- Add action row renderer that shows copy, download dropdown, and sources count/stack.
- Hook dropdown to exporter functions.

**Step 5: Run tests**

Run: `npm test -- tests/utils.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/modules/exporter.js src/lib/docx.min.js src/sidepanel/sidepanel.js src/spaces/spaces.js src/sidepanel/sidepanel.css src/spaces/spaces.css src/sidepanel/sidepanel.html src/spaces/spaces.html tests/utils.test.ts
git commit -m "feat(ui): action row and export dropdown"
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
If any changes remain, commit them.

---
