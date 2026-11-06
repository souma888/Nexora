# Development

Use Node.js 24. The starter has no external dependencies or required environment variables.

```sh
npm run dev
npm test
```

Open <http://127.0.0.1:3000>. The local server serves `frontend/public` and invokes the same beam handler used by Vercel.

## Deploy to Vercel

1. Commit and push your changes to GitHub.
2. In Vercel, import the repository with its root directory set to the repository root and the **Other** framework preset. Leave build and output overrides at their defaults so `vercel.json` can set the static output directory.
3. Deploy. Open the deployment URL and run the default beam example. It should report 12 kN at each support, 36 kN·m peak moment, and −6.75 mm peak deflection.

Vercel serves the static frontend and runs `api/beam.js` as a Node.js Function in the same deployment. No database setup is required.

## Beam API

Send `POST /api/beam` with a JSON body:

```json
{ "case": "point", "span": 6, "load": 24, "modulus": 200, "inertia": 8000 }
```

Supported cases are `point` (center point load), `uniform` (uniform load along the full span), and `cantilever` (tip point load). Inputs use m, kN (kN/m for uniform), GPa, and cm⁴. Responses contain validated inputs, the solver version, a summary, and sampled x, shear, moment and deflection values in m, kN, kN·m and mm. Malformed JSON returns 400 and invalid model inputs return 422.
