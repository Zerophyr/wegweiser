# Key Visibility Toggle Design

**Date:** 2026-01-28
**Feature:** API key privacy toggle (eye icon)

## Goal
Allow users to reveal or hide API and provisioning keys in Options using an inline eye icon. Keys are hidden by default on every page load, and the toggle state does not persist.

## User Experience
Each key input gets a trailing eye button inside the field. The input starts as type `password`, and clicking the eye toggles between `password` and `text`. The icon switches between eye and eye-off to reflect state. The toggle is available for OpenRouter API key, NagaAI API key, and NagaAI provisioning key (when that section is visible). The control is keyboard accessible (tab focus) and uses `aria-label` plus `aria-pressed` for accessibility.

## Visual Treatment
Minimal outline SVG icons match the current dark UI. The button is subtle (muted gray) with hover/active feedback. The input container aligns the icon without changing input width or layout. No new assets are required; SVG is inline in the options HTML for simplicity.

## Data/Privacy
No storage changes. Visibility state is purely in-memory; it always resets to hidden on reload. No key values are logged or transmitted.

## Error Handling
If SVG fails to load, the toggle button still works (fallback text label or no icon). If JS fails, inputs remain masked, preserving privacy.

## Testing
Add small DOM tests to ensure toggling switches input type and updates `aria-pressed`/icon state. Manual sanity check in Options to confirm OpenRouter and Naga inputs toggle correctly.
