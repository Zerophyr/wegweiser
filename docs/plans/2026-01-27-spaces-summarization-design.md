# Spaces Summarization Design (Adaptive Window)

Date: 2026-01-27

## Summary
Spaces should minimize token usage by replacing long thread history with a rolling summary. Once a thread exceeds the live window, we generate a compact “Summary so far” and keep only the most recent turns verbatim. The summary is stored per thread and injected into the prompt alongside Space custom instructions. After a summary exists, the live window shrinks to reduce recurring context cost.

## Goals
- Cap token growth for long threads without losing key context.
- Preserve recent conversational detail for continuity.
- Keep behavior predictable and low‑maintenance (no user settings yet).
- Work with existing Spaces custom instructions and memory behavior.

## Non‑Goals
- User-configurable limits (defer until requested).
- Complex multi-summary chains or external storage.
- Summarizing every message (only when thresholds are exceeded).

## Architecture & Data Flow
1) When a user sends a message in Spaces, compute the live window.
2) If no summary exists, keep the last 6 turns (12 messages). If a summary exists, keep last 4 turns (8 messages).
3) If the thread exceeds the current window, extract `historyToSummarize` (everything older than the window).
4) Generate or update `thread.summary` by summarizing:
   - If no summary: summarize `historyToSummarize`.
   - If summary exists: summarize `[previous summary] + [historyToSummarize]`.
5) Prompt sent to model:
   - Space custom instructions (system)
   - Summary (system)
   - Live window messages
   - New user prompt

## Summarizer Prompt (concept)
A compact system prompt focused on:
- User goals and preferences
- Decisions made and constraints
- Key facts and entities
- Open questions / unresolved items
Avoid long quotes and verbosity; preserve only durable context.

## Adaptive Window Rules
- No summary yet → keep 6 turns.
- Summary exists → keep 4 turns.
This keeps continuity before the first summary, then lowers token usage after the summary stabilizes.

## Error Handling
- If summarization fails: keep existing summary (if any) and continue without changes; show a small warning toast.
- If summary is empty or too short (< ~200 chars): keep previous summary.
- If user message is extremely long: skip summarization that cycle to avoid compounding cost.

## UX
- Minimal indicator: “Updating summary…” during the summarization pass.
- No user-facing settings yet (defer until requested).

## Data Model Changes
- Add `summary` and `summaryUpdatedAt` fields to each thread.
- Summary stored separately from `thread.messages` to avoid duplicate context.

## Testing
- Unit tests for summary window selection (6 → 4 after summary).
- Tests for summary update logic (new summary vs. update existing).
- Test fallback behavior when summary is empty or summarizer fails.

## Rollout
- Ship behind a small internal flag if needed; otherwise enable by default.
- Monitor token usage and thread continuity on a few long threads.
