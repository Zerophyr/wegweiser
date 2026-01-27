# Spaces Archive + Summary Badge Design

Date: 2026-01-27

## Summary
Add a “Summary updated” badge in Spaces when a summary refresh happens, and preserve older messages by moving them into a collapsed “Earlier messages (N)” section. Archived messages remain stored and viewable but are excluded from the model prompt to keep token usage low.

## Goals
- Keep older answers accessible without increasing prompt size.
- Give users feedback when summaries update.
- Preserve current summarization behavior and token savings.

## Non‑Goals
- User configuration for summary/archive behavior (defer).
- Syncing archive across devices beyond existing storage behavior.

## Data Model
Add to thread:
- `summary` (string)
- `summaryUpdatedAt` (timestamp)
- `archivedMessages` (array of message objects)
- `archivedUpdatedAt` (timestamp)

When summarization runs:
- Move `historyToSummarize` into `archivedMessages` (append, preserve order).
- Keep `thread.messages` as the live window.
- Update `summary` and `summaryUpdatedAt`.

## Prompt Composition (unchanged intent)
- Space custom instructions (system)
- Summary (system)
- Live window messages
- New user prompt

Archived messages are never included in the prompt.

## UI/UX
- Add a “Summary updated” badge next to the summary indicator after successful summary update.
- Badge fades after ~30 seconds or on the next user send.
- Add a collapsed “Earlier messages (N)” toggle above the summary badge.
  - When expanded, render full message bubbles using the existing renderer.
  - When collapsed, remove the archived DOM nodes to avoid heavy rendering.

## Error Handling
- If summarization fails, do not move messages or update summary; show a toast.
- If summary is too short (<200 chars), keep previous summary; no badge shown.

## Testing
- Unit tests for:
  - archiving behavior (messages moved to archive)
  - “Summary updated” badge timing
  - expanded/collapsed rendering behavior (DOM presence)

## Rollout
- Ship enabled by default in Spaces.
- Monitor for performance issues with large archives; cap UI rendering to latest 50 archived messages if needed.
