# Reference and contract checks

`npm test` runs independent solver references, conservation/edge cases, parsers, API discovery/validation and portable run/CSV/unit checks. `npm run typecheck` includes backend/API JavaScript, strict TypeScript modules and negative compile fixtures. `npm run test:e2e` exercises browser behavior on desktop/mobile and compares client results with the API. See [VALIDATION.md](../docs/VALIDATION.md); these checks do not certify safety-critical engineering accuracy.
