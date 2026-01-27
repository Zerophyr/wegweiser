# Multi-Provider Models (OpenRouter + NagaAI) Design

Date: 2026-01-27

## Summary
Allow OpenRouter and NagaAI to be used at the same time. The model list combines providers with prefixed display names (NG-/OR-). Routing and balance are determined by the selected model's provider. The Options provider dropdown remains for API key management only. Models only appear for providers with a key.

## Goals
- Use both providers concurrently.
- Combine models into a single list across the extension.
- Prefix display names with NG- or OR- using the raw model id (provider removed).
- Hide models for providers without keys.
- Route requests and balance lookup by the selected model's provider.

## Non-Goals
- Remove the provider dropdown from Options.
- Auto-migrate existing thread model choices across providers.
- Add new providers beyond OpenRouter and NagaAI.

## UX and Options
- Keep the provider dropdown in Options to select which API key is being edited.
- Use provider-specific placeholders (OpenRouter: sk-or-..., NagaAI: ng-...).
- After Save, refresh the models list and notify sidepanel and Spaces to refresh.
- Add an Options hint: "Models are combined when keys are set. Select a model to route requests."
- When provider keys change, Spaces shows a notice reminding users to update thread models to use the intended provider.

## Model Display Name Rules
- Use the raw model id for routing, but build a display name for UI only.
- Strip the provider segment from the raw id by taking the part after the last '/' or ':'.
  - Example: "anthropic/claude-3-opus" -> "claude-3-opus".
- Prefix the base name:
  - OpenRouter: "OR-claude-3-opus"
  - NagaAI: "NG-claude-3-opus"
- Status text and model dropdowns display the prefixed name only.

## Combined Model List
- Background returns a combined list with entries: { id, provider, displayName }.
- Fetch models only for providers that have keys. If a provider has no key, omit its models.
- Favorites and recents remain provider-scoped and are applied when combining lists.
- Sorting: favorites first, then alphabetical by displayName (case-insensitive).
  - This yields NG- before OR- for the same base name.
- Spaces uses the same combined ordering as the sidebar.

## Routing and Balance
- Store provider alongside the selected model for the sidebar and for each Space thread.
- If provider is missing (legacy data), default to OpenRouter.
- Background uses modelProvider to select base URL, headers, and API key.
- Balance display uses the selected model's provider. NagaAI shows "Not supported".

## Storage
- Add `or_model_provider` for the global selection.
- Store `modelProvider` on thread records in Spaces.
- Keep provider-specific caches and favorites unchanged.
- Keep `or_provider` as the current Options dropdown selection only.

## Error Handling
- If the selected model's provider has no key, show "No API key set for selected provider" and prompt to set it in Options.

## Testing
- Unit tests for display name formatting (strip provider + prefix).
- Tests for combined model list filtering by keys.
- Tests for sorting (favorites first, then prefixed alphabetical).
- Tests for routing and balance using modelProvider.
