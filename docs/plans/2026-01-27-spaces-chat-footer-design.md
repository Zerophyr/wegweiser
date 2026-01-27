# Spaces Chat Footer + Loading Indicator Design

Date: 2026-01-27
Status: Approved

## Summary
Add a sidebar-like streaming experience to Spaces threads. When a user sends a message, a persistent assistant bubble appears immediately with a typing indicator. When the response completes, the bubble shows the full sidebar-style footer (time, tokens, context badge, token usage bar) and the model used. Metadata is stored with the assistant message so the footer persists after reload.

## Goals
- Show a loading indicator in Spaces that mirrors the sidebar behavior.
- Persist model name and token usage per assistant response.
- Match the sidebar-style footer (time, tokens, token bar, context badge).

## Non-Goals
- Refactor shared rendering across sidebar and Spaces.
- Add reasoning UI to Spaces (future work).
- Migrate or backfill older thread messages.

## Data Model
Extend assistant messages in stored threads to include optional metadata:

```
{
  role: 'assistant',
  content: '...markdown...',
  meta: {
    model: 'openai/gpt-4o-mini',
    tokens: 1234,
    responseTimeSec: 2.41,
    contextSize: 8,
    createdAt: 1737940000000
  }
}
```

Messages without `meta` remain valid and render without a footer.

## UI / Rendering
- When streaming starts, insert a new assistant message element immediately.
- The initial bubble contains the typing indicator and a placeholder footer.
- As content chunks arrive, replace the typing dots with streamed markdown.
- On completion, update the bubble meta row to "<time> - <model>" and fill in:
  - response time (`responseTimeSec`)
  - token count (`tokens`)
  - context badge (when `contextSize > 2`)
  - token bar width and color using `TOKEN_BAR_MAX_TOKENS`.
- Persist the assistant message with `meta` so the footer survives reload.

## Error Handling
- If streaming fails, replace the typing indicator bubble with an error bubble.
- If tokens are unavailable, show "— tokens" and leave the bar at 0%.

## Testing
- Unit: `renderChatMessages` renders footer when `meta` exists and omits it when missing.
- Unit: token bar percentage + color selection for low/medium/high usage.
- Manual: send a Spaces message, verify loading bubble, footer completion, and persistence after reload.
