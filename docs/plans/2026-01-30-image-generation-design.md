# Image Generation (Final Image) - Design

Date: 2026-01-30

## Summary

Add an explicit Image mode in the side panel and Spaces that requests a single final image from OpenRouter or NagaAI. While generating, show a compact inline card with a spinner and an expiry hint. When ready, show a thumbnail with View and Download actions. Side panel opens full-size in a new tab; Spaces opens a lightbox. Images are cached in chrome.storage.local for 3 hours; only a text entry "Image generated" is stored in history.

## Goals

- Allow users to generate a single image from supported models (OpenRouter + NagaAI).
- Provide a compact in-chat UX that expands to full size on demand.
- Support download from both the compact card and the full-size view.
- Keep storage bounded with a 3-hour TTL and clear user hints.
- Do not store images in message history; only store the fact an image was generated.

## Non-Goals

- Progressive streaming of image chunks.
- Multiple images per request.
- User-configurable image settings (size/aspect/quality/etc.).
- Persisting images beyond the TTL.

## UX / Product Requirements

- Image mode is an explicit toggle/button next to Send in side panel and Spaces.
- Side panel:
  - Inline card shows spinner while generating.
  - On ready, compact thumbnail + View + Download.
  - Clicking thumbnail or View opens full-size in a new tab.
- Spaces:
  - Same inline card behavior.
  - Clicking thumbnail or View opens a lightbox modal (not a new tab).
- History entry only: "Image generated" (no image data persisted in thread history).
- TTL hint: show "Expires in ~3 hours" on generating and ready states.
- If cache expired: show "Image expired" and remove View/Download actions.

## Architecture Overview

### Message Flow

1) UI sends IMAGE_QUERY with { prompt, provider, model }.
2) Background routes to provider image endpoint.
3) Background normalizes response to { imageId, mimeType, dataBase64 }.
4) UI stores in cache and renders ready card.

### Storage

- Use chrome.storage.local for short-lived image cache.
- Cache entry:
  - imageId (string)
  - createdAt (ms)
  - expiresAt (ms)
  - mimeType
  - dataBase64 (or dataUrl)
  - provider, model (metadata)
- TTL: 3 hours. Cleanup on startup and before insert.

### UI Components

- Image toggle next to Send (ARIA pressed state).
- Inline image status card with states: generating, ready, expired, error.
- Lightbox modal for Spaces only.
- New tab open for side panel only.
- Download actions on both compact card and full-size view.

## Error Handling & Edge Cases

- Provider error: replace card with error state and show toast; allow retry.
- Unsupported model: show toast and abort request.
- Storage quota: if cache write fails, show warning and prompt immediate download; image still not persisted.
- Expired cache: render expired state and disable actions.

## Security & Privacy

- Sanitize user-facing strings.
- Validate URLs; avoid injecting untrusted data into DOM.
- Open new tabs with noopener.
- Store API keys only in chrome.storage.local (existing rule).

## Implementation Plan (High Level)

1) Add IMAGE_QUERY message type in src/shared/constants.js.
2) Add background handlers in src/background/background.js for OpenRouter + NagaAI image generation.
3) Add cache helpers for image storage and TTL cleanup (shared module or utils).
4) Add Image toggle in side panel and Spaces; route send to image query.
5) Add image card rendering and state handling.
6) Implement lightbox (Spaces) and new tab open (side panel).
7) Add CSS for cards, spinner, and lightbox.
8) Add tests for cache and UI state handling.

## Testing Strategy

- Unit tests for cache insert/expire/cleanup.
- UI tests for card states and click behaviors.
- Background handler tests for provider routing and response normalization.
- Manual test: generate image, confirm TTL hint, lightbox/new tab, download, expiration behavior.
