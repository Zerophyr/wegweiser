# Contextual Custom Instructions Framing Design

Date: 2026-01-29
Status: Approved

## Problem

When sending messages in Spaces, custom instructions are included as a system message on every request. The model interprets this as a fresh conversation start and re-introduces itself mid-thread.

## Solution

Vary the framing of custom instructions based on thread state:

- **First message** (0 existing messages in thread): send custom instructions as-is.
- **Follow-up messages** (1+ existing messages): wrap with a minimal prefix that tells the model this is an ongoing conversation.

## Prefix

```
[Ongoing conversation. Follow these standing instructions without re-introducing yourself:]
```

Followed by the user's custom instructions text.

## Affected Code

`buildStreamMessages()` in `src/spaces/spaces.js` (line ~1669). Currently pushes `systemInstruction` raw into the messages array. The fix checks `baseMessages.length` to decide whether to wrap.

## No Changes To

- Storage or data model
- Summary system message handling
- Background script
- Sidebar behavior

## Testing

- Unit: `buildStreamMessages` returns raw instructions when no prior messages exist.
- Unit: `buildStreamMessages` returns prefixed instructions when prior messages exist.
- Manual: send multiple messages in a Spaces thread and confirm the model does not re-introduce itself.
