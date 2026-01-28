# Provider Badges in Model List (Design)

## Context
Users want the model list grouped by vendor but without NG-/OR- prefixes. Instead, each model row should show a compact provider badge indicating whether the model is served by OpenRouter or NagaAI. Vendor grouping should remain accurate (using Naga startups labels + OpenRouter inference).

## Goals
- Keep vendor grouping (OpenAI, Anthropic, Qwen, etc.).
- Show raw model id as the row label (e.g., `openai/gpt-4o`).
- Display a compact right-aligned badge per row showing provider: `OR` or `NG`.
- Keep sorting that pairs identical models (base-name sort, NG before OR).

## Non-Goals
- Change the combined model id format used for selection/routing.
- Remove favorites or recents functionality.

## UI Behavior
- Model rows display the raw model id (no prefix).
- A small badge to the right shows `OR` or `NG` based on the model provider.
- The star (favorites) remains at the far right; the badge is placed just left of it.

## Data Flow
- Background continues to return combined models with `id`, `rawId`, `provider`, and `vendorLabel`.
- Dropdown uses `displayName`/`name` for visible labels; update builder to use raw model id.
- Badge uses `model.provider` (fallback: parse combined id prefix).

## Sorting
- Within each vendor group: sort by base model name, then provider (NG before OR) to keep duplicates adjacent.

## Error Handling
- If provider is missing/unknown: show `?` badge (muted) or omit badge (implementation choice).
- If rawId is missing: label falls back to `model.id` (existing behavior).

## Testing
- Update utils tests for display name (raw id).
- Update dropdown tests to assert badge rendering for NG/OR and absence of NG-/OR- prefixes.
- Keep sorting test for NG before OR on identical base models.
