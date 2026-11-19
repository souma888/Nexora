import {
  exploration as lab,
  p,
  integer,
  choice,
  seq,
  rad,
  teaching,
  output,
  domain,
  requireValue,
  C,
  add,
  mul,
  div,
  abs,
  polar,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'optics', topic: 'Optics & electromagnetics', ...config }, solve);
export function fresnel(n1, n2, degrees) {
  const t = rad(degrees),
    s = (n1 * Math.sin(t)) / n2,
    tir = s > 1,
    c = Math.cos(t);
  if (tir) return { rs: 1, rp: 1, transmitted: null, tir: true };
  const ct = Math.sqrt(Math.max(0, 1 - s * s));
  return {
    rs: ((n1 * c - n2 * ct) / (n1 * c + n2 * ct)) ** 2,
    rp: ((n2 * c - n1 * ct) / (n2 * c + n1 * ct)) ** 2,
    transmitted: (Math.asin(s) * 180) / Math.PI,
    tir: false,
  };
}
export function chargeField(charges, x, y) {
  let ex = 0,
    ey = 0,
    potential = 0;
  for (const [q, cx, cy] of charges) {
    const dx = x - cx,
      dy = y - cy,
      r = Math.hypot(dx, dy);
    if (r < 0.025) return null;
    const k = 8.9875517923 * q;
    ex += (k * dx) / r ** 3;
    ey += (k * dy) / r ** 3;
    potential += k / r;
  }
  return { ex, ey, potential };
}
export const opticsModels = {
  snell: make(
    {
      id: 'snell',
      title: 'Snell’s Law and Total Internal Reflection',
      inputs: {
        n1: p('Incident refractive index', '1', 1, 2.5, 1.5),
        n2: p('Transmitted refractive index', '1', 1, 2.5, 1),
        incidence: p('Angle from the normal', '°', 0, 89.5, 30),
      },
      metrics: {
        angle: ['Refracted angle', '°'],
        critical: ['Critical angle, if n₁ > n₂', '°'],
        reflection: ['Unpolarized reflected power', '%'],
      },
      plot: { x: 'Incident angle', xUnit: '°', y: 'Transmitted angle', yUnit: '°' },
      text: teaching(
        'Trace a ray across a dielectric boundary and locate the onset of total internal reflection.',
        'Can total internal reflection occur when n₁ < n₂?',
        ['No', 'At every angle', 'Only at normal incidence'],
        'The sine constraint reaches unity only when the ray enters the lower-index medium.',
        'Glass to air at 30° gives θ₂=48.5904°; the critical angle is 41.8103°.',
        'n₁ sin θ₁=n₂ sin θ₂; θc=asin(n₂/n₁).',
        'Lossless isotropic media, planar interface and monochromatic geometric optics. A null transmitted angle denotes an evanescent field, not a propagating ray.',
      ),
    },
    (a) => {
      const f = fresnel(a.n1, a.n2, a.incidence);
      return output(
        {
          angle: f.transmitted,
          critical: a.n1 > a.n2 ? (Math.asin(a.n2 / a.n1) * 180) / Math.PI : null,
          reflection: 50 * (f.rs + f.rp),
        },
        seq(0, 89.5).map((x) => ({ x, y: fresnel(a.n1, a.n2, x).transmitted })),
        'refraction',
        { ...a, ...f },
      );
    },
  ),
  thinlens: make(
    {
      id: 'thinlens',
      title: 'Thin Lens and Ray Diagram',
      inputs: {
        focal: p('Signed focal length', 'cm', -30, 30, 10),
        object: p('Object distance', 'cm', 2, 100, 30),
        height: p('Object height', 'cm', 1, 10, 5),
      },
      validateValues: domain('focal', (a) =>
        requireValue(Math.abs(a.focal) >= 1, 'Use |f| ≥ 1 cm; zero focal length is undefined.'),
      ),
      metrics: {
        image: ['Signed image distance', 'cm'],
        magnification: ['Signed magnification', '1'],
        height: ['Signed image height', 'cm'],
      },
      plot: { x: 'Object distance', xUnit: 'cm', y: 'Signed image distance', yUnit: 'cm' },
      text: teaching(
        'Construct principal rays for a converging or diverging thin lens, including virtual and infinite images.',
        'For a converging lens with the object inside f, is the image real?',
        ['No, virtual and upright', 'Yes, inverted', 'No image exists'],
        'The outgoing rays diverge; their backward extensions intersect on the object side.',
        'f=10 cm and u=30 cm give v=15 cm and m=−0.5.',
        '1/f=1/u+1/v; m=−v/u; hᵢ=mhₒ.',
        'Paraxial thin lens in air. u>0 for a real object; f>0 converging; v>0 real image. At u=f the image is at infinity and is reported as null.',
      ),
    },
    (a) => {
      const v =
          Math.abs(a.object - a.focal) < 1e-9 ? null : (a.focal * a.object) / (a.object - a.focal),
        m = v === null ? null : -v / a.object;
      return output(
        { image: v, magnification: m, height: m === null ? null : m * a.height },
        seq(2, 100, 196).map((x) => ({
          x,
          y: Math.abs(x - a.focal) < 0.6 ? null : (a.focal * x) / (x - a.focal),
        })),
        'lens',
        { ...a, image: v, magnification: m },
      );
    },
  ),
  diffraction: make(
    {
      id: 'diffraction',
      title: 'Double-Slit Interference and Diffraction Grating',
      inputs: {
        wavelength: p('Vacuum wavelength', 'nm', 380, 750, 550),
        spacing: p('Slit separation', 'µm', 5, 100, 20),
        width: p('Individual slit width', 'µm', 0.5, 10, 2),
        slits: integer('Coherent slits', 2, 20, 2),
        screen: p('Screen distance', 'm', 0.5, 5, 1),
      },
      validateValues: domain('width', (a) =>
        requireValue(a.width < a.spacing, 'Slit width must be smaller than separation.'),
      ),
      metrics: {
        fringe: ['Small-angle fringe spacing', 'mm'],
        first: ['First single-slit minimum', '°'],
        principal: ['Visible principal orders, including zero', '1'],
      },
      plot: { x: 'Screen position', xUnit: 'mm', y: 'Normalized intensity', yUnit: '1' },
      text: teaching(
        'Resolve the narrow interference peaks inside the single-slit diffraction envelope.',
        'What happens to principal-peak width when slit count increases?',
        ['It narrows', 'It widens', 'It is unchanged'],
        'More coherent slits sharpen the array factor while the slit envelope remains fixed.',
        'λ=550 nm, d=20 µm and L=1 m give fringe spacing 27.5 mm.',
        'I/I₀=[sin β/β]²[sin(Nα)/(N sin α)]²; β=πa sinθ/λ, α=πd sinθ/λ.',
        'Fraunhofer scalar diffraction, equal coherent slits and uniform illumination. Intensity is normalized to the central maximum. Screen geometry uses θ=atan(x/L).',
      ),
    },
    (a) => {
      const lam = a.wavelength * 1e-9,
        d = a.spacing * 1e-6,
        w = a.width * 1e-6;
      const points = seq(-120, 120, 1200).map((x) => {
        const s = Math.sin(Math.atan(x / 1000 / a.screen)),
          alpha = (Math.PI * d * s) / lam,
          beta = (Math.PI * w * s) / lam;
        return {
          x,
          y:
            (Math.abs(beta) < 1e-12 ? 1 : Math.sin(beta) / beta) ** 2 *
            (Math.abs(Math.sin(alpha)) < 1e-10
              ? 1
              : Math.sin(a.slits * alpha) / (a.slits * Math.sin(alpha))) **
              2,
        };
      });
      return output(
        {
          fringe: ((lam * a.screen) / d) * 1000,
          first: lam <= w ? (Math.asin(lam / w) * 180) / Math.PI : null,
          principal: 2 * Math.floor(d / lam) + 1,
        },
        points,
        'slits',
        { ...a },
      );
    },
  ),
  fresnel: make(
    {
      id: 'fresnel',
      title: 'Fresnel Reflection and Brewster Angle',
      inputs: {
        n1: p('Incident index', '1', 1, 2.5, 1),
        n2: p('Transmitted index', '1', 1, 2.5, 1.5),
        incidence: p('Incident angle', '°', 0, 89.5, 56.31),
      },
      metrics: {
        rs: ['s-polarized reflectance', '%'],
        rp: ['p-polarized reflectance', '%'],
        brewster: ['Brewster angle', '°'],
      },
      plot: {
        x: 'Incidence',
        xUnit: '°',
        y: 'Power reflectance',
        yUnit: '1',
        traces: { y: 's polarization', reference: 'p polarization' },
      },
      text: teaching(
        'Compare the two polarization-dependent reflectances and the Brewster minimum.',
        'Which polarization vanishes at Brewster incidence?',
        ['p polarization', 's polarization', 'Both polarizations'],
        'At Brewster incidence the reflected and refracted propagation directions are perpendicular.',
        'Air to n=1.5 glass: θB=56.3099°, Rs(0)=Rp(0)=0.04.',
        'Rs=|(n₁cosθᵢ−n₂cosθₜ)/(n₁cosθᵢ+n₂cosθₜ)|²; θB=atan(n₂/n₁).',
        'Nonmagnetic lossless dielectrics, no coatings or absorption. TIR power reflectance is unity; phase shifts and evanescent penetration are outside this model.',
      ),
    },
    (a) => {
      const f = fresnel(a.n1, a.n2, a.incidence);
      return output(
        { rs: 100 * f.rs, rp: 100 * f.rp, brewster: (Math.atan(a.n2 / a.n1) * 180) / Math.PI },
        seq(0, 89.5, 300).map((x) => {
          const v = fresnel(a.n1, a.n2, x);
          return { x, y: v.rs, reference: v.rp };
        }),
        'polarization',
        { ...a },
      );
    },
  ),
  pointcharges: make(
    {
      id: 'pointcharges',
      title: 'Electric Field and Potential of Point Charges',
      inputs: {
        q1: p('Left charge', 'nC', -10, 10, 1),
        q2: p('Right charge', 'nC', -10, 10, -1),
        separation: p('Charge separation', 'm', 0.2, 2, 1),
        probeX: p('Probe x', 'm', -2, 2, 0),
        probeY: p('Probe y', 'm', 0.05, 2, 0.5),
      },
      metrics: {
        field: ['Probe field magnitude', 'V/m'],
        potential: ['Probe potential', 'V'],
        direction: ['Field direction from +x', '°'],
      },
      plot: { x: 'x coordinate at probe height', xUnit: 'm', y: 'Potential', yUnit: 'V' },
      text: teaching(
        'Superpose electric fields and potentials from two independently signed point charges.',
        'At the midplane of an equal opposite pair, is potential zero?',
        [
          'Yes, although the field is nonzero',
          'Only if the field is zero',
          'No, potentials are vectors',
        ],
        'Potential adds as a scalar; field contributions add as vectors.',
        '±1 nC at x=±0.5 m give V=0 on x=0; at y=0.5 m the field points toward the negative charge.',
        'V=Σkq/r; E=Σkq(r−rᵢ)/|r−rᵢ|³.',
        'Static point charges in vacuum. A 0.025 m exclusion radius removes singular charge locations; field arrows are direction-normalized for visibility.',
      ),
    },
    (a) => {
      const charges = [
          [a.q1, -a.separation / 2, 0],
          [a.q2, a.separation / 2, 0],
        ],
        f = chargeField(charges, a.probeX, a.probeY);
      return output(
        {
          field: Math.hypot(f.ex, f.ey),
          potential: f.potential,
          direction:
            Math.hypot(f.ex, f.ey) < 1e-12 ? null : (Math.atan2(f.ey, f.ex) * 180) / Math.PI,
        },
        seq(-2, 2, 200).map((x) => ({
          x,
          y: chargeField(charges, x, a.probeY)?.potential ?? null,
        })),
        'field',
        {
          charges,
          probe: [a.probeX, a.probeY],
          vectors: seq(-1.8, 1.8, 12).flatMap((x) =>
            seq(-1.5, 1.5, 10).flatMap((y) => {
              const v = chargeField(charges, x, y);
              return v ? [{ x, y, ...v }] : [];
            }),
          ),
        },
      );
    },
  ),
  currentloop: make(
    {
      id: 'currentloop',
      title: 'Biot–Savart Magnetic Field of Current Loops',
      inputs: {
        current: p('Loop current', 'A', -20, 20, 5),
        radius: p('Loop radius', 'cm', 1, 30, 10),
        turns: integer('Turns', 1, 100, 10),
        z: p('Axial probe coordinate', 'cm', -50, 50, 0),
      },
      metrics: {
        field: ['Axial probe field', 'mT'],
        center: ['Center field', 'mT'],
        ratio: ['B(z) / B(0), zero current gives null', '1'],
      },
      plot: { x: 'Axial position', xUnit: 'cm', y: 'Axial magnetic field', yUnit: 'mT' },
      text: teaching(
        'Evaluate the Biot–Savart integral on the axis of a circular current loop.',
        'What does reversing current do to B?',
        ['Reverses its direction', 'Leaves it unchanged', 'Doubles its magnitude'],
        'Biot–Savart is linear in signed current.',
        'Ten turns, I=5 A and R=0.1 m give B(0)=0.314159 mT.',
        'Bz=μ₀NI R²/[2(R²+z²)^(3/2)].',
        'Thin coincident circular turns in free space; on-axis field only. No ferromagnetic core, finite wire radius or mutual-inductance dynamics.',
      ),
    },
    (a) => {
      const R = a.radius / 100,
        b = (z) =>
          ((4e-7 * Math.PI * a.turns * a.current * R * R) / (2 * (R * R + (z / 100) ** 2) ** 1.5)) *
          1000;
      return output(
        { field: b(a.z), center: b(0), ratio: a.current === 0 ? null : b(a.z) / b(0) },
        seq(-50, 50, 200).map((x) => ({ x, y: b(x) })),
        'loop',
        { ...a },
      );
    },
  ),
  faraday: make(
    {
      id: 'faraday',
      title: 'Faraday Induction and Lenz’s Law',
      inputs: {
        field: p('Uniform magnetic field', 'T', 0.01, 2, 0.2),
        area: p('Loop area', 'cm²', 1, 1000, 100),
        turns: integer('Turns', 1, 200, 20),
        frequency: p('Rotation frequency', 'Hz', 0.1, 20, 2),
        resistance: p('Loop resistance', 'Ω', 1, 100, 10),
      },
      metrics: {
        flux: ['Peak linked flux', 'Wb'],
        emf: ['Peak induced EMF', 'V'],
        power: ['Mean resistive power', 'W'],
      },
      plot: {
        traceUnits: { reference: 'Wb' },
        x: 'Time',
        xUnit: 's',
        y: 'EMF',
        yUnit: 'V',
        traces: { y: 'Induced EMF', reference: 'Linked flux (Wb), separate units' },
      },
      text: teaching(
        'Rotate a coil and compare linked flux with its negative time derivative.',
        'At maximum flux, is the induced EMF maximum?',
        ['No, it is zero', 'Yes', 'Only with zero resistance'],
        'EMF responds to rate of change of flux, not its magnitude.',
        'N=20, B=0.2 T, A=0.01 m² and f=2 Hz give Epk=0.502655 V.',
        'λ=NBA cosωt; e=−dλ/dt=NBAω sinωt; P̄=Epk²/(2R).',
        'Prescribed rotation in a uniform static field; resistive load only. Flux and voltage traces carry different units as labeled. Back torque, inductance and rotation dynamics are omitted.',
      ),
    },
    (a) => {
      const flux = (a.turns * a.field * a.area) / 1e4,
        w = 2 * Math.PI * a.frequency,
        E = flux * w;
      return output(
        { flux, emf: E, power: (E * E) / (2 * a.resistance) },
        seq(0, 2 / a.frequency, 240).map((x) => ({
          x,
          y: E * Math.sin(w * x),
          reference: flux * Math.cos(w * x),
        })),
        'induction',
        { ...a, emf: E },
      );
    },
  ),
  linereflection: make(
    {
      id: 'linereflection',
      title: 'Transmission-Line Reflection and VSWR',
      inputs: {
        impedance: p('Characteristic impedance', 'Ω', 10, 200, 50),
        resistance: p('Load resistance', 'Ω', 0, 300, 100),
        reactance: p('Load reactance', 'Ω', -200, 200, 0),
        length: p('Electrical length', 'wavelength', 0.05, 2, 0.5),
      },
      metrics: {
        magnitude: ['Reflection coefficient magnitude', '1'],
        vswr: ['Voltage standing-wave ratio', '1'],
        power: ['Fraction of incident power accepted', '%'],
      },
      plot: { x: 'Distance from load', xUnit: 'λ', y: 'Normalized voltage magnitude', yUnit: '1' },
      text: teaching(
        'Superpose incident and reflected waves on a lossless line with a complex load.',
        'What is Γ for a matched load?',
        ['Zero', 'One', 'Minus one'],
        'No impedance discontinuity means no reflected traveling wave.',
        'Z₀=50 Ω and ZL=100 Ω give Γ=1/3 and VSWR=2.',
        'Γ=(ZL−Z₀)/(ZL+Z₀); VSWR=(1+|Γ|)/(1−|Γ|); |V(z)|=|eʲᵝᶻ+Γe⁻ʲᵝᶻ|.',
        'Lossless uniform line and passive load. Purely reactive or shorted loads have infinite VSWR, shown as null. Distance is measured toward the source from the load.',
      ),
    },
    (a) => {
      const g = div(
          C(a.resistance - a.impedance, a.reactance),
          C(a.resistance + a.impedance, a.reactance),
        ),
        r = abs(g);
      return output(
        { magnitude: r, vswr: 1 - r < 1e-12 ? null : (1 + r) / (1 - r), power: 100 * (1 - r * r) },
        seq(0, a.length, 240).map((x) => ({
          x,
          y: abs(add(polar(1, 2 * Math.PI * x), mul(g, polar(1, -2 * Math.PI * x)))),
        })),
        'standing-wave',
        { ...a, gamma: g },
      );
    },
  ),
  waveguide: make(
    {
      id: 'waveguide',
      title: 'Rectangular Waveguide Modes and Cutoff',
      inputs: {
        width: p('Broad dimension a', 'mm', 10, 100, 22.86),
        height: p('Narrow dimension b', 'mm', 5, 50, 10.16),
        m: integer('Mode index m', 0, 4, 1),
        n: integer('Mode index n', 0, 4, 0),
        mode: choice('Field family', ['TE', 'TM'], 'TE'),
        frequency: p('Operating frequency', 'GHz', 1, 40, 10),
      },
      validateValues: domain('m', (a) =>
        requireValue(
          a.mode === 'TM' ? a.m > 0 && a.n > 0 : a.m + a.n > 0,
          'TE requires a nonzero index; TM requires both indices positive.',
        ),
      ),
      metrics: {
        cutoff: ['Cutoff frequency', 'GHz'],
        guide: ['Guide wavelength above cutoff', 'mm'],
        velocity: ['Group velocity / c', '1'],
      },
      plot: { x: 'Frequency', xUnit: 'GHz', y: 'β / k₀', yUnit: '1' },
      text: teaching(
        'Select rectangular-guide TE/TM indices and compare propagating and evanescent regimes.',
        'Can a hollow rectangular guide propagate a TEM mode?',
        ['No', 'Yes, m=n=0', 'Only below cutoff'],
        'A single hollow conductor cannot support the independent electrostatic potentials needed for TEM.',
        'WR-90 TE10 has fc≈6.557 GHz; at 10 GHz its guide wavelength is about 39.7 mm.',
        'fc=(c/2)√[(m/a)²+(n/b)²]; β=k₀√[1−(fc/f)²].',
        'Perfectly conducting air-filled guide; no conductor/dielectric loss. Below cutoff guide wavelength and group speed are null. The diagram is a normalized transverse field pattern, not full-vector FEM.',
      ),
    },
    (a) => {
      const fc =
          ((299792458 / 2) * Math.hypot(a.m / (a.width / 1000), a.n / (a.height / 1000))) / 1e9,
        r = a.frequency > fc ? Math.sqrt(1 - (fc / a.frequency) ** 2) : null;
      return output(
        { cutoff: fc, guide: r === null ? null : 299.792458 / a.frequency / r, velocity: r },
        seq(1, 40, 240).map((x) => ({ x, y: x > fc ? Math.sqrt(1 - (fc / x) ** 2) : null })),
        'waveguide',
        { ...a, cutoff: fc },
      );
    },
  ),
};
