# Spaces Summaries & Archive

Spaces uses adaptive summarization to reduce token usage while preserving full history for the user.

## How It Works
- **Live window**: 12 messages before a summary exists, 8 messages after.
- **Summary**: Stored in `thread.summary` and injected into the model prompt as a system message.
- **Archive**: Older messages are moved to `thread.archivedMessages` and are never sent to the model.

## UI
- **Earlier messages (N)** toggle renders archived bubbles on demand.
- **Summary updated** badge appears after a successful refresh and fades after ~30 seconds.

## Data Fields
- `summary`, `summaryUpdatedAt`
- `archivedMessages`, `archivedUpdatedAt`

## Notes
- Archived messages are UI-only.
- Summary updates call background `SUMMARIZE_THREAD` and do not modify sidebar context.
