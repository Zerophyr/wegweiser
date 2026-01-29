# Thread Export Feature Design

Date: 2026-01-29
Status: Approved

## Problem

Users cannot export Spaces thread conversations. The exporter module exists but is not wired into the Spaces UI.

## Solution

Add an "Export" submenu to the thread three-dot menu (between Rename and Delete) with three format options: PDF, Markdown, DOCX.

## Menu UX

- "Export" item with a right-arrow indicator expands a CSS hover submenu.
- Submenu shows: PDF, Markdown, DOCX.
- Clicking a format triggers the export immediately.

## Data Assembly

1. Load thread by ID.
2. Combine `thread.archivedMessages` (if any) + `thread.messages` in chronological order.
3. Sanitize thread title for filename (strip special chars, cap at 50 chars).
4. Call the appropriate exporter function from `exporter.js`.

For PDF, build an HTML string from the combined messages using `escapeHtmlForExport`, then pass to `exportPdf`.

## Error Handling

- No messages: toast "Nothing to export".
- PDF popup blocked: toast warning.
- Blob creation failure: catch and toast error.

## Files Changed

- `src/spaces/spaces.js` -- Export submenu HTML in thread menu, click handler, message assembly helper.
- `src/spaces/spaces.css` -- Submenu positioning and hover styles.
- No changes to `src/modules/exporter.js`.

## Testing

- Unit: filename sanitization (special chars, length cap).
- Unit: message assembly combines archived + live in order.
- Manual: export each format from a thread with archived messages.
