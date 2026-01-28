# Model Vendor Labels With NG/OR Pairing (Design)

## Context
Users can now load models from OpenRouter (OR) and NagaAI (NG) at the same time. In the model dropdown, vendors are inferred from model IDs. This leads to incorrect vendor grouping (e.g., Qwen showing under Alibaba) and makes it hard to see which provider serves the same model. Naga's public models catalog provides authoritative vendor labels via the "by Vendor" display (backed by `owned_by` and startups metadata).

## Goals
- Group models under correct vendor labels (e.g., Qwen as its own vendor).
- Keep NG and OR models visible together under the same vendor group.
- Make provider access obvious by prefixing display names with `NG-` or `OR-`.
- Sort so identical base models appear adjacent (NG above OR).

## Non-Goals
- Unify or change the underlying model IDs.
- Change OpenRouter's model list or API handling.
- Introduce scraping of Naga's website.

## Data Sources
- Naga models: `GET /v1/models` (auth).
- Naga startups: `GET /v1/startups` (public), used to map `owned_by -> display_name`.

## Design Overview
### Vendor Label Resolution
- For NG models, attach `vendorLabel` during normalization:
  - `vendorLabel = startupsMap[owned_by] || TitleCase(owned_by) || 'Other'`.
- For OR models, keep current vendor inference from model ID / name.
- Adjust inference mapping to use vendor ids that match labels (e.g., `qwen -> qwen`, not `alibaba`).
- Dropdown grouping uses `model.vendorLabel` when present; otherwise falls back to inferred vendor label.

### Display Names
- Display name = `NG-` or `OR-` prefix + base model name (strip vendor/path).
- Example: `NG-gpt-4o`, `OR-gpt-4o`.
- Keep raw model IDs intact for API calls and storage.

### Sorting
Within each vendor group:
1. Sort by base model name (strip provider prefix and vendor/path).
2. Tie-break by provider order (NG first, then OR).

This keeps equivalent models adjacent and makes provider differences obvious.

### Caching
- Cache Naga startups in local storage with a timestamp (same TTL as Naga models cache).
- If startups fetch fails, fall back to TitleCase(owned_by).

## Error Handling
- If startups fetch fails: use TitleCase(owned_by).
- If `owned_by` is missing: vendor label = `Other`.
- If model ID lacks vendor/path: fall back to current inference logic.

## Testing
- Unit tests for vendor label resolution:
  - Naga: `owned_by` mapped to `display_name`.
  - Naga fallback to TitleCase when startup missing.
  - OR inference still works and maps `qwen` to "Qwen".
- Sorting test ensures NG/OR pairs align by base name with NG first.

## Implementation Notes
- Update shared model display-name builder to use base model name (not full raw ID).
- Update dropdown vendor grouping to prefer `vendorLabel`.
- Update inference mapping for Qwen and any other mismatched vendor ids.
