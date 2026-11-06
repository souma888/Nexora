# Security Policy

## Supported versions
Nexora is pre-release and has no supported production version yet.

## Reporting
Please avoid posting exploitable vulnerabilities, credentials, or private data in public issues. Contact the repository maintainer privately using GitHub's available private reporting/contact mechanism if configured.

## Design principles
- No secrets in the repository.
- Validate all API input and enforce computation limits.
- Never execute user-submitted code on the backend.
- Protect saved experiments with authorization and ownership checks when accounts are implemented.
- Keep dependencies updated and audit them before deployment.
