import {
  exploration as lab,
  p,
  seq,
  rad,
  teaching,
  output,
  domain,
  requireValue,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'manufacturing', topic: 'Manufacturing processes', ...config }, solve);
export function merchant(a) {
  const alpha = rad(a.rake),
    beta = Math.atan(a.friction),
    phi = Math.PI / 4 + alpha / 2 - beta / 2,
    Fs = (a.shear * a.width * a.thickness) / Math.sin(phi),
    R = Fs / Math.cos(phi + beta - alpha),
    cutting = R * Math.cos(beta - alpha),
    thrust = R * Math.sin(beta - alpha);
  return {
    phi: (phi * 180) / Math.PI,
    cutting,
    thrust,
    ratio: Math.sin(phi) / Math.cos(phi - alpha),
    power: (cutting * a.speed) / 60,
  };
}
export const manufacturingModels = {
  merchantcircle: make(
    {
      id: 'merchantcircle',
      title: 'Merchant Circle Cutting Forces',
      inputs: {
        rake: p('Tool rake angle', '°', -10, 30, 10),
        friction: p('Tool–chip friction coefficient', '1', 0.1, 1.2, 0.5),
        shear: p('Workpiece shear flow stress', 'MPa', 50, 800, 300),
        width: p('Width of cut', 'mm', 0.1, 10, 2),
        thickness: p('Uncut chip thickness', 'mm', 0.01, 1, 0.2),
        speed: p('Cutting speed', 'm/min', 10, 300, 100),
      },
      metrics: {
        phi: ['Merchant shear angle', '°'],
        cutting: ['Cutting force Fc', 'N'],
        thrust: ['Thrust force Ft', 'N'],
        power: ['Cutting power', 'W'],
      },
      plot: {
        x: 'Rake angle',
        xUnit: '°',
        y: 'Cutting force',
        yUnit: 'N',
        traces: { y: 'Cutting force', reference: 'Thrust force' },
      },
      text: teaching(
        'Resolve the orthogonal-cutting force circle using a shear-plane strength and the Merchant minimum-energy angle.',
        'Does a larger positive rake usually lower the predicted cutting force?',
        ['Yes', 'No', 'It leaves shear area unchanged'],
        'The shear angle increases, reducing shear-plane area and the force required for plastic shearing.',
        'At α=10°, μ=.5 the Merchant angle is 36.7175°.',
        'φ=45°+α/2−β/2; β=atanμ; Fs=τsbt/sinφ; Fc=Fs cos(β−α)/cos(φ+β−α).',
        'Steady orthogonal plane-strain cutting, sharp rigid tool, constant friction/shear stress. No size effect, built-up edge, temperature dependence or tool vibration.',
      ),
    },
    (a) => {
      const r = merchant(a);
      return output(
        { phi: r.phi, cutting: r.cutting, thrust: r.thrust, power: r.power },
        seq(-10, 30).map((x) => {
          const r = merchant({ ...a, rake: x });
          return { x, y: r.cutting, reference: r.thrust };
        }),
        'merchant',
        { ...a, ...r },
      );
    },
  ),
  toollife: make(
    {
      id: 'toollife',
      title: 'Taylor Tool Life and Machining Economics',
      inputs: {
        exponent: p('Taylor exponent n', '1', 0.1, 0.5, 0.25),
        constant: p('Taylor speed constant C', 'm/min', 100, 600, 300),
        speed: p('Cutting speed', 'm/min', 30, 400, 150),
        change: p('Tool-change time', 'min', 0.5, 10, 2),
        tool: p('Cost per cutting edge', 'currency', 1, 100, 20),
        rate: p('Machine and operator cost', 'currency/min', 0.2, 10, 2),
        length: p('Equivalent cutting path per part', 'm', 1, 100, 10),
      },
      metrics: {
        life: ['Tool life at selected speed', 'min'],
        cost: ['Variable machining cost per part', 'currency'],
        economic: ['Minimum-cost cutting speed', 'm/min'],
        productive: ['Minimum-time cutting speed', 'm/min'],
      },
      plot: { x: 'Cutting speed', xUnit: 'm/min', y: 'Variable part cost', yUnit: 'currency' },
      text: teaching(
        'Combine Taylor life with machining and tool-change costs to locate the unconstrained economic speed.',
        'Is the minimum-cost speed necessarily the maximum-production speed?',
        ['No', 'Yes', 'Only if tool cost is positive'],
        'Tool purchase cost shifts the cost optimum toward longer tool life.',
        'For n=.25 and a 2 min change, the minimum-time tool life is (1/n−1)tc=6 min.',
        'VTⁿ=C; Tcost=(1/n−1)(tc+Cedge/Cminute); cost=rm·L/V+(rm·tc+Cedge)L/(VT).',
        'Empirical Taylor law with positive n<1, constant path length and no fixed handling cost. Optima are unconstrained by machine power, finish, speed limits or chatter.',
      ),
    },
    (a) => {
      const life = (v) => (a.constant / v) ** (1 / a.exponent),
        cost = (v) =>
          (a.rate * a.length) / v + ((a.rate * a.change + a.tool) * a.length) / (v * life(v)),
        economic = a.constant / ((1 / a.exponent - 1) * (a.change + a.tool / a.rate)) ** a.exponent,
        productive = a.constant / ((1 / a.exponent - 1) * a.change) ** a.exponent;
      return output(
        { life: life(a.speed), cost: cost(a.speed), economic, productive },
        seq(30, 400, 200).map((x) => ({ x, y: cost(x) })),
        'tool-wear',
        { ...a },
      );
    },
  ),
  sheetbend: make(
    {
      id: 'sheetbend',
      title: 'Sheet-Metal Springback and Bend Allowance',
      inputs: {
        thickness: p('Sheet thickness', 'mm', 0.2, 6, 1),
        radius: p('Inside bend radius', 'mm', 1, 30, 3),
        angle: p('Loaded bend angle', '°', 15, 150, 90),
        kfactor: p('Neutral-axis K factor', '1', 0.25, 0.5, 0.4),
        yield: p('Yield stress', 'MPa', 50, 1000, 250),
        modulus: p('Young’s modulus', 'GPa', 50, 220, 200),
      },
      validateValues: domain('radius', (a) =>
        requireValue(
          (a.yield / (a.modulus * 1000)) * (a.radius / a.thickness + 0.5) < 0.2,
          'Radius/material combination is outside the small-springback approximation.',
        ),
      ),
      metrics: {
        allowance: ['Bend allowance', 'mm'],
        deduction: ['Bend deduction for equal outside flanges', 'mm'],
        springback: ['Estimated angle recovery', '°'],
        unloaded: ['Estimated unloaded bend angle', '°'],
      },
      plot: { x: 'Loaded angle', xUnit: '°', y: 'Bend allowance', yUnit: 'mm' },
      text: teaching(
        'Calculate developed neutral-axis length and compare a small elastic-recovery estimate for a plastically bent sheet.',
        'Does a larger radius-to-thickness ratio tend to increase springback?',
        ['Yes', 'No', 'Only if E is zero'],
        'The elastic share of bending becomes larger relative to imposed curvature.',
        'For t=1 mm, R=3 mm, K=.4 and 90°, allowance is π(3.4)/2=5.3407 mm.',
        'BA=θ(R+Kt); BD=2(R+t)tan(θ/2)−BA; Δθ/θ≈3σy(R/t+.5)/E.',
        'K-factor allowance is geometric. Springback uses a first-order fully plastic rectangular-strip estimate and is explicitly approximate; no anisotropy, tooling contact, Bauschinger effect or validated forming simulation.',
      ),
    },
    (a) => {
      const ba = rad(a.angle) * (a.radius + a.kfactor * a.thickness),
        fraction = ((3 * a.yield) / (a.modulus * 1000)) * (a.radius / a.thickness + 0.5),
        springback = a.angle * fraction;
      return output(
        {
          allowance: ba,
          deduction: 2 * (a.radius + a.thickness) * Math.tan(rad(a.angle) / 2) - ba,
          springback,
          unloaded: a.angle - springback,
        },
        seq(15, 150).map((x) => ({ x, y: rad(x) * (a.radius + a.kfactor * a.thickness) })),
        'bend',
        { ...a, springback },
      );
    },
  ),
  rollingforce: make(
    {
      id: 'rollingforce',
      title: 'Rolling Reduction and Roll Force',
      inputs: {
        initial: p('Entry thickness', 'mm', 1, 30, 10),
        final: p('Exit thickness', 'mm', 0.5, 29, 7),
        radius: p('Roll radius', 'mm', 50, 500, 150),
        width: p('Strip width', 'mm', 10, 1000, 200),
        stress: p('Mean flow stress', 'MPa', 50, 1000, 250),
        friction: p('Friction coefficient', '1', 0.05, 0.5, 0.2),
      },
      validateValues: domain('final', (a) =>
        requireValue(a.final < a.initial, 'Exit thickness must be less than entry thickness.'),
      ),
      metrics: {
        reduction: ['Thickness reduction', '%'],
        contact: ['Projected contact length', 'mm'],
        force: ['Approximate roll separating force', 'kN'],
        bite: ['Self-biting under μ²R approximation', 'boolean'],
      },
      plot: { x: 'Draft', xUnit: 'mm', y: 'Separating force', yUnit: 'kN' },
      text: teaching(
        'Relate draft to projected roll contact, mean pressure and friction-limited bite.',
        'Can an arbitrarily large draft self-feed at fixed friction?',
        ['No', 'Yes', 'Only with zero friction'],
        'The approximate maximum draft for biting is μ²R.',
        'R=150 mm and draft=3 mm give L≈√450=21.213 mm; μ=.2 permits draft≈6 mm.',
        'L≈√(RΔh); F≈σ̄ b L[1+μL/(2h̄)]; Δhmax≈μ²R.',
        'Plane-strain flat rolling with supplied mean flow stress and a slab-inspired friction multiplier. No roll flattening, spread, entry/back tension or detailed pressure-hill integration.',
      ),
    },
    (a) => {
      const d = a.initial - a.final,
        L = Math.sqrt(a.radius * d),
        force = (a.stress * a.width * L * (1 + (a.friction * L) / (a.initial + a.final))) / 1000;
      return output(
        {
          reduction: (d / a.initial) * 100,
          contact: L,
          force,
          bite: +(d <= a.friction * a.friction * a.radius),
        },
        seq(0.01, a.initial * 0.9).map((x) => {
          const l = Math.sqrt(a.radius * x);
          return {
            x,
            y: (a.stress * a.width * l * (1 + (a.friction * l) / (2 * a.initial - x))) / 1000,
          };
        }),
        'rolling',
        { ...a, contact: L },
      );
    },
  ),
  weldrosenthal: make(
    {
      id: 'weldrosenthal',
      title: 'Welding Heat Input and Rosenthal Cooling',
      inputs: {
        voltage: p('Arc voltage', 'V', 10, 50, 25),
        current: p('Arc current', 'A', 20, 500, 150),
        efficiency: p('Heat-source efficiency', '1', 0.2, 1, 0.8),
        speed: p('Travel speed', 'mm/s', 1, 20, 5),
        conductivity: p('Thermal conductivity', 'W/(m·K)', 10, 200, 45),
        diffusivity: p('Thermal diffusivity', 'mm²/s', 2, 100, 12),
        offset: p('Transverse probe offset', 'mm', 1, 20, 5),
      },
      metrics: {
        heat: ['Net heat input per length', 'J/mm'],
        peak: ['Peak sampled probe temperature', '°C'],
        cooling: ['Sampled t8/5 cooling time, if crossed', 's'],
      },
      plot: {
        x: 'Time after closest source passage',
        xUnit: 's',
        y: 'Probe temperature',
        yUnit: '°C',
      },
      text: teaching(
        'Evaluate a moving three-dimensional point-source temperature field along a fixed material probe.',
        'Does increasing travel speed reduce heat deposited per unit length?',
        ['Yes', 'No', 'Only if efficiency rises'],
        'Net line energy is ηVI/v.',
        '25 V, 150 A, η=.8 and v=5 mm/s give 600 J/mm.',
        'T−T₀=Q/(2πkr) exp[−v(x+r)/(2α)]; x=−vt; r=√(x²+y²).',
        'Rosenthal quasi-steady 3D semi-infinite conduction, T₀=20°C. Constant properties, point heat source; probe offset avoids singularity. No latent heat, weld pool, radiation or finite-plate boundary effects. t8/5 uses interpolated descending crossings only.',
      ),
    },
    (a) => {
      const Q = a.efficiency * a.voltage * a.current,
        temp = (t) => {
          const x = (-a.speed * t) / 1000,
            y = a.offset / 1000,
            r = Math.hypot(x, y);
          return (
            20 +
            (Q / (2 * Math.PI * a.conductivity * r)) *
              Math.exp((-(a.speed / 1000) * (x + r)) / ((2 * a.diffusivity) / 1e6))
          );
        },
        s = seq(-10, 120, 1300).map((x) => ({ x, y: temp(x) })),
        peak = Math.max(...s.map((v) => v.y));
      const cross = (T) => {
          for (let i = s.findIndex((v) => v.y === peak) + 1; i < s.length; i++)
            if (s[i - 1].y >= T && s[i].y < T)
              return (
                s[i - 1].x + ((s[i].x - s[i - 1].x) * (s[i - 1].y - T)) / (s[i - 1].y - s[i].y)
              );
          return null;
        },
        t8 = cross(800),
        t5 = cross(500);
      return output(
        { heat: Q / a.speed, peak, cooling: t8 === null || t5 === null ? null : t5 - t8 },
        s,
        'welding',
        { ...a },
      );
    },
  ),
  moldingcooling: make(
    {
      id: 'moldingcooling',
      title: 'Injection Molding Cooling Time and Cycle',
      inputs: {
        thickness: p('Wall thickness', 'mm', 0.5, 8, 3),
        diffusivity: p('Polymer thermal diffusivity', 'mm²/s', 0.05, 0.3, 0.12),
        melt: p('Initial melt temperature', '°C', 150, 350, 240),
        wall: p('Mold wall temperature', '°C', 20, 120, 40),
        eject: p('Center ejection temperature', '°C', 60, 180, 100),
        overhead: p('Fill, pack and handling time', 's', 2, 40, 10),
      },
      validateValues: domain('eject', (a) =>
        requireValue(
          a.eject > a.wall && a.eject < a.melt,
          'Require mold temperature < ejection temperature < melt temperature.',
        ),
      ),
      metrics: {
        cooling: ['One-term slab center cooling time', 's'],
        cycle: ['Sequential cycle-time estimate', 's'],
        throughput: ['Cycles per hour', 'h⁻¹'],
      },
      plot: { x: 'Cooling time', xUnit: 's', y: 'Center temperature', yUnit: '°C' },
      text: teaching(
        'Estimate the cooling-limited cycle of a uniform plastic wall with two isothermal mold faces.',
        'What happens to cooling time when wall thickness doubles?',
        ['It increases about fourfold', 'It doubles', 'It halves'],
        'Conduction time scales with thickness squared at fixed thermal properties and temperature ratios.',
        'For thickness 3 mm and α=.12 mm²/s, the diffusion time scale s²/(π²α) is 7.599 s.',
        'Tc=s²/(π²α) ln[(4/π)(Tm−Tw)/(Te−Tw)]; Tcenter−Tw≈(4/π)(Tm−Tw)e^(−π²αt/s²).',
        'One-term center-temperature slab approximation; not a fill/pack or crystallization solver. Early-time one-term values are clipped to initial melt temperature in the plot. Overhead is added sequentially, without overlapping machine operations.',
      ),
    },
    (a) => {
      const scale = a.thickness ** 2 / (Math.PI ** 2 * a.diffusivity),
        cooling = scale * Math.log(((4 / Math.PI) * (a.melt - a.wall)) / (a.eject - a.wall)),
        cycle = cooling + a.overhead;
      return output(
        { cooling, cycle, throughput: 3600 / cycle },
        seq(0, cooling * 1.5).map((x) => ({
          x,
          y: Math.min(a.melt, a.wall + (4 / Math.PI) * (a.melt - a.wall) * Math.exp(-x / scale)),
        })),
        'molding',
        { ...a },
      );
    },
  ),
  additivebuild: make(
    {
      id: 'additivebuild',
      title: 'Additive Manufacturing Layer Height and Build Time',
      inputs: {
        height: p('Part height', 'mm', 5, 200, 50),
        area: p('Average solid cross-section', 'mm²', 100, 10000, 1000),
        layer: p('Layer height', 'mm', 0.05, 0.5, 0.2),
        infill: p('Interior fill fraction', '%', 5, 100, 30),
        speed: p('Extrusion path speed', 'mm/s', 10, 150, 60),
        width: p('Deposited bead width', 'mm', 0.2, 1, 0.45),
        overhead: p('Travel/recoat time per layer', 's', 1, 30, 5),
      },
      metrics: {
        layers: ['Layer count', '1'],
        time: ['Estimated build time', 'min'],
        volume: ['Deposited nominal volume', 'cm³'],
        flow: ['Nominal extrusion flow', 'mm³/s'],
      },
      plot: { x: 'Layer height', xUnit: 'mm', y: 'Build time', yUnit: 'min' },
      text: teaching(
        'Separate deposition time from per-layer overhead and expose the quantized effect of layer count.',
        'At constant bead width and travel speed, do thinner layers reduce total build time?',
        ['No, they generally increase it', 'Yes', 'They do not affect layer count'],
        'Thinner layers require more traversals and more layer-change overhead.',
        'A 50 mm part at .2 mm layers needs 250 layers; .1 mm layers need 500.',
        'N=ceil(H/h); Llayer≈A·fill/w; t=N[Llayer/v+toverhead]; Q=w h v.',
        'Simple FFF path-length budget for uniform average section and one effective infill fraction. Perimeters, support, acceleration, cooling pauses and variable cross sections are not resolved; not a slicer or finish predictor.',
      ),
    },
    (a) => {
      const calc = (h) => {
          const layers = Math.ceil(a.height / h);
          return {
            layers,
            time: (layers * ((a.area * a.infill) / 100 / a.width / a.speed + a.overhead)) / 60,
          };
        },
        r = calc(a.layer);
      return output(
        {
          ...r,
          volume: (a.area * a.height * a.infill) / 100 / 1000,
          flow: a.width * a.layer * a.speed,
        },
        seq(0.05, 0.5).map((x) => ({ x, y: calc(x).time })),
        'layers',
        { ...a, layers: r.layers },
      );
    },
  ),
};
