# Security Policy

## Supported Version

- Current supported version: `v1.2.0` and newer on `main`

## Report a Vulnerability

Report security issues privately by email:
- `wegweiser_dev@proton.me`

Please include:
1. Affected version/commit
2. Reproduction steps
3. Impact assessment
4. Suggested remediation (if available)

## Secret Handling Rules

- Never embed credentials in git remotes.
- Use SSH remotes for repository access:
  - `git remote set-url origin git@github.com:Zerophyr/wegweiser.git`
- Run secret scanning before commits and releases:
  - `npm run hooks:install`
  - `npm run security:scan:staged`
  - `npm run security:scan`
- Keep signing keys outside the repo and outside logs.

## Incident Response (Credential Leak)

1. Revoke exposed credential immediately.
2. Rotate affected keys/tokens.
3. Verify local git remotes do not include credentials.
4. Run repository scans and history checks:
   - `npm run security:scan`
   - `git log --all -G "ghp_[A-Za-z0-9]{36}|github_pat_" --oneline`
5. Document remediation in internal release notes.
