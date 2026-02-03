# Chrome Web Store Listing Checklist (Wegweiser)

## Listing description (must match functionality)
- Wegweiser is a Chrome sidebar extension for AI chat.
- Supports OpenRouter and NagaAI.
- Model list combines enabled providers; provider badges clarify source.
- Spaces provide project/thread organization with summaries.
- Image generation is supported.
- Web search/reasoning toggles apply where supported.

## Permissions rationale (reviewer-facing)
- `sidePanel`: required for the main sidebar UI.
- `storage`: saves settings, model preferences, history, and local cache metadata.
- `tabs` + `activeTab`: used to open/focus Spaces and support sidebar interactions tied to the active tab.
- `scripting`: used for page summarization feature to inject scripts into the active page.

## Host permissions
- `https://openrouter.ai/*`: OpenRouter API access.
- `https://api.naga.ac/*`: NagaAI API access.
- `optional_host_permissions: <all_urls>`: required for user‑initiated page summarization; permission is requested at runtime.

## Privacy & data handling (listing blurb)
- API keys are stored locally in Chrome storage and are never synced.
- No analytics or telemetry; no tracking.
- Requests are sent only to the user’s selected provider (OpenRouter or NagaAI).

## Compliance checks
- No remote code execution or externally hosted scripts.
- All code is bundled with the extension package.
- No hidden/undisclosed data collection.

## Assets
- Screenshots: **TODO** (sidebar chat, model selector, options, Spaces).

