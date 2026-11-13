# Contributing to Nexora

Nexora is a working educational laboratory. Before submitting major code, open an issue to discuss the proposed simulation, physical assumptions, and expected user experience.

## Contribution expectations

- Keep simulation solvers independent of the UI and HTTP layer.
- Provide a reference problem and expected numerical results for each new solver.
- Explain units, assumptions, boundary conditions and sign conventions.
- Add tests for ordinary, edge and invalid inputs.
- Keep UI accessible and responsive.
- Avoid committing secrets, generated datasets, or large binaries.

## Required checks

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run docs:check`, `npm test`, `npm run build`, and `npm run test:e2e`. Run `npm run docs:generate` after registry changes. Keep formatting-only and behavioral changes in separate commits.

## Pull requests

Describe the problem, approach, test evidence, screenshots for UI changes, and any limitations. Small, focused changes are easier to review.

## Licensing

Nexora uses the [MIT License](LICENSE). Contributions are submitted under the same license. Disclose material AI assistance in the PR and be prepared to explain the equations, assumptions and tests.

## Code of conduct

Be respectful and constructive in issues, discussions, and reviews.
