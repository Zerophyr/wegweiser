# Provider Switch (OpenRouter + NagaAI) Design

Date: 2026-01-27

## Summary
Add a global provider switch (OpenRouter or NagaAI) and store separate API keys per provider. The extension routes all API calls (chat, streaming, summarize, models, balance) through provider-aware helpers. The model dropdown and caches are per provider. Balance displays “Not supported” for NagaAI.

## Goals
- Allow users to choose a provider globally in Options.
- Store separate API keys per provider in chrome.storage.local.
- Load models from the selected provider only.
- Keep OpenRouter behavior unchanged.
- Show “Not supported” for balance when provider lacks a balance endpoint.

## Non-Goals
- Per-space or per-thread provider selection.
- Adding additional providers beyond OpenRouter and NagaAI.
- Implementing a NagaAI balance API (not documented).

## Provider Configuration
Add a provider map in `src/shared/constants.js` with:
- `id`, `label`, `baseUrl`, `supportsBalance`, `supportsWebSearch`, `headers`.
- OpenRouter: base `https://openrouter.ai/api/v1`, supports balance.
- NagaAI: base `https://api.naga.ac/v1`, balance unsupported.

## Storage
New keys in `chrome.storage.local`:
- `or_provider` (selected provider, default `openrouter`).
- `or_api_key` (OpenRouter), `naga_api_key` (NagaAI).
- `or_model_openrouter`, `or_model_naga` (per-provider model).
- `or_favorites_openrouter`, `or_favorites_naga`.
- `or_recent_models_openrouter`, `or_recent_models_naga`.
- Provider-scoped model cache keys (e.g., `models_cache_openrouter`, `models_cache_time_openrouter`).

## Background Service Worker
Refactor to provider-aware helpers:
- `loadConfig()` returns `{ provider, apiKey, model }` based on selected provider.
- `callProvider()` handles chat completions with provider base URL and headers.
- `streamProviderResponse()` handles streaming and context, uses provider model.
- `getProviderModels()` fetches `GET /models` from provider base URL and parses `{ data: [] }` or `[]`.
- `getProviderBalance()` returns `{ supported: false }` for NagaAI; OpenRouter unchanged.
- Web search `:online` suffix only for OpenRouter via capability flag.

## Options UI
- Add a provider dropdown (OpenRouter, NagaAI).
- API key input label/placeholder changes with provider.
- Save per-provider key + model.
- Models are loaded via background `get_models` for the selected provider.

## Sidepanel/Spaces UI
- Use provider-aware status text (“Sending to NagaAI…”).
- Balance shows “Not supported” for NagaAI.
- Model dropdown uses provider-scoped favorites/recent models.

## Manifest
Add host permission: `https://api.naga.ac/*`.

## Error Handling
- “No API key set for selected provider” instead of OpenRouter-only wording.
- Preserve existing retry/backoff logic.

## Testing
- Unit tests for `loadConfig()` provider selection and storage keys.
- `get_models` parsing for `{ data: [...] }` and `[...]`.
- Balance response `supported: false` when provider is NagaAI.

## Migration
- Default provider to OpenRouter if `or_provider` is missing.
- Existing `or_api_key` and `or_model` remain valid for OpenRouter.
