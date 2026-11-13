/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  plasticity: [
    'Load a bilinear material beyond yield and estimate the permanent strain left after unloading.',
    'What remains after unloading a plastically deformed specimen?',
    ['Residual strain', 'The full elastic stress', 'No deformation'],
    'Unloading recovers σ/E; the remainder of the applied strain is permanent in this model.',
    'E=200 GPa, σy=250 MPa, tangent H=2 GPa and strain 0.01 give stress 267.5 MPa and ' +
      'residual strain 0.86625%.',
    'εy=σy/E. σ=Eε below yield; σ=σy+H(ε−εy) above yield. Residual εp=ε−σ/E after elastic unloading.',
    'Monotonic uniaxial small-strain model with constant post-yield tangent. ' +
      'Unloading modulus equals E. No necking, cyclic hardening, damage, or failure ' +
      'criterion is included.',
  ],
  fatigue: [
    'Explore the log-life sensitivity of an empirical high-cycle fatigue relationship.',
    'For a negative Basquin exponent, what happens as cycle count increases?',
    ['Allowable amplitude decreases', 'Allowable amplitude increases', 'Amplitude stays fixed'],
    'A negative power of N produces a decreasing S–N curve.',
    'With A=1000 MPa and b=−0.1, the amplitude at 10⁶ cycles is 251.19 MPa. At 300 ' +
      'MPa, predicted life is about 169,351 cycles.',
    'σa=A N^b; N=(σa/A)^(1/b). N counts cycles, not reversals. The horizontal axis is log10(N).',
    'Illustrative Basquin fit only. Fully reversed loading, no mean-stress correction ' +
      'or endurance-limit knee. Predictions outside the plotted 10³–10⁸ range are ' +
      'extrapolations, not certified fatigue lives.',
  ],
  creep: [
    'Load a Kelvin–Voigt solid, then remove the stress and observe delayed recovery.',
    'Does this model retain permanent strain after unlimited recovery?',
    ['No', 'Yes, all of it', 'Only if viscosity is positive'],
    'The parallel spring and dashpot eventually return to zero strain after stress removal.',
    'σ=50 MPa, E=1 GPa and η=100 GPa·s give τ=100 s. A 200 s hold reaches 4.3233% strain before recovery.',
    'η εdot+Eε=σ. Under a step, ε=(σ/E)(1−e^(−t/τ)), τ=η/E. After unloading at th, ε=ε(th)e^(−(t−th)/τ).',
    'Linear Kelvin–Voigt solid with zero initial strain. This is delayed viscoelastic ' +
      'deformation, not irreversible metal creep or tertiary creep failure. Large ' +
      'strains exceed the linear model’s physical scope.',
  ],
  expansion: [
    'Compare thermal displacement with the stress caused by preventing it.',
    'What stress does heating create under complete axial restraint?',
    ['Compression', 'Tension', 'No stress'],
    'Preventing positive thermal strain requires a negative elastic strain, creating compression.',
    'A 1 m bar with α=12 µstrain/K heated by 100 K expands 1.2 mm if free. At E=200 ' +
      'GPa, complete restraint instead produces −240 MPa.',
    'Free ΔL=αLΔT. Fully restrained ΔL=0 and σ=−EαΔT. Positive stress is tension; ' +
      'positive ΔL is elongation.',
    'Uniform temperature, constant α and E, linear elasticity and ideal end ' +
      'restraint. Yielding, thermal gradients and buckling are not included.',
  ],
  composite: [
    'Vary fiber fraction and compare iso-strain with iso-stress mixture rules.',
    'Which loading assumption gives the higher stiffness bound?',
    ['Iso-strain', 'Iso-stress', 'They always agree'],
    'The arithmetic mixture is no smaller than the harmonic mixture for positive moduli.',
    'Ef=200 GPa, Em=3 GPa and Vf=0.6 give Voigt 121.2 GPa and Reuss about 7.335 GPa.',
    'EV=Vf Ef+(1−Vf)Em; ER=[Vf/Ef+(1−Vf)/Em]⁻¹. Both reduce to a constituent modulus at Vf=0 or 1.',
    'Ideal aligned two-phase, void-free, perfectly bonded elastic composite. Reuss is ' +
      'a bound, not a complete micromechanical transverse-modulus law. Strength and ' +
      'failure are not predicted.',
  ],
};
