# Answer Card Redesign (Topics, Sources, Export) Design

Date: 2026-01-27
Status: Approved

## Summary
Redesign answer cards in both Sidebar and Spaces with colored topic headings, source chips (domain labels) with hover cards, and a compact action row including copy, sources count/stack, and export dropdown (PDF/Markdown/DOCX).

## Goals
- Apply consistent answer-card styling in Sidebar and Spaces.
- Color topic headings based on markdown headings.
- Replace numeric source references with domain chips.
- Add hover cards for source chips.
- Provide export dropdown with PDF/Markdown/DOCX for threads.

## Non-Goals
- Automatic topic extraction beyond markdown headings.
- Source snippets in hover cards (can be added later).
- Cloud sync or online export backends.

## Approach
### Topic Coloring
- Use markdown headings (`h1-h3`) as topics.
- Apply deterministic color class per heading text (hash -> palette index).
- Add left accent and subtle background tint for readability.

### Source Chips + Hover Cards
- Extend `extractSources()` to produce domain metadata.
- Replace inline `[n]` references with domain chips (`<span class="source-chip" ...>`).
- Hover card shows favicon, domain, title, and URL.
- Position card near chip and clamp to viewport.

### Action Row
- Shared renderer for both Sidebar and Spaces.
- Elements: copy button, download dropdown, favicon stack, source count.
- Hide sources UI when none.

### Export Dropdown
- No default format; user chooses in dropdown.
- PDF: open a print-ready HTML document and call `print()`.
- Markdown: export thread transcript as `.md`.
- DOCX: use a bundled client-side docx library (`src/lib/`).

## Edge Cases
- No sources: chips/stack/count hidden.
- Long threads: warn before export.
- Export failure: toast error.

## Testing
- Unit: `extractSources` domain metadata, chip replacement.
- UI: chips render, hover card positioning, action row alignment.
- Export: Markdown content includes all messages; PDF/DOCX basic smoke tests.
