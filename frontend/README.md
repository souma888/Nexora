# Frontend

The catalog and lab pages live in `public/`. Beam Analysis calls `POST /api/beam` and exports the last run as CSV. Axial Stress & Strain and Mohr’s Circle share a client module and call `POST /api/materials`. Run `npm run dev` from the repository root.
