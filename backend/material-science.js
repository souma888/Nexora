import { lab, p, choice, samples, table } from './lab-kit.js';
export const materialScienceModels = {
  plasticity: lab({ id: 'plasticity', title: 'Elastic–Plastic Stress–Strain', discipline: 'materials', lab: 'MS01', topic: 'Deformation',
    inputs: { modulus: p('Young’s modulus', 'GPa', 50, 250, 200), yield: p('Yield stress', 'MPa', 50, 800, 250), hardening: p('Post-yield tangent modulus', 'GPa', 0, 20, 2), strain: p('Applied engineering strain', '', 0.001, 0.05, 0.01) },
    metrics: { stress: ['Applied stress', 'MPa'], plastic: ['Residual strain after elastic unloading', '%'], yieldStrain: ['Yield strain', '%'] },
    plot: { x: 'Engineering strain', xUnit: '%', y: 'Engineering stress', yUnit: 'MPa', traces: { y: 'Bilinear material', reference: 'Perfectly plastic reference' } },
    text: ['Load a bilinear material beyond yield and estimate the permanent strain left after unloading.', 'What remains after unloading a plastically deformed specimen?', ['Residual strain', 'The full elastic stress', 'No deformation'], 'Unloading recovers σ/E; the remainder of the applied strain is permanent in this model.',
      'E=200 GPa, σy=250 MPa, tangent H=2 GPa and strain 0.01 give stress 267.5 MPa and residual strain 0.86625%.',
      'εy=σy/E. σ=Eε below yield; σ=σy+H(ε−εy) above yield. Residual εp=ε−σ/E after elastic unloading.',
      'Monotonic uniaxial small-strain model with constant post-yield tangent. Unloading modulus equals E. No necking, cyclic hardening, damage, or failure criterion is included.'] },
    ({ modulus, yield: sy, hardening, strain }) => {
      const e = modulus * 1000, h = hardening * 1000, ey = sy / e, stress = strain <= ey ? e * strain : sy + h * (strain - ey), plastic = Math.max(0, strain - stress / e);
      return { summary: { stress, plastic: plastic * 100, yieldStrain: ey * 100 }, series: samples(0, Math.max(strain, 1.5 * ey) * 100, x => ({ y: x / 100 <= ey ? e * x / 100 : sy + h * (x / 100 - ey), reference: Math.min(e * x / 100, sy) })), visualization: { type: 'specimen', strain, residual: plastic, stress, detail: strain > ey ? 'Post-yield loading · elastic unloading leaves permanent strain' : 'Elastic loading · fully recoverable' }, table: table('Loading and unloading states', ['State', 'Strain (%)', 'Stress (MPa)'], [['Origin', 0, 0], ['Yield', ey * 100, sy], ['Applied', strain * 100, stress], ['Fully unloaded', plastic * 100, 0]]) };
    }),
  fatigue: lab({ id: 'fatigue', title: 'Fatigue S–N Curve', discipline: 'materials', lab: 'MS02', topic: 'Fatigue',
    inputs: { coefficient: p('Basquin coefficient A', 'MPa', 500, 2000, 1000), exponent: p('Basquin exponent b', '', -0.2, -0.05, -0.1), cycles: p('Cycles to inspect', 'cycles', 1000, 100000000, 1000000), amplitude: p('Applied stress amplitude', 'MPa', 150, 800, 300) },
    metrics: { strength: ['Stress amplitude at selected cycles', 'MPa'], life: ['Predicted cycles at applied amplitude', 'cycles'], ratio: ['Applied / selected-cycle strength', ''] },
    plot: { x: 'log₁₀ cycles', xUnit: '', y: 'Stress amplitude', yUnit: 'MPa', traces: { y: 'Basquin S–N', reference: 'Applied amplitude' } },
    text: ['Explore the log-life sensitivity of an empirical high-cycle fatigue relationship.', 'For a negative Basquin exponent, what happens as cycle count increases?', ['Allowable amplitude decreases', 'Allowable amplitude increases', 'Amplitude stays fixed'], 'A negative power of N produces a decreasing S–N curve.',
      'With A=1000 MPa and b=−0.1, the amplitude at 10⁶ cycles is 251.19 MPa. At 300 MPa, predicted life is about 169,351 cycles.',
      'σa=A N^b; N=(σa/A)^(1/b). N counts cycles, not reversals. The horizontal axis is log10(N).',
      'Illustrative Basquin fit only. Fully reversed loading, no mean-stress correction or endurance-limit knee. Predictions outside the plotted 10³–10⁸ range are extrapolations, not certified fatigue lives.'] },
    ({ coefficient: a, exponent: b, cycles, amplitude }) => {
      const strength = a * cycles ** b, life = (amplitude / a) ** (1 / b);
      return { summary: { strength, life, ratio: amplitude / strength }, series: samples(3, 8, x => ({ y: a * (10 ** x) ** b, reference: amplitude })), warnings: life < 1000 || life > 1e8 ? ['Predicted life lies outside the displayed S–N range. This is an extrapolation of the empirical fit.'] : [], visualization: { type: 'specimen', stress: amplitude, strain: 0, detail: `Fully reversed amplitude ±${amplitude} MPa · no mean-stress correction` } };
    }),
  creep: lab({ id: 'creep', title: 'Viscoelastic Creep & Recovery', discipline: 'materials', lab: 'MS03', topic: 'Time-dependent behavior',
    inputs: { stress: p('Applied step stress', 'MPa', 10, 200, 50), modulus: p('Spring modulus', 'GPa', 0.1, 10, 1), viscosity: p('Dashpot viscosity', 'GPa·s', 10, 1000, 100), hold: p('Load hold time', 's', 1, 500, 200) },
    metrics: { tau: ['Retardation time', 's'], peak: ['Strain at unloading', '%'], final: ['Strain after recovery view', '%'] },
    plot: { x: 'Time', xUnit: 's', y: 'Strain', yUnit: '%' },
    text: ['Load a Kelvin–Voigt solid, then remove the stress and observe delayed recovery.', 'Does this model retain permanent strain after unlimited recovery?', ['No', 'Yes, all of it', 'Only if viscosity is positive'], 'The parallel spring and dashpot eventually return to zero strain after stress removal.',
      'σ=50 MPa, E=1 GPa and η=100 GPa·s give τ=100 s. A 200 s hold reaches 4.3233% strain before recovery.',
      'η εdot+Eε=σ. Under a step, ε=(σ/E)(1−e^(−t/τ)), τ=η/E. After unloading at th, ε=ε(th)e^(−(t−th)/τ).',
      'Linear Kelvin–Voigt solid with zero initial strain. This is delayed viscoelastic deformation, not irreversible metal creep or tertiary creep failure. Large strains exceed the linear model’s physical scope.'] },
    ({ stress, modulus, viscosity, hold }) => {
      const tau = viscosity / modulus, peak = stress / (modulus * 1000) * -Math.expm1(-hold / tau) * 100;
      const series = samples(0, hold + 5 * tau, x => ({ y: x <= hold ? stress / (modulus * 1000) * -Math.expm1(-x / tau) * 100 : peak * Math.exp(-(x - hold) / tau) }));
      return { summary: { tau, peak, final: series.at(-1).y }, series, visualization: { type: 'viscoelastic', modulus, viscosity, hold, detail: 'Parallel spring + dashpot · load removed after hold' }, warnings: peak > 5 ? ['Predicted strain exceeds 5%. The small-strain linear material approximation may not be appropriate.'] : [] };
    }),
  expansion: lab({ id: 'expansion', title: 'Thermal Expansion & Restraint', discipline: 'materials', lab: 'MS04', topic: 'Thermomechanical behavior',
    inputs: { length: p('Original length', 'm', 0.1, 5, 1), coefficient: p('Expansion coefficient', 'µstrain/K', 1, 30, 12), change: p('Temperature change', 'K', -100, 300, 100), modulus: p('Young’s modulus', 'GPa', 10, 250, 200), restraint: choice('End restraint', { free: 'Free expansion', fixed: 'Fully restrained' }, 'free') },
    metrics: { elongation: ['Actual length change', 'mm'], stress: ['Restraint stress (tension positive)', 'MPa'], strain: ['Free thermal strain', '%'] },
    plot: { x: 'Temperature change', xUnit: 'K', y: 'Length change', yUnit: 'mm', traces: { y: 'Actual', reference: 'Unrestrained reference' } },
    text: ['Compare thermal displacement with the stress caused by preventing it.', 'What stress does heating create under complete axial restraint?', ['Compression', 'Tension', 'No stress'], 'Preventing positive thermal strain requires a negative elastic strain, creating compression.',
      'A 1 m bar with α=12 µstrain/K heated by 100 K expands 1.2 mm if free. At E=200 GPa, complete restraint instead produces −240 MPa.',
      'Free ΔL=αLΔT. Fully restrained ΔL=0 and σ=−EαΔT. Positive stress is tension; positive ΔL is elongation.',
      'Uniform temperature, constant α and E, linear elasticity and ideal end restraint. Yielding, thermal gradients and buckling are not included.'] },
    ({ length, coefficient, change, modulus, restraint }) => {
      const strain = coefficient * 1e-6 * change, fixed = restraint === 'fixed';
      return { summary: { elongation: fixed ? 0 : strain * length * 1000, stress: fixed ? -modulus * 1000 * strain : 0, strain: strain * 100 }, series: samples(-100, 300, x => ({ y: fixed ? 0 : coefficient * 1e-6 * x * length * 1000, reference: coefficient * 1e-6 * x * length * 1000 })), visualization: { type: 'expansion', fixed, strain, detail: `${change} K · ${fixed ? 'fixed ends: mechanical strain cancels thermal strain' : 'free ends: stress remains zero'}` } };
    }),
  composite: lab({ id: 'composite', title: 'Composite Stiffness Bounds', discipline: 'materials', lab: 'MS05', topic: 'Composites',
    inputs: { fiber: p('Fiber modulus', 'GPa', 30, 300, 200), matrix: p('Matrix modulus', 'GPa', 1, 10, 3), fraction: p('Fiber volume fraction', '', 0, 1, 0.6) },
    metrics: { longitudinal: ['Voigt / iso-strain modulus', 'GPa'], transverse: ['Reuss / iso-stress modulus', 'GPa'], ratio: ['Upper / lower stiffness ratio', ''] },
    plot: { x: 'Fiber volume fraction', xUnit: '', y: 'Effective modulus', yUnit: 'GPa', traces: { y: 'Voigt upper bound', reference: 'Reuss lower bound' } },
    text: ['Vary fiber fraction and compare iso-strain with iso-stress mixture rules.', 'Which loading assumption gives the higher stiffness bound?', ['Iso-strain', 'Iso-stress', 'They always agree'], 'The arithmetic mixture is no smaller than the harmonic mixture for positive moduli.',
      'Ef=200 GPa, Em=3 GPa and Vf=0.6 give Voigt 121.2 GPa and Reuss about 7.335 GPa.',
      'EV=Vf Ef+(1−Vf)Em; ER=[Vf/Ef+(1−Vf)/Em]⁻¹. Both reduce to a constituent modulus at Vf=0 or 1.',
      'Ideal aligned two-phase, void-free, perfectly bonded elastic composite. Reuss is a bound, not a complete micromechanical transverse-modulus law. Strength and failure are not predicted.'] },
    ({ fiber, matrix, fraction }) => {
      const voigt = f => f * fiber + (1 - f) * matrix, reuss = f => 1 / (f / fiber + (1 - f) / matrix);
      return { summary: { longitudinal: voigt(fraction), transverse: reuss(fraction), ratio: voigt(fraction) / reuss(fraction) }, series: samples(0, 1, x => ({ y: voigt(x), reference: reuss(x) })), visualization: { type: 'composite', fraction, detail: `Vf ${(fraction * 100).toFixed(1)}% · perfect bonding / no voids` } };
    }),
};

materialScienceModels.expansion.definition.presets = { 'Fully restrained heating': { restraint: 'fixed' }, 'Free cooling': { change: -100 } };
materialScienceModels.composite.definition.presets = { 'Pure matrix limit': { fraction: 0 }, 'Pure fiber limit': { fraction: 1 } };
