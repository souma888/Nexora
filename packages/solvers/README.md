# @souma88/solvers

Pure educational engineering solvers with TypeScript declarations. No DOM, server, database or browser dependency is required. MIT licensed.

```js
import { solveLab, solveTruss, convert } from '@souma88/solvers';
const result = solveLab('divider', { voltage: 12, upper: 10, lower: 10, load: 10 });
console.log(result.summary.loaded); // 4 V
console.log(convert(1, 'kN/m²', 'Pa')); // 1000
```

`listLabs()` discovers IDs and versions. `solveLab(id,input)` validates numeric models and algorithms using the same modules as the application. Numeric inputs accept canonical numbers or `{value,unit}` with compatible dimensions. Algorithm output also includes frames and operation counts. Direct functions such as `solveBeam` expect already valid canonical inputs; use `solveLab` for validation at a trust boundary.

`solveTruss(json,loadScale)` accepts nodes in metres, bars `[nodeA,nodeB,area_mm²,E_GPa]`, boolean zero-displacement supports `[node,fixX,fixY]`, and loads `[node,Fx_kN,Fy_kN]`. Node indices start at zero. It assembles and solves a small linear elastic pin-jointed 2D truss, rejecting mechanisms. It does not model buckling, yielding or bending.

`fitParameters` performs local bounded damped least squares against a strictly increasing numerical trace. `analyzeParameters` supports sweeps, endpoint sensitivity and seeded independent uncertainty sampling. Read each model's assumptions in the [application documentation](https://github.com/souma888/Nexora).

Build from the repository with `npm run package:build`; `npm pack ./packages/solvers` produces a reviewable tarball. Publishing requires an npm account with publish rights to the `@souma88` personal scope. This package is not a safety-certified engineering tool.
