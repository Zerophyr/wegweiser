# Security Policy

## Supported Version

- Current supported version: `v1.2.0` and newer on `main`

## Security Model

- Sensitive extension settings are encrypted at rest with a device-local AES-GCM key.
- First-run crypto reset is staged: the new primary key is created and verified before legacy encrypted values are cleared.
- Crypto initialization uses a cross-context lock with renewal so multiple extension pages do not race key creation.
- Dynamic HTML sinks fail closed. If the sanitizer pipeline is unavailable, the UI renders escaped text instead of parsed HTML.
- Only the browser globals still required for page bootstrapping remain exposed. Raw crypto helpers now live behind a small internal namespace used by encrypted storage bootstrap.
- Source citations use local badge icons and do not send cited domains or URLs to third-party favicon services.
- Secret scanning uses `.gitleaks.toml` as the single rule source for required CI and scheduled history scans, with pinned `gitleaks` installation in CI.

## Report a Vulnerability

Report security issues privately by email:
- `wegweiser_dev@proton.me`

Please include:
1. Affected version/commit
2. Reproduction steps
3. Impact assessment
4. Suggested remediation (if available)
