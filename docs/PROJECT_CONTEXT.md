# Nexora project context

Nexora is a shipped browser learning application for engineering models and algorithms. The [README](../README.md), [generated catalog](CATALOG.md), and [feature matrix](FEATURES.md) describe current functionality; [ROADMAP.md](ROADMAP.md) distinguishes future work.

The application uses vanilla JavaScript/TypeScript, Vite, native SVG/DOM rendering and pure ES-module solvers shared with Node.js Vercel Functions. It requires Node.js 24 and no database or account service. It is deployed at https://soumadip-nexora.vercel.app under the MIT license.

The learning workflow is: choose a lab, predict, change inputs, inspect a diagram/trace and numerical result, then check the governing equations and assumptions. Local saved runs, comparison, JSON/CSV interoperability, supported-unit conversion, editable DC circuit networks and project DAGs are implemented. Broader arbitrary geometry, 3D authoring, collaborative accounts and certified engineering design remain outside the shipped scope.

A large lab count is not a claim of numerical sophistication. Exact closed forms are appropriate reference-quality teaching calculations; iterative and assembled numerical methods are identified explicitly. Every solver requires independent reference cases and domain bounds. AI coding tools assisted implementation and refactoring; maintainers remain responsible for reviewing and understanding contributions.

See [architecture](ARCHITECTURE.md), [validation](VALIDATION.md), [engineering decisions](ENGINEERING_NOTES.md), and [security audit](SECURITY_AUDIT.md) for the reasoning and evidence.
