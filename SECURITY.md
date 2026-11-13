# Security Policy

## Supported versions

Security fixes target the current `main` deployment. Nexora remains an educational application without a certified engineering or long-term-support release. See [the rendering/input audit](docs/SECURITY_AUDIT.md) for current trust boundaries.

## Reporting

Please avoid posting exploitable vulnerabilities, credentials, or private data in public issues. Contact the repository maintainer privately using GitHub's available private reporting/contact mechanism if configured.

## Design principles

- No secrets in the repository.
- Validate all API input and enforce computation limits.
- Never execute user-submitted code on the backend.
- Protect saved experiments with authorization and ownership checks when accounts are implemented.
- Keep dependencies updated and audit them before deployment.
