# Image Model Capability Routing (Naga + OpenRouter)

Date: 2026-02-09

## Summary
Use provider metadata to classify image-capable models, cache the derived capabilities, and refresh in the background. Image mode is only enabled for image-only models. Routing is deterministic and based strictly on metadata.

## Goals
- Use model metadata (not names) to determine image capability.
- Keep the model dropdown snappy with cached data.
- Auto-enable image mode only for image-only models and disable the toggle otherwise.
- Route requests to the correct endpoint deterministically.

## Non-Goals
- No name-based inference or allowlists.
- No user-controlled image toggle for non-image-only models (for now).
- No separate image-only model list.

## Capability Derivation (Strict Metadata)
From each provider's /v1/models response, compute:
- supportsChat: supported_endpoints includes /chat/completions
- supportsImages: supported_endpoints includes /images/generations
- outputsImage: architecture.output_modalities includes "image"
- isImageOnly: supportsImages && !supportsChat

If any field is missing or ambiguous, treat as non-image-capable.

## Caching & Refresh
- Cache per provider: models_cache_{provider} with { fetchedAt, models: [...] }.
- UI requests models: return cache immediately, then refresh in background.
- On refresh completion, broadcast models:updated to update UIs.
- TTL: 6 hours (configurable).

## UI Behavior
- Single combined model list with an "Image" badge when outputsImage is true.
- If isImageOnly: auto-enable image mode and disable the toggle.
- Otherwise: force image mode off and disable the toggle.
- If refreshed metadata removes image capability, image mode is turned off.

## Routing
- If supportsChat && outputsImage -> /chat/completions (image payload)
- Else if supportsImages -> /images/generations
- Else -> error "Selected model is not image-capable"

## Error Handling
- If refresh fails, keep cached list and log debug (no user error).
- If a request is attempted with a non-image-capable model, surface a clear toast.

## Tests
- Unit test: capability derivation from metadata.
- Background test: routing for chat-image vs images endpoints.
- UI test: toggle state is correct for image-only vs non-image-only.
- Cache test: cached list returned immediately, refresh triggers update.

## Rollout
- Ship behind metadata-only logic; no migration needed.
- Monitor for missing metadata; treat as non-image to avoid errors.
